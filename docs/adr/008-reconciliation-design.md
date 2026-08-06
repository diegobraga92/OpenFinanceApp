# ADR 008: Reconciliation Design

**Status:** Accepted

**Date:** 2026-08-06

## Context

Layer 3 adds bank statement reconciliation: a user uploads a CSV from their bank, and the system matches each statement line against existing transactions. We need to decide:

1. The CSV format and parsing approach
2. The matching algorithm (amount/date tolerance, description similarity)
3. How to store reconciliation results
4. What happens to unmatched lines

## Decision

### 1. Simple CSV format: `date,description,amount`

The web UI accepts pasted CSV text with three columns:

```
date,description,amount
2026-08-01,Supermarket,150.00
2026-08-02,Salary,2500.00
```

- `date` is ISO `YYYY-MM-DD`
- `amount` is signed: negative = expense/debit, positive = income/credit
- Quoted fields are supported by the client-side parser
- Lines starting with `#` are ignored as comments

**Rationale:** This is the most common format exported by Brazilian banks (Nubank, Itaú, Bradesco) and is trivially parseable by the client and the backend. The backend deserializes the JSON payload (`ReconciliationUploadRequest` with `lines`), so no file-upload infrastructure is needed in Layer 3.

### 2. Matching algorithm: exact amount + ±1 day date tolerance

The backend matches each statement line against the `transactions` table using:

```sql
WHERE ABS(amount - $1) < 0.01
  AND date BETWEEN $2 - INTERVAL '1 day' AND $2 + INTERVAL '1 day'
```

- Amounts are compared with a 1-cent tolerance (floating-point safety)
- Date tolerance of ±1 day accounts for bank posting delays
- Description matching is NOT used in Layer 3 (see below)

**Rationale:** Amount + date is the strongest signal for personal finance reconciliation. Description matching requires fuzzy logic (normalization, stemming) that adds complexity without much benefit when the user usually knows which transaction a statement line refers to by amount/date alone.

**Future enhancement:** In Layer 4, we plan to add description similarity (via `strsim` or similar) to rank candidate matches when multiple transactions share the same amount/date.

### 3. Reconciliation results stored in dedicated tables

Two new tables store reconciliation runs:

- `reconciliations` — one row per uploaded statement (`statement_name`, `total_rows`, `matched_rows`, `unmatched_rows`, `status`)
- `reconciliation_items` — one row per statement line (`statement_date`, `statement_description`, `statement_amount`, `match_status`, `matched_transaction_id`, `confidence`)

**Rationale:** This preserves the audit trail: a user can see which statement was uploaded, when, and what matched. The `confidence` column is currently a simple value (95% when matched) but is designed to hold a real similarity score when fuzzy matching is added in Layer 4.

### 4. Unmatched lines are preserved, not automatically acted upon

Unmatched statement lines are stored with `match_status = 'unmatched'` and returned in the response. The user sees them highlighted in red on the web UI. The system does NOT automatically create new transactions from unmatched lines.

**Rationale:** Auto-creating transactions from a bank statement without user confirmation is risky (could duplicate transactions). The reconciliation screen is a diagnostic/viewing tool in Layer 3; a "create missing transaction" action can be added in a future layer with explicit user confirmation.

## Consequences

- The reconciliation endpoint accepts JSON (not raw file upload), which simplifies the API contract.
- Matched results give a `transaction_id` reference for traceability.
- Unmatched results remain visible for manual investigation.
- The `confidence` field starts as a fixed value; a real similarity score will replace it when fuzzy matching lands.
- Reconciliation history is queryable via the `reconciliations` table for future reporting/audit.

## Related ADRs

- ADR 005: Ledger Design and Event Sourcing (reconciliation links to transactions which may become ledger transactions)
- ADR 007: Event Publishing via RabbitMQ (future: reconciliation events could be published)