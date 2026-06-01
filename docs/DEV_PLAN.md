# Finance App – Development Plan (DEV_PLAN.md)

> Personal finance application: Rust (Tokio) backend, React Native mobile, React web.
> Built to financial‑grade reliability, security, and performance standards.
> Immutable double‑entry ledger, event sourcing, deep database engineering.
> All phases are core – this project is about depth, not breadth.

---

## Cross‑Cutting Engineering Practices (applied throughout)

- **Architecture Decision Records (ADRs):** Every significant choice documented in `docs/adr/`
- **Design Documents (RFCs):** Pre‑implementation for ledger, API versioning, threat model, reconciliation
- **Tradeoff Documents:** A `docs/tradeoffs.md` summary linking to ADRs for portfolio reviewers
- **Testing:** Unit, integration, contract, property‑based, and load tests; CI quality gates enforced
- **Observability:** OpenTelemetry traces, Prometheus metrics, structured JSON logs; RED dashboards for API and async consumers
- **SLOs & Error Budgets:** Defined for transaction API (correctness > latency), reporting freshness; alerting on error budget burn
- **Incident Runbooks:** Top failure scenarios (DB corruption, RabbitMQ unavailability, PITR recovery)
- **Blameless Postmortems:** At least one simulated (e.g., double‑spend attempt or replica lag incident)
- **CI/CD & GitOps:** GitHub Actions, containerised deployments, ArgoCD (optional)
- **IaC:** Terraform for RDS, compute; infrastructure documented as code
- **Capacity Planning:** Transaction throughput, storage growth, cost analysis
- **Stakeholder Communication:** README explains trade‑offs to product, compliance, and operations audiences

---

## Security Requirements (Implemented Throughout)

- **Threat Model:** STRIDE analysis of ledger, API, mobile client; `docs/security/threat-model.md`
- **Authentication & Authorisation:** OAuth2 / JWT with refresh, RBAC (user / admin), middleware‑enforced
- **Audit Logs:** Immutable audit trail for all financial transactions and permission changes; stored alongside ledger events
- **Encryption:** At rest (PostgreSQL TDE or file‑level) and in transit (TLS 1.3 everywhere)
- **Secrets Management:** Environment variables / Vault; rotation procedure documented and tested
- **Rate Limiting:** API‑level, per‑user, preventing abuse
- **Dependency & Container Scanning:** `cargo audit`, Trivy in CI; block critical vulns
- **Input Validation & Sanitisation:** Strict server‑side validation for all monetary amounts

---

## Phase 0 – Project Skeleton, Infrastructure & CI/CD (2–3 days)

**Goal:** Working “hello world” Rust backend, scaffolded clients, PostgreSQL and RabbitMQ running locally.

- [ ] Repository: monorepo with `backend/`, `web/`, `mobile/`, `api/`, `docker-compose.yml`
- [ ] Backend (Rust + Tokio + Axum): `/health` endpoint, PostgreSQL connection pool, structured tracing/logging, graceful shutdown
- [ ] Database: initial PostgreSQL schema for accounts, migrations (sqlx or refinery)
- [ ] RabbitMQ: single broker in Docker Compose (management plugin enabled)
- [ ] Web (React + TypeScript + Vite): scaffold, call `/health`, display connection status
- [ ] Mobile (React Native): scaffold, single screen calling `/health`
- [ ] API contracts: first OpenAPI spec (`api/openapi/health.yaml`), contract‑first workflow established
- [ ] Infrastructure: Terraform for RDS Postgres, compute (EKS or simpler)
- [ ] CI/CD: GitHub Actions workflows (build, test, lint, container build) for each platform
- [ ] Observability seed: request tracing (OpenTelemetry), Prometheus `/metrics`, basic logging structure
- [ ] SLO draft: availability target for `/health` (e.g., 99.9%), `docs/slo.md`
- [ ] ADR: `001-choose-rust-and-framework.md`

