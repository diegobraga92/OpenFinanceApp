/**
 * Description-based auto-complete for the add-transaction form.
 *
 * Looks up the on-device transaction mirror (see ./database.ts) for a previous
 * transaction whose description matches what the user is typing, so the form
 * can pre-fill the amount, type and category from history.
 */

import { getLocalTransactions } from './database';

export interface PreviousTransaction {
  amount: string;
  category_id: string | null;
  type: 'income' | 'expense';
}

/** Minimum input length before prefix/substring matching kicks in. */
const MIN_FUZZY_LENGTH = 3;

/** Normalizes a description for matching: lowercase, accents stripped, trimmed. */
export function normalizeDescription(description: string): string {
  return description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds the most recent previous transaction that matches the given
 * description. Mirror rows are ordered date DESC / updated_at DESC, so the
 * first match is the newest one. Exact normalized matches always win; then a
 * prefix match; then a substring match (for inputs of at least 3 characters,
 * to avoid over-eager suggestions).
 */
export function findPreviousTransaction(
  description: string,
): PreviousTransaction | null {
  const needle = normalizeDescription(description);
  if (!needle) return null;

  // The mirror is only available in React Native builds; degrade gracefully
  // (no suggestions) anywhere else instead of crashing the form.
  let transactions: ReturnType<typeof getLocalTransactions>;
  try {
    transactions = getLocalTransactions();
  } catch {
    return null;
  }

  const exact = transactions.find(
    (t) => normalizeDescription(t.description) === needle,
  );
  if (exact) return pick(exact);

  if (needle.length < MIN_FUZZY_LENGTH) return null;

  const prefix = transactions.find((t) => {
    const candidate = normalizeDescription(t.description);
    return candidate.startsWith(needle);
  });
  if (prefix) return pick(prefix);

  const substring = transactions.find((t) => {
    const candidate = normalizeDescription(t.description);
    return candidate.includes(needle) && candidate.length > needle.length;
  });
  return substring ? pick(substring) : null;
}

function pick(
  tx: {
    amount: string;
    category_id: string | null;
    type: 'income' | 'expense';
  },
): PreviousTransaction {
  return { amount: tx.amount, category_id: tx.category_id, type: tx.type };
}
