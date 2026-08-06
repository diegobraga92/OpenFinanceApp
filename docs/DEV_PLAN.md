# PudimFinance – Development Plan (DEV_PLAN.md)

> Personal finance application: Rust (Tokio) backend, React Native mobile, React web.
> Built incrementally — a working app at every layer, progressively adding sophistication.

---

## Guiding Principles

1. **Working app first** — each layer is usable on its own, no feature requires waiting months
2. **Complexity deferred** — double-entry ledgers, event sourcing, and RabbitMQ are added only when the simple version proves valuable
3. **All original features preserved** — nothing from the original 8-phase plan is cut, just reordered
4. **Portfolio-ready foundation** — Phase 0 skeleton (health endpoint, tracing, metrics, CI/CD) stays as-is

---

## Cross‑Cutting Engineering Practices (applied throughout all layers)

- **Architecture Decision Records (ADRs):** Every significant choice documented in `docs/adr/`
- **Testing:** Unit, integration, and (where applicable) property-based tests; CI quality gates enforced
- **Observability:** OpenTelemetry traces, Prometheus metrics, structured JSON logs (Phase 0 already in place)
- **CI/CD & GitOps:** GitHub Actions, containerised deployments (already in place)
- **Input Validation & Sanitisation:** Strict server-side validation for all monetary amounts

---

## Layer 1 — Simple Transaction Tracker (working app in ~5-7 days)

**Goal:** Record income/expenses, see balance, manage categories. No accounting theory. No event sourcing. No message broker.

### What we build

- **Database (new migration `001_initial_categories_and_transactions.sql`):**
  - `categories` table: name, type (income/expense), icon, color, optional parent_id for subcategories
  - `transactions` table: description, amount, type (income/expense), category_id, date, notes
  - Seed default categories (Salary, Food & Groceries, Housing, etc.)
- **Backend CRUD endpoints (Rust + Axum):**
  - `GET /api/categories` — list categories (filterable by type)
  - `POST /api/categories` — create category
  - `GET /api/transactions` — paginated list with filters (category, date range, type)
  - `POST /api/transactions` — create transaction (income or expense)
  - `GET /api/transactions/{id}` — single transaction detail
  - `PUT /api/transactions/{id}` — update transaction
  - `DELETE /api/transactions/{id}` — delete transaction
  - `GET /api/summary` — current month totals (income, expense, balance), grouped by category
- **Web (React + TypeScript + Vite):**
  - Dashboard: balance card, income/expense summary, recent transaction list
  - Transaction list page: sortable, filterable table with category badges
  - Add/edit transaction form: amount, description, category picker (type-aware), date picker
  - Category management page: create/edit/delete, color picker, icon selector
  - Basic responsive layout
- **Mobile (React Native):**
  - Dashboard screen: balance card, mini summary, recent transactions
  - Transaction list screen: scrollable list with category icons
  - Add transaction screen: form with category picker
  - Basic tab navigation (Dashboard, Transactions, Categories)
- **Infrastructure simplification:**
  - RabbitMQ removed from `docker-compose.yml` (re-added in Layer 3)
  - Backend environment variables cleaned up (no RABBITMQ_URL needed)
  - Deployment simplified to Postgres + Backend + Web

### Deliverables

- [x] Migration `001_initial_categories_and_transactions.sql` applied and working
- [x] All CRUD endpoints functional, documented in OpenAPI
- [x] Web dashboard showing income/expense/balance for current month
- [x] Mobile app with basic transaction tracking
- [x] ADR `003-start-simple-single-entry.md` (decision record)

---

## Layer 2 — Budgets, Reports & Insights (1-2 weeks)

**Goal:** Monthly budgets per category, spending trends, visual reports on web and mobile.

### What we build

- **Database additions (migration 002):**
  - `budgets` table: category_id, month/year, amount limit
  - `budget_alerts` table: budget_id, triggered_at, threshold (e.g., 80%, 100%)
- **Backend endpoints:**
  - `GET /api/budgets` — list budgets for a given month/year
  - `POST /api/budgets` — create or update budget
  - `GET /api/reports/monthly` — income/expense summary for selected month(s)
  - `GET /api/reports/category-breakdown` — spending breakdown by category for a period
  - `GET /api/reports/trends` — monthly trends over time (last 6/12 months)
  - `GET /api/budgets/summary` — budget vs actual for current month
- **Web:**
  - Budget management page: set/monthly limits per category, progress bars
  - Reports dashboard: line charts (trends), pie/bar charts (category breakdown), period comparison
  - Budget alert notifications (in-app, simple overlay/toast)