---

## Phase 1 – Core Ledger: Double‑Entry Accounting with Event Sourcing (3–4 weeks)

**Goal:** Immutable, auditable double‑entry ledger. All state changes captured as events.

- [ ] API design: `api/openapi/transactions-v1.yaml` (POST /transactions, GET /transactions, GET /accounts)
- [ ] Domain model:
  - [ ] Accounts (assets, liabilities, equity, income, expenses) – chart of accounts
  - [ ] Transactions: every entry is a debit to one account and credit to another
  - [ ] Enforce accounting equation (debits = credits) at database level
- [ ] Database:
  - [ ] Ledger entries table: immutable append‑only, with transaction ID, account, amount, timestamp
  - [ ] Account balances as materialised views or derived with caching
  - [ ] Advisory locks or optimistic concurrency for balance updates
- [ ] Event sourcing:
  - [ ] `TransactionRecorded` events stored in immutable events table
  - [ ] Current state reconstructed from events or via materialised views
  - [ ] Publish events to RabbitMQ exchange `finance.ledger.transactions` (fanout) for downstream consumers (reporting, audit)
- [ ] Idempotency:
  - [ ] Idempotency key per transaction request (client‑generated UUID), enforced in DB and message deduplication
  - [ ] ADR: `002-idempotency-design.md`
- [ ] Concurrency: test concurrent transfers; ensure no double‑spend or lost updates
- [ ] Testing:
  - [ ] Property‑based tests: random transactions must keep total debits == total credits
  - [ ] Integration tests with Testcontainers (PostgreSQL) and RabbitMQ test container
  - [ ] Contract tests verifying API matches OpenAPI
- [ ] Audit log: each transaction event includes actor ID, timestamp, idempotency key; stored immutably
- [ ] ADRs: `003-ledger-design-and-event-sourcing.md`, `004-isolation-level-choice.md`, `005-event-publishing-via-rabbitmq.md`

---

## Phase 2 – Budgets, Categories, Reporting & Reconciliation (3–4 weeks)

**Goal:** Rich financial management features and a reconciliation process that mirrors real‑world fintech.

- [ ] APIs: `api/openapi/categories-v1.yaml`, `api/openapi/budgets-v1.yaml`, `api/openapi/reports-v1.yaml`, `api/openapi/reconciliation-v1.yaml`
- [ ] Backend:
  - [ ] Categories: hierarchical tags linked to transactions
  - [ ] Budgets: monthly limits per category, alerts on overrun
  - [ ] Reports: income/expense summaries, trend data, budget vs actual
- [ ] Async notifications:
  - [ ] When budget overrun detected, publish event to RabbitMQ exchange `finance.budgets.alerts`
  - [ ] Consumer service reads from queue and sends email/push notification (Mailpit for dev)
- [ ] Reconciliation process:
  - [ ] Design external statement format (CSV: date, description, amount)
  - [ ] Reconciliation service: accepts uploaded statement file, matches transactions by amount/date within tolerance
  - [ ] Produces reconciliation result (matched, unmatched, discrepancies) stored in DB
  - [ ] Reconciliation status viewable in web dashboard
  - [ ] ADR: `006-reconciliation-design.md`
- [ ] Database: efficient aggregate queries; indexing on transaction dates, categories; `EXPLAIN ANALYZE` for key reports
- [ ] Web: budget management page, report dashboard (charts), reconciliation upload page
- [ ] Mobile: category assignment on transaction entry, budget progress bars
- [ ] Observability: add business metrics (transaction volume, budget alert count, reconciliation success rate)

---

## Phase 3 – Observability, Performance & Database Engineering (2–3 weeks)

**Goal:** Full production visibility, proven performance, deep database optimisation, and real‑time reporting.

