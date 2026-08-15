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
  account_id: string | null;
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
  entity_type: 'transaction' | 'category' | 'account';
  /** Client UUID for creates / local row id. */
  local_id: string | null;
  /** Server UUID for updates/deletes. */
  server_id: string | null;
  /** JSON request body for create/update. */
  payload: string;
  created_at: string;
}

export interface LocalAccount {
  /** Local row id — a client-generated UUID (equal to the server id for synced rows). */
  id: string;
  /** Server UUID once the row has been pushed (NULL until then). */
  server_id: string | null;
  name: string;
  /** `asset`, `liability`, `equity`, `income`, or `expense`. */
  type: string;
  /** User-facing kind: `bank`, `cash`, `card`, `loan`, `investment`, etc. */
  account_kind: string;
  parent_id: string | null;
  closing_day: number | null;
  due_day: number | null;
  credit_limit: string | null;
  /** Last-known ledger balance (cached from the server). */
  balance: string;
  transaction_count: number;
  created_at: string;
  updated_at: string;
  /** 0 = local-only (pending push), 1 = synced to server. */
  synced: number;
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
      account_id TEXT,
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
      entity_type TEXT NOT NULL,
      local_id TEXT,
      server_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_accounts (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      account_kind TEXT NOT NULL,
      parent_id TEXT,
      closing_day INTEGER,
      due_day INTEGER,
      credit_limit TEXT,
      balance TEXT NOT NULL DEFAULT '0',
      transaction_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_local_accounts_server ON local_accounts (server_id);

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Lightweight migration for databases created before `account_id` existed.
  const cols = db!.getAllSync('PRAGMA table_info(local_transactions)') as unknown as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === 'account_id')) {
    db!.execSync('ALTER TABLE local_transactions ADD COLUMN account_id TEXT');
  }

  // Migration v2: relax the `pending_operations.entity_type` CHECK constraint
  // (SQLite can't ALTER a CHECK, so the table is rebuilt) to also allow
  // queuing account mutations for offline sync.
  const version = db!.getFirstSync('PRAGMA user_version') as unknown as {
    user_version: number;
  } | null;
  if ((version?.user_version ?? 0) < 2) {
    db!.withTransactionSync(() => {
      db!.execSync(`
        ALTER TABLE pending_operations RENAME TO pending_operations_old;
        CREATE TABLE pending_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_type TEXT NOT NULL CHECK (operation_type IN ('create','update','delete')),
          entity_type TEXT NOT NULL,
          local_id TEXT,
          server_id TEXT,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO pending_operations (id, operation_type, entity_type, local_id, server_id, payload, created_at)
          SELECT id, operation_type, entity_type, local_id, server_id, payload, created_at
          FROM pending_operations_old;
        DROP TABLE pending_operations_old;
      `);
      db!.execSync('PRAGMA user_version = 2');
    });
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export function upsertLocalTransaction(tx: Omit<LocalTransaction, 'updated_at'>): void {
  const now = new Date().toISOString();
  getDb().runSync(
    `INSERT INTO local_transactions
       (id, server_id, description, amount, type, category_id, date, notes,
        installment_plan_id, account_id, synced, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       server_id = excluded.server_id,
       description = excluded.description,
       amount = excluded.amount,
       type = excluded.type,
       category_id = excluded.category_id,
       date = excluded.date,
       notes = excluded.notes,
       installment_plan_id = excluded.installment_plan_id,
       account_id = excluded.account_id,
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
    tx.account_id,
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

/**
 * Removes a transaction that was never pushed to the server: deletes the local
 * row and drops any queued create/update op for it (used by "undo" after an
 * auto-imported notification capture).
 */
export function cancelLocalTransaction(id: string): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync('DELETE FROM local_transactions WHERE id = ? OR server_id = ?', id, id);
    d.runSync(
      "DELETE FROM pending_operations WHERE entity_type = 'transaction' AND (local_id = ? OR server_id = ?)",
      id,
      id,
    );
  });
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

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function upsertLocalAccount(account: LocalAccount): void {
  getDb().runSync(
    `INSERT INTO local_accounts
       (id, server_id, name, type, account_kind, parent_id, closing_day, due_day,
        credit_limit, balance, transaction_count, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       server_id = excluded.server_id,
       name = excluded.name,
       type = excluded.type,
       account_kind = excluded.account_kind,
       parent_id = excluded.parent_id,
       closing_day = excluded.closing_day,
       due_day = excluded.due_day,
       credit_limit = excluded.credit_limit,
       balance = excluded.balance,
       transaction_count = excluded.transaction_count,
       updated_at = excluded.updated_at,
       synced = excluded.synced`,
    account.id,
    account.server_id,
    account.name,
    account.type,
    account.account_kind,
    account.parent_id,
    account.closing_day,
    account.due_day,
    account.credit_limit,
    account.balance,
    account.transaction_count,
    account.created_at,
    account.updated_at,
    account.synced,
  );
}

/** Applies an edit to an existing local account (name/kind/card fields). */
export function updateLocalAccountFields(
  id: string,
  fields: {
    name?: string;
    type?: string;
    account_kind?: string;
    parent_id?: string | null;
    closing_day?: number | null;
    due_day?: number | null;
    credit_limit?: string | null;
  },
): void {
  const d = getDb();
  const existing = d.getFirstSync(
    'SELECT * FROM local_accounts WHERE id = ? OR server_id = ? LIMIT 1',
    id,
    id,
  ) as unknown as LocalAccount | null;
  if (!existing) return;

  const next: LocalAccount = {
    ...existing,
    name: fields.name ?? existing.name,
    type: fields.type ?? existing.type,
    account_kind: fields.account_kind ?? existing.account_kind,
    parent_id: fields.parent_id !== undefined ? fields.parent_id : existing.parent_id,
    closing_day: fields.closing_day !== undefined ? fields.closing_day : existing.closing_day,
    due_day: fields.due_day !== undefined ? fields.due_day : existing.due_day,
    credit_limit: fields.credit_limit !== undefined ? fields.credit_limit : existing.credit_limit,
    updated_at: new Date().toISOString(),
  };
  upsertLocalAccount(next);
}

export function deleteLocalAccount(id: string): void {
  getDb().runSync('DELETE FROM local_accounts WHERE id = ? OR server_id = ?', id, id);
}

export function markAccountSynced(localId: string, serverId: string): void {
  getDb().runSync(
    'UPDATE local_accounts SET server_id = ?, synced = 1, updated_at = ? WHERE id = ?',
    serverId,
    new Date().toISOString(),
    localId,
  );
}

export function replaceLocalAccounts(accounts: LocalAccount[]): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync('DELETE FROM local_accounts');
    for (const account of accounts) {
      upsertLocalAccount(account);
    }
  });
}

export function getLocalAccounts(): LocalAccount[] {
  return getDb().getAllSync(
    'SELECT * FROM local_accounts ORDER BY name',
  ) as unknown as LocalAccount[];
}

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

