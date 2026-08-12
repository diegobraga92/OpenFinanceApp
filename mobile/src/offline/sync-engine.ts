/**
 * Offline sync engine.
 *
 * Coordinates pushing queued mutations to the server and pulling changes made
 * elsewhere. Uses the mobile API layer (`src/api.ts`) for transport and the
 * local SQLite mirror (`src/offline/database.ts`) for storage.
 */

import NetInfo from '@react-native-community/netinfo';
import { syncPull, syncPush, type SyncPushOperation } from '../api';
import {
  addPendingOperation,
  countPendingOperations,
  getLastSync,
  getPendingOperations,
  getLocalCategories,
  getLocalTransactions,
  markTransactionSynced,
  removePendingOperation,
  replaceLocalCategories,
  replaceLocalTransactions,
  saveLastSync,
  type LocalCategory,
  type LocalTransaction,
} from './database';

export interface SyncResult {
  pushed: number;
  pulledTransactions: number;
  pulledCategories: number;
  ok: boolean;
  error?: string;
}

/** Returns whether the device currently has network connectivity. */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Pushes pending operations and pulls remote changes. */
export async function syncAll(): Promise<SyncResult> {
  const online = await isOnline();
  if (!online) {
    return { pushed: 0, pulledTransactions: 0, pulledCategories: 0, ok: false, error: 'offline' };
  }

  const pushed = await pushPending();
  const pulled = await pullChanges();
  return {
    pushed,
    pulledTransactions: pulled.transactions.length,
    pulledCategories: pulled.categories.length,
    ok: true,
  };
}

/**
 * Sends queued mutations to the server in order, then updates the local
 * mirror with the server-assigned IDs.
 */
async function pushPending(): Promise<number> {
  const pending = getPendingOperations();
  if (pending.length === 0) return 0;

  const operations: SyncPushOperation[] = pending.map((op) => ({
    operation_type: op.operation_type,
    entity_type: op.entity_type,
    client_id: op.local_id ?? op.server_id ?? cryptoUUID(),
    server_id: op.server_id ?? undefined,
    payload: op.payload ? JSON.parse(op.payload) : {},
  }));

  const res = await syncPush(operations);

  // Apply results: on success mark the local row synced / remove from queue.
  res.results.forEach((result, idx) => {
    const op = pending[idx];
    if (!op) return;
    if (result.status === 'ok' && op.entity_type === 'transaction') {
      const serverId = result.server_id ?? op.server_id;
      if (op.local_id && serverId) {
        markTransactionSynced(op.local_id, serverId);
      }
      removePendingOperation(op.id);
    } else if (result.status === 'ok' && op.entity_type === 'category') {
      removePendingOperation(op.id);
    } else if (result.status === 'error') {
      // Drop permanently-invalid ops (e.g. 400 bad request) so they don't
      // block the queue forever; transient failures will retry next sync.
      if (result.error?.includes('required') || result.error?.includes('Invalid')) {
        removePendingOperation(op.id);
      }
    }
  });

  return res.results.filter((r) => r.status === 'ok').length;
}

/** Pulls changes since the last sync and refreshes the local mirror. */
export async function pullChanges(): Promise<{
  transactions: LocalTransaction[];
  categories: LocalCategory[];
}> {
  const lastSync = getLastSync() ?? new Date(0).toISOString();
  const res = await syncPull(lastSync);

  // Categories: full replace (they're small).
  const localCategories: LocalCategory[] = res.categories.map((c) => ({
    id: c.id,
    server_id: c.id,
    name: c.name,
    type: c.type,
    parent_id: c.parent_id ?? null,
    icon: c.icon ?? null,
    color: c.color ?? null,
    synced: 1,
    updated_at: c.updated_at,
  }));
  replaceLocalCategories(localCategories);

  // Transactions: merge pulled rows without clobbering unsynced local rows.
  const localTxns = getLocalTransactions();
  const byId = new Map<string, LocalTransaction>();
  for (const tx of localTxns) {
    if (tx.synced === 0) {
      byId.set(tx.id, tx); // keep local-only rows
    } else if (tx.server_id) {
      byId.set(tx.server_id, tx);
    } else {
      byId.set(tx.id, tx);
    }
  }
  for (const t of res.transactions) {
    const serverId = t.id;
    byId.set(serverId, {
      id: serverId,
      server_id: serverId,
      description: t.description,
      amount: t.amount,
      type: t.type as LocalTransaction['type'],
      category_id: t.category_id ?? null,
      date: t.date,
      notes: t.notes ?? null,
      installment_plan_id: t.installment_plan_id ?? null,
      synced: 1,
      updated_at: t.updated_at,
    });
  }
  replaceLocalTransactions(Array.from(byId.values()));

  saveLastSync(res.server_time);

  return {
    transactions: getLocalTransactions(),
    categories: getLocalCategories(),
  };
}

/**
 * Queues a local mutation for later push and immediately updates the local
 * mirror (optimistic write).
 */
export function queueLocalMutation(
  operationType: 'create' | 'update' | 'delete',
  entityType: 'transaction' | 'category',
  localId: string,
  serverId: string | null,
  payload: Record<string, unknown>,
): void {
  addPendingOperation({
    operation_type: operationType,
    entity_type: entityType,
    local_id: localId,
    server_id: serverId,
    payload: JSON.stringify(payload),
  });
}

export { countPendingOperations, getLocalCategories, getLocalTransactions };

/** Generates a UUID without a crypto dependency (fallback). */
function cryptoUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Register the pending-count callback for UI indicators. */
export function subscribePendingCount(cb: (count: number) => void): () => void {
  let active = true;
  const poll = () => {
    if (!active) return;
    cb(countPendingOperations());
  };
  poll();
  // Simple interval-based polling; the count is cheap.
  const interval = setInterval(poll, 2000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

