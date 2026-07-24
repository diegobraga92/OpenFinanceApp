# ADR 003: Start with Simple Single-Entry Transactions Before Migrating to Double-Entry

**Status:** Accepted

**Date:** 2026-07-24

**Context:** The initial development plan called for building a full double-entry ledger with event sourcing (Phase 1) as the first functional feature after the project skeleton. However, the core value proposition of a personal finance app is to let users track their income and expenses — something that can be delivered in days with a simple single-entry model, rather than weeks with a full accounting system.

**Decision:** We will start with a simple single-entry transaction tracker (Layer 1) and defer the double-entry ledger, event sourcing, and RabbitMQ to Layer 3.

**Rationale:**

1. **Faster time-to-value** — A working app (add transaction, see balance) can be delivered in ~5-7 days with simple CRUD. The original plan required completing Phase 1 (3-4 weeks) before any user-facing functionality.

2. **Lower risk** — We validate that users find the app useful before investing in the complexity of an immutable double-entry ledger. If the app doesn't meet user needs, we haven't wasted weeks on accounting infrastructure.

3. **Clean migration path** — Single-entry transactions can be migrated to double-entry entries later via a dedicated migration endpoint (`POST /api/migrate/single-to-double`). Each simple transaction (e.g., "Groceries - R$ 50 expense") becomes a pair of ledger entries (debit to Food expense, credit to Cash asset). No data is lost.

4. **Learning progression** — Users (and developers) learn accounting concepts incrementally rather than all at once. The simple tracker builds understanding of categories, balances, and reports before introducing debits, credits, and the accounting equation.

5. **Portfolio story** — The migration itself becomes a compelling portfolio artifact: "I built a simple app, it grew, and here's how I migrated from single-entry to full double-entry without downtime."

**Consequences:**

- Layer 1 uses a simple `transactions` table with `type` (income/expense) and `category_id` instead of a double-entry `ledger_entries` table with accounts, debits, and credits.
- Layer 3 will require a migration endpoint to convert all existing single-entry transactions to double-entry format. This migration should be tested thoroughly.
- The `accounts` table (chart of accounts) and `ledger_entries` table are deferred entirely to Layer 3.
- RabbitMQ is removed from `docker-compose.yml` in Layer 1 and re-added in Layer 3.
- Budgets and reports (Layer 2) are built against the simple schema, then migrated to use the ledger-backed data in Layer 3.

**Related ADRs:**
- ADR 001: Choose Rust and Framework (no change)
- ADR 002: API Contract Strategy (no change)