# ADR 006: Database Isolation Level Choice for Ledger Operations

**Status:** Accepted

**Date:** 2026-08-06

## Context

The double-entry ledger must guarantee consistency for concurrent writes. Two concurrent requests could attempt to create ledger entries for the same account or use the same idempotency key. We need to choose the PostgreSQL transaction isolation level for ledger write operations.

## Decision

### Use `READ COMMITTED` (PostgreSQL default) with a database transaction for ledger writes

Each ledger transaction (`POST /api/ledger/transactions`) runs inside a single PostgreSQL transaction at the default isolation level (`READ COMMITTED`). This means:

- Each statement sees only committed data at the time it starts its snapshot.
- Writes take row-level locks.
- Concurrent writes to the same rows may block but won't corrupt data.

In addition, the account existence check, idempotency check, ledger entry inserts, and event insert all happen within the **same** database transaction. This provides atomicity: either all succeed or none do.

### Why not `SERIALIZABLE`?

`SERIALIZABLE` would prevent phantom reads and write-skew, but it comes at a significant performance cost under concurrent load (serialization failures require retries). The ledger operations here are:

1. Check idempotency key exists
2. Insert ledger entries (different transaction_ids)
3. Insert event
4. Commit

These operations touch distinct, mostly-disjoint rows. `READ COMMITTED` with row-level locking is sufficient because:
- The idempotency key check + insert is the only "hot spot" — and since idempotency keys are unique per client, contention is impossible for distinct clients.
- The accounting equation is validated in application code **before** any SQL is executed.

### Why not advisory locks?

PostgreSQL advisory locks (`pg_advisory_xact_lock`) are useful when you need to serialize a logical operation across multiple rows. We considered using them for per-account balance updates. However:

- We do not yet maintain materialized account balances (balance is computed by aggregation).
- The ledger entries are append-only and never modified — so there's no update-read-update race within a single transaction.
- Advisory locks would add complexity without addressing a concrete race at this stage.

We will revisit advisory locks in Layer 4 if account balance materialization or ledger reconciliation requires them.

## Consequences

- Ledger writes are atomic (all-or-nothing) within a single PostgreSQL transaction.
- Concurrent writes from distinct clients don't interfere.
- If two clients use the same idempotency key, the second one blocks on the unique index until the first commits, then reads the cached response.
- No application-level retry logic is needed for serialization failures (because READ COMMITTED rarely produces them).

## Related ADRs

- ADR 005: Ledger Design and Event Sourcing (transaction schema)
- ADR 002: API Contract Strategy (idempotency key design)