- **Mobile:**
  - Budget screen: category progress bars, overrun highlighting
  - Reports screen: simplified charts (using `react-native-chart-kit` or similar)

### Deliverables

- [x] Budget CRUD functional on web and mobile
- [x] Monthly reports with charts on web
- [x] Budget vs actual tracking with visual indicators
- [x] ADR `004-budget-system-design.md` (if significant decisions made)

---

## Layer 3 — Double-Entry Ledger, Event Sourcing & Reconciliation (3-4 weeks)

**Goal:** Migrate from simple single-entry to immutable double-entry accounting. This is where the original Phase 1-2 concepts land. All existing data is migrated seamlessly.

### What we build

- **Database additions (migration 003):**
  - `accounts` table: chart of accounts (asset, liability, equity, income, expense) from original design
  - `ledger_entries` table: immutable append-only, transaction_id, account, debit_amount, credit_amount, timestamp
  - `events` table: event sourcing — `TransactionRecorded` events stored immutably
  - Balance materialised view or derived via aggregation
- **Backend:**
  - Double-entry transaction creation: enforce accounting equation (debits = credits)
  - Idempotency keys for all transaction requests (original design preserved)
  - Advisory locks or optimistic concurrency for balance updates
  - **Migration endpoint**: `POST /api/migrate/single-to-double` — converts all existing single-entry transactions into proper double-entry pairs
  - Publish `TransactionRecorded` events to RabbitMQ fanout exchange `finance.ledger.transactions`
- **RabbitMQ re-introduced:**
  - Added back to `docker-compose.yml` with durable queues
  - Event publishing for downstream consumers (reporting, audit)
  - RabbitMQ health check and reconnection logic
- **Reconciliation (original Phase 2 feature):**
  - External statement upload (CSV)
  - Reconciliation service: match transactions by amount/date within tolerance
  - Reconciliation result stored in DB, viewable on web
- **Backward compatibility:**
  - Old simple `GET /api/summary` and `GET /api/transactions` endpoint continue working (backed by ledger data)
  - New ledger-specific endpoints added without breaking existing clients

### Deliverables

- [x] Migration 003 applies cleanly, existing data preserved
- [x] Double-entry transaction creation (debits = credits enforced)
- [x] Idempotency key enforcement (ADR 002 design)
- [x] RabbitMQ event publishing for new transactions
- [x] Reconciliation process functional
- [x] Event sourcing: `TransactionRecorded` events, state reconstructed from events
- [x] ADRs: `005-ledger-design-and-event-sourcing.md`, `006-isolation-level-choice.md`, `007-event-publishing-via-rabbitmq.md`, `008-reconciliation-design.md`

---

## Layer 4 — Hardening, Security & Advanced Features (3-4 weeks)

**Goal:** Production readiness, security hardening, disaster recovery, observability deep-dive, and the receipt scanner.

This layer consolidates the original Phases 3-8. Every feature from the original plan is included.

### What we build

- **Observability Deep-Dive (original Phase 3):**
  - OpenTelemetry trace propagation across HTTP and RabbitMQ message headers
  - Prometheus metrics: request duration, ledger event processing rate, lock waits, RabbitMQ queue depths
  - Grafana dashboards: RED metrics, PostgreSQL overview, consumer health
  - Structured JSON logging with trace IDs
  - Database performance: `EXPLAIN ANALYZE` for top queries, index tuning, isolation level comparison
  - Load testing with k6, P50/P95/P99 latency targets
  - SLO refinement and error budget tracking
  - `docs/database-performance.md` with before/after benchmarks

- **Security Hardening (original Phase 4):**
  - STRIDE threat model document (`docs/security/threat-model.md`)
  - OAuth2 / JWT with refresh tokens, RBAC (user / admin)
  - Rate limiting per-user on API endpoints
  - Input validation hardening for all monetary fields
  - TLS 1.3 (terminated at reverse proxy / load balancer)
  - Secrets rotation procedure documented and tested
  - `cargo audit` and Trivy container scanning in CI
  - CORS and CSRF hardening

- **Audit Investigation Dashboard (original Phase 4):**
  - Admin-only API to search/filter audit events (by user, action, resource, date range)
  - Web dashboard: table view with filters, export capability
  - Full traceability from audit event to original transaction events

