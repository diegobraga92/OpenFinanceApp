# ADR 005: Ledger Design and Event Sourcing

**Status:** Accepted

**Date:** 2026-08-06

## Context

Layer 3 migrates the simple single-entry transaction tracker to an immutable double-entry accounting ledger and introduces event sourcing. We need to decide:

1. The schema for the chart of accounts and ledger entries
2. How to enforce the accounting equation (debits = credits)
3. Whether to use event sourcing (an append-only event log) as the source of truth
4. How to migrate existing single-entry transactions without data loss

## Decision

### 1. Chart of accounts with seeded asset/income/expense accounts

A new `accounts` table stores the chart of accounts with standard account types (`asset`, `liability`, `equity`, `income`, `expense`). Migration 003 seeds a default chart mirroring the Layer 1 seed categories (Cash, Bank Account, Salary Income, Food & Groceries, etc.).

**Rationale:** A standard chart of accounts keeps the ledger familiar to accountants and makes future reporting (profit/loss, balance sheet) possible. Mirroring the Layer 1 category names gives a clean 1:1 mapping for migration.

### 2. Immutable ledger entries table enforcing balanced transactions

The `ledger_entries` table is append-only (never updated or deleted). Each entry references a `transaction_id` (a UUID shared by all entries in one transaction) and an `account_id`, with either a positive `debit_amount` or `credit_amount` (enforced by a CHECK constraint). The backend validates that for every transaction, `sum(debits) == sum(credits)`.

**Rationale:** Immutability is the core accounting principle — historical financial records must never be altered. The backend validation enforces the accounting equation before any entry is written, so the database can never contain an unbalanced transaction.

### 3. Event sourcing with `events` table as audit trail

A new `events` table stores `TransactionRecorded` events immutably (append-only, `BIGSERIAL` ID). Every ledger transaction inserts an event with the full payload. These events are published to RabbitMQ and can be replayed to reconstruct state.

**Rationale:** The event log provides a complete audit trail and enables downstream consumers (reporting, analytics, audit) without coupling to the transactional tables. It aligns with the original project plan's event sourcing requirement.

### 4. Single-to-double migration with idempotent re-runs

The `POST /api/migrate/single-to-double` endpoint reads all simple transactions without a `ledger_transaction_id`, converts each to a balanced ledger entry pair, and marks the transaction as migrated so re-running the migration safely skips already-processed rows.

**Rationale:** The migration is repeatable and idempotent. A `ledger_transaction_id` column on the simple `transactions` table links each legacy row to its new ledger transaction, enabling traceability and avoiding double-migration.

## Consequences

- The `transactions` table remains for backward compatibility; new ledger data is stored in `ledger_entries`.
- Existing Layer 1/2 endpoints continue to read from `transactions`.
- Future read paths may switch to `ledger_entries` once the migration is complete.
- Events are stored with full payloads, enabling replay and audit.
- Unbalanced transaction submissions are rejected with HTTP 400.

## Related ADRs

- ADR 002: API Contract Strategy (idempotency keys from ADR 002 are used by `POST /api/ledger/transactions`)
- ADR 003: Start with Simple Single-Entry Transactions (this is the direct evolution of that decision)
- ADR 006: Isolation Level Choice (database transaction isolation for ledger writes)
- ADR 007: Event Publishing via RabbitMQ (how events leave the backend)