/**
 * Local SQLite mirror for offline-first operation.
 *
 * Stores categories and transactions locally, plus a queue of pending
 * mutations that are pushed to the server when connectivity returns.
 *
 * Uses expo-sqlite's synchronous API (React Native builds only).
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'pudimfinance.db';

export interface LocalTransaction {
  /** Local row id — a client-generated UUID. */
  id: string;
  /** Server UUID once the row has been pushed (NULL until then). */
  server_id: string | null;
  description: string;
  amount: string;
  type: 'income' | 'expense';
  category_id: string | null;
  date: string;
  notes: string | null;
  installment_plan_id: string | null;
  /** 0 = local-only (pending push), 1 = synced to server. */
  synced: number;
  updated_at: string;
}

export interface LocalCategory {
  id: string;
  server_id: string | null;
  name: string;
  type: string;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  synced: number;
  updated_at: string;
}

export interface PendingOperation {
  id: number;
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'transaction' | 'category';
  /** Client UUID for creates / local row id. */
  local_id: string | null;
  /** Server UUID for updates/deletes. */
  server_id: string | null;
  /** JSON request body for create/update. */
  payload: string;
  created_at: string;
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db!.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS local_transactions (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      category_id TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      installment_plan_id TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_tx_synced ON local_transactions (synced);
    CREATE INDEX IF NOT EXISTS idx_local_tx_server ON local_transactions (server_id);

    CREATE TABLE IF NOT EXISTS local_categories (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id TEXT,
      icon TEXT,
      color TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL CHECK (operation_type IN ('create','update','delete')),
      entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction','category')),
      local_id TEXT,
      server_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export function upsertLocalTransaction(tx: Omit<LocalTransaction, 'updated_at'>): void {
  const now = new Date().toISOString();
  getDb().runSync(
    `INSERT INTO local_transactions
       (id, server_id, description, amount, type, category_id, date, notes,
        installment_plan_id, synced, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       server_id = excluded.server_id,
       description = excluded.description,
       amount = excluded.amount,
       type = excluded.type,
       category_id = excluded.category_id,
       date = excluded.date,
       notes = excluded.notes,
       installment_plan_id = excluded.installment_plan_id,
       synced = excluded.synced,
       updated_at = excluded.updated_at`,
    tx.id,
    tx.server_id,
    tx.description,
    tx.amount,
    tx.type,
    tx.category_id,
    tx.date,
    tx.notes,
    tx.installment_plan_id,
    tx.synced,
    now,
  );
}

export function getLocalTransactions(): LocalTransaction[] {
  return getDb().getAllSync(
    'SELECT * FROM local_transactions ORDER BY date DESC, updated_at DESC',
  ) as unknown as LocalTransaction[];
}

export function getLocalTransactionById(id: string): LocalTransaction | null {
  return (
    (getDb().getFirstSync(
      'SELECT * FROM local_transactions WHERE id = ? OR server_id = ? LIMIT 1',
      id,
      id,
    ) as unknown as LocalTransaction | null) ?? null
  );
}

export function markTransactionSynced(localId: string, serverId: string): void {
  getDb().runSync(
    'UPDATE local_transactions SET server_id = ?, synced = 1, updated_at = ? WHERE id = ?',
    serverId,
    new Date().toISOString(),
    localId,
  );
}

export function deleteLocalTransaction(id: string): void {
  getDb().runSync('DELETE FROM local_transactions WHERE id = ? OR server_id = ?', id, id);
}

export function replaceLocalTransactions(transactions: LocalTransaction[]): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync('DELETE FROM local_transactions');
    for (const tx of transactions) {
      upsertLocalTransaction(tx);
    }
  });
}


// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function replaceLocalCategories(categories: LocalCategory[]): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync('DELETE FROM local_categories');
    for (const cat of categories) {
      const now = new Date().toISOString();
      d.runSync(
        `INSERT INTO local_categories
           (id, server_id, name, type, parent_id, icon, color, synced, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        cat.id,
        cat.server_id,
        cat.name,
        cat.type,
        cat.parent_id,
        cat.icon,
        cat.color,
        now,
      );
    }
  });
}

export function getLocalCategories(): LocalCategory[] {
  return getDb().getAllSync(
    'SELECT * FROM local_categories ORDER BY name',
  ) as unknown as LocalCategory[];
}

// ---------------------------------------------------------------------------
// Pending operations
// ---------------------------------------------------------------------------

export function addPendingOperation(op: Omit<PendingOperation, 'id' | 'created_at'>): void {
  getDb().runSync(
    `INSERT INTO pending_operations (operation_type, entity_type, local_id, server_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    op.operation_type,
    op.entity_type,
    op.local_id,
    op.server_id,
    op.payload,
    new Date().toISOString(),
  );
}

export function getPendingOperations(): PendingOperation[] {
  return getDb().getAllSync(
    'SELECT * FROM pending_operations ORDER BY id ASC',
  ) as unknown as PendingOperation[];
}

export function removePendingOperation(id: number): void {
  getDb().runSync('DELETE FROM pending_operations WHERE id = ?', id);
}

export function clearPendingOperations(): void {
  getDb().execSync('DELETE FROM pending_operations');
}

export function countPendingOperations(): number {
  const row = getDb().getFirstSync(
    'SELECT COUNT(*) AS c FROM pending_operations',
  ) as unknown as { c: number };
  return row?.c ?? 0;
}

// ---------------------------------------------------------------------------
// Sync metadata
// ---------------------------------------------------------------------------

export function getLastSync(): string | null {
  const row = getDb().getFirstSync(
    "SELECT value FROM sync_metadata WHERE key = 'last_synced_at'",
  ) as unknown as { value: string } | null;
  return row?.value ?? null;
}

export function saveLastSync(timestamp: string): void {
  getDb().runSync(
    `INSERT INTO sync_metadata (key, value) VALUES ('last_synced_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    timestamp,
  );
}

