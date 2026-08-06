-- Layer 4: Observability & performance improvements

-- Composite index for date-range + type filtering (the most common aggregation pattern)
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions (date DESC, type);

-- Composite index for summary/report queries grouped by date
CREATE INDEX IF NOT EXISTS idx_transactions_date_only ON transactions (date DESC);

-- Composite index for ledger entry queries filtering by account + time range
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_date ON ledger_entries (account_id, recorded_at DESC);

-- Support index for reconciliation matching (amount + date)
CREATE INDEX IF NOT EXISTS idx_transactions_amount_date ON transactions (amount, date);
</content>
<task_progress>
- [ ] Sub-Phase 4a: DB indexes migration
- [ ] Sub-Phase 4a: Custom Prometheus metrics
- [ ] Sub-Phase 4a: docker-compose Prometheus + Grafana
- [ ] Sub-Phase 4a: Grafana dashboard JSON
- [ ] Sub-Phase 4a: docs/database-performance.md + SLO update
- [ ] Sub-Phase 4a: k6 load test script
- [ ] Sub-Phase 4b-4e: (deferred to subsequent sessions)</｜｜DSML｜｜>

<write_to_file>
<path>backend/migrations/004_observability_indexes.sql</path>
<content>-- Layer 4: Observability & performance improvements

-- Composite index for date-range + type filtering (the most common aggregation pattern)
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions (date DESC, type);

-- Composite index for summary/report queries grouped by date
CREATE INDEX IF NOT EXISTS idx_transactions_date_only ON transactions (date DESC);

-- Composite index for ledger entry queries filtering by account + time range
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_date ON ledger_entries (account_id, recorded_at DESC);

-- Support index for reconciliation matching (amount + date)
CREATE INDEX IF NOT EXISTS idx_transactions_amount_date ON transactions (amount, date);