- [ ] OpenTelemetry: trace IDs propagated across HTTP and RabbitMQ message headers
- [ ] Prometheus metrics: request duration, ledger event processing rate, connection pool stats, lock waits, RabbitMQ queue depths
- [ ] Grafana dashboards: RED metrics per API, ledger health, PostgreSQL overview, RabbitMQ consumer health
- [ ] Structured logging: JSON, trace ID per line

### Database Performance Deep‑Dive

- [ ] `EXPLAIN ANALYZE` for top queries: transaction insertion, balance retrieval, report aggregates, reconciliation matching
- [ ] Index tuning: add/remove indexes based on query patterns; document before/after
- [ ] Connection pooling (e.g., `sqlx` pool options): tune max connections, timeout; benchmark
- [ ] Isolation level comparison: run concurrent transfer test under `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`; document anomalies and final choice
- [ ] MVCC behaviour: demonstrate tuple visibility, vacuum impact with high insert rates
- [ ] Benchmark comparison report: comprehensive `docs/database-performance.md` with charts and recommendations

### Real‑Time Reporting via RabbitMQ

- [ ] Reporting service: consume `finance.ledger.transactions` fanout exchange, build read‑optimised materialised views (e.g., daily summary table)
- [ ] Demonstrate eventual consistency: define freshness SLO (e.g., < 5 seconds lag)
- [ ] Monitor consumer queue depth and processing rate in Grafana

- [ ] Performance profiling: CPU flamegraphs (perf / `pprof-rs`), memory profiling; identify and fix hotspots
- [ ] Load testing: k6 scripts simulating 100+ concurrent users; measure P50/P95/P99 latency, throughput
- [ ] SLO refinement: set specific latency and error budget targets for transaction and report APIs

---

## Phase 4 – Security Hardening & Audit Investigation Dashboard (1–2 weeks)

**Goal:** Demonstrate security maturity and provide operational visibility into the audit trail.

- [ ] Threat model: complete STRIDE document, identify mitigations
- [ ] Authentication: OAuth2 (Google/Apple sign‑in) or JWT with refresh tokens; secure storage on mobile
- [ ] RBAC: admin vs user roles; admin can view all accounts, user only own
- [ ] Rate limiting: per‑user rate limits on API endpoints
- [ ] Input validation: strict server‑side validation for all monetary fields
- [ ] Encryption audit: verify TLS 1.3 everywhere, data at rest encryption enabled on RDS
- [ ] Secrets rotation: documented procedure; rotate DB credentials and JWT key, test continuity
- [ ] Dependency scanning: `cargo audit`, Trivy for Docker images; block high/critical findings
- [ ] Audit log verification: ensure every financial change is recorded and immutable

### Audit Investigation Dashboard

- [ ] Admin‑only API: search/filter audit events by user, action, resource, date range
- [ ] Web dashboard: simple table view with filters, export capability
- [ ] Link audit events to original transaction events for full traceability
- [ ] Runbook: how to investigate suspicious activity using the dashboard

---

## Phase 5 – Disaster Recovery, Reliability, Read Replicas & Chaos (1–2 weeks)

**Goal:** Prove the system survives real‑world failures with minimal data loss.

- [ ] Backup & recovery: Point‑In‑Time Recovery (PITR) for PostgreSQL, automated backups, test full restore
  - [ ] Measure RTO and RPO, document in `docs/dr-test.md`
- [ ] Backup testing: schedule automated restore test (or simulated manual)
- [ ] Read replica experiments:
  - [ ] Provision a read replica, route report queries to it
  - [ ] Measure replication lag under load; document impact on freshness SLO
  - [ ] Simulate replica failure and promotion; measure failover time, document in ADR
- [ ] Failure simulations:
  - [ ] Kill primary DB; verify application handles failover gracefully
  - [ ] Simulate disk full / connection exhaustion; test timeout behaviour
  - [ ] Network latency injection between app and DB; verify retry logic
  - [ ] Stop RabbitMQ; verify that pending events are not lost and processing resumes after recovery (durable queues, persistent messages)
- [ ] Chaos experiment: under load, randomly terminate backend pods; verify no double transactions or lost events, RabbitMQ consumer recovery without gaps
- [ ] Runbook: detailed steps for database recovery, RabbitMQ recovery, failover
- [ ] Blameless postmortem: `docs/postmortems/001-replica-lag-incident.md` (simulated)

---

## Phase 6 – Mobile & Web Production Polish, API Deprecation Strategy (2–3 weeks)

**Goal:** Cross‑platform feature parity, polished UX, and lifecycle management.

- [ ] Web: full transaction entry, budget management, reports with interactive charts, reconciliation page, audit dashboard (admin), responsive design
- [ ] Mobile (React Native):
  - [ ] Transaction list, add transaction, view accounts, budget tracking
  - [ ] Offline support: queue transaction creation locally, sync when online (with conflict resolution)
  - [ ] Secure storage for auth tokens
  - [ ] Push notifications for budget alerts
- [ ] API versioning: implement URI or header‑based versioning
- [ ] **API deprecation strategy:**
  - [ ] Document policy: `Sunset` headers, advance notice (e.g., 90 days), communication plan
  - [ ] Simulate a v1→v2 migration (even if no actual v2): show how old endpoints return `Deprecation` header and documented sunset date
  - [ ] ADR: `007-api-deprecation-strategy.md`
- [ ] Generated API clients: TypeScript client from OpenAPI for web; use OpenAPI to generate types for mobile network layer
- [ ] Performance: Lighthouse audits for web, bundle analysis, mobile app size optimisation

---

## Phase 7 – Cost Awareness, Capacity Planning & Portfolio Artifacts (1 week)

**Goal:** Show you can operate the service economically and present it compellingly.

- [ ] Cost analysis:
  - [ ] Monthly AWS cost estimate (RDS, compute, S3, network)
  - [ ] Scaling cost projection (1k, 10k, 100k users; storage growth from ledger entries)
  - [ ] Cost optimisation opportunities (reserved instances, Arm, spot for dev)
- [ ] Capacity planning: transaction throughput vs instance size, storage IOPS requirements, RabbitMQ queue and connection sizing; write `docs/capacity-plan.md`
- [ ] Final documentation:
  - [ ] Architecture diagram (C4 model)
  - [ ] `README.md` with demo, setup, stakeholder guide
  - [ ] All ADRs, runbooks, postmortems, performance reports linked
  - [ ] `docs/tradeoffs.md` – summary of key architectural trade‑offs with links to ADRs
- [ ] Portfolio demo: short screen recording, live deployment (if feasible with synthetic data)

---

## Completion Checklist – Finance App

- [ ] Immutable double‑entry ledger with event sourcing and event publishing to RabbitMQ
- [ ] Idempotency keys enforced; ADR written
- [ ] Concurrent transfer correctness proven (property tests, isolation level documentation)
- [ ] Budgets, reports, reconciliation process functional on web and mobile
- [ ] Real‑time reporting via RabbitMQ fanout exchange; consumer health monitored
- [ ] Full observability: traces, metrics, logs, RED dashboards, SLOs
- [ ] Database performance deep‑dive completed and documented (benchmark comparison report)
- [ ] Threat model, RBAC, audit logging, encryption, secrets rotation verified
- [ ] Audit investigation dashboard built (admin)
- [ ] PITR backup and restore tested; RTO/RPO measured
- [ ] Read replica experiments: lag measurement, failover simulation
- [ ] Chaos experiment and incident postmortem written
- [ ] Load testing with k6, performance profiling (flamegraphs), optimisation applied
- [ ] Rate limiting, dependency/container scanning, CI security gates
- [ ] API deprecation strategy documented and simulated
- [ ] Mobile offline support with sync (optional but recommended)
- [ ] Cost estimate, capacity plan, and tradeoff summary documented
- [ ] Portfolio artifacts: architecture diagram, ADRs, runbooks, postmortems, demo video