- **Disaster Recovery & Chaos (original Phase 5):**
  - Point-In-Time Recovery (PITR) for PostgreSQL, automated backups, restore testing
  - RTO/RPO measurement documented in `docs/dr-test.md`
  - Read replica experiments: provision, measure lag under load, simulate failover
  - Failure simulations: kill primary DB, disk full, network latency, RabbitMQ outage
  - Chaos experiment: randomly terminate pods under load, verify no data loss
  - Runbooks for DB recovery, RabbitMQ recovery, failover
  - Blameless postmortem: `docs/postmortems/001-replica-lag-incident.md` (simulated)

- **Receipt Scanner & Price Tracking (original Phase 8):**
  - `stores`, `receipts`, `receipt_items`, `normalized_products` tables
  - OCR pipeline via `leptess` (Tesseract bindings) with Portuguese language data
  - Image preprocessing (contrast, deskew, denoise) before OCR
  - NFC-e QR parsing (extract store CNPJ, date, total as OCR hint)
  - Item name fuzzy matching via `strsim` crate (auto-merge > 0.85, suggest 0.60-0.85)
  - Web: upload page with drag-and-drop, OCR result review, gallery
  - Mobile: camera capture, QR scanner, receipt review/edit flow
  - Price history charts (line charts, heatmap, store comparison)
  - Product normalisation dashboard (merge/split interface)
  - OCR accuracy benchmarked against annotated Brazilian receipt dataset
  - PII scrubbing on receipt images, encryption at rest

- **API Deprecation Strategy (original Phase 6):**
  - Documented policy: `Sunset` headers, advance notice, communication plan
  - Simulate v1→v2 migration with deprecation headers and sunset dates
  - ADR: `013-api-deprecation-strategy.md`

- **Cost Awareness & Portfolio Artifacts (original Phase 7):**
  - Monthly AWS cost estimate and scaling projections
  - Capacity planning document (`docs/capacity-plan.md`)
  - Architecture diagram (C4 model)
  - Final documentation: README, all ADRs, runbooks, postmortems, tradeoffs summary

### Deliverables

- [ ] All observability: traces, metrics, dashboards, SLOs, performance report
- [ ] Security: threat model, auth/RBAC, rate limiting, dependency scanning
- [ ] Audit dashboard functional on web
- [ ] DR: PITR tested, read replica experiments, chaos exercise, runbooks
- [ ] Receipt scanner pipeline working (photo → structured line items)
- [ ] Price history and trend charts on web and mobile
- [ ] API deprecation strategy documented and simulated
- [ ] Cost analysis, capacity plan, architecture diagram, final documentation

---

## Completion Checklist — PudimFinance

- [x] Phase 0: project skeleton, health endpoint, PostgreSQL, CI/CD, OpenAPI, ADRs 001-002
- [x] Layer 1: simple income/expense tracking (categories + transactions) on web and mobile
- [x] ADR 003: start-simple-single-entry
- [x] Layer 2: budgets, monthly reports, charts on web and mobile
- [x] ADR 004: budget-system-design
- [x] Layer 3: double-entry ledger, event sourcing, RabbitMQ, reconciliation
- [x] ADRs 005-008: ledger, isolation, event publishing, reconciliation
- [ ] Layer 4: observability deep-dive, security hardening, audit dashboard
- [ ] Layer 4: DR, PITR, read replica experiments, chaos exercises, runbooks
- [ ] Layer 4: receipt scanner and price tracking (full pipeline)
- [ ] Layer 4: API deprecation strategy simulated
- [ ] Layer 4: cost analysis, capacity plan, architecture diagram, final docs

---

## What Changed from the Original Plan

| Original | New Location | Reason |
|----------|-------------|--------|
| Phase 0 (skeleton, health, CI) | ✅ Done, unchanged | Solid foundation, keep as-is |
| Phase 1 (double-entry ledger, event sourcing) | **Layer 3** | Deferred until simple version proves valuable |
| Phase 2 (budgets, reports, reconciliation) | **Layer 2** (budgets/reports) + **Layer 3** (reconciliation) | Budgets don't need double-entry; reconciliation does |
| Phase 3 (observability deep-dive) | **Layer 4** | Not needed until system has real usage |
| Phase 4 (security, audit dashboard) | **Layer 4** | Security hardening after features are stable |
| Phase 5 (DR, chaos) | **Layer 4** | Production readiness after core is solid |
| Phase 6 (polish, API deprecation) | **Layer 4** | Maturity features for stable API |
| Phase 7 (cost, portfolio artifacts) | **Layer 4** | Final step before portfolio presentation |
| Phase 8 (receipt scanner) | **Layer 4** | Standalone feature, independent of other layers |

Nothing was removed. Everything was reordered so you have a working app from day one.