# Service Level Objectives (SLOs)

> Phase 0 draft — these targets will be refined as production data becomes available.

---

## Health Check API (`GET /health`)

| Metric | Target | Measurement | Window |
|--------|--------|-------------|--------|
| Availability | **99.9%** | Uptime of `/health` endpoint returning 200 | 30 days rolling |
| Latency (P50) | **< 10ms** | Time to respond with health status | 5 minutes |
| Latency (P99) | **< 50ms** | Time to respond with health status | 5 minutes |

### Error Budget

- **Total budget:** ~43 minutes of downtime per 30-day window
- **Consumption alert:** 50% of budget consumed (notified to #ops channel)
- **Burn rate alert:** > 2x error budget burn rate over 1 hour (paged)

### Measurement

- Prometheus blackbox exporter probes every 15 seconds
- Dashboard: Grafana with availability burn-rate panels
- Alerting: Alertmanager on error budget burn rate

---

## Layer 4 SLOs (current architecture)

| API | Availability | P50 Latency | P95 Latency | P99 Latency |
|-----|-------------|-------------|-------------|-------------|
| `GET /health` | 99.9% | < 5ms | < 10ms | < 50ms |
| `GET /metrics` | 99.9% | < 5ms | < 10ms | < 50ms |
| `GET /api/categories` | 99.9% | < 10ms | < 50ms | < 200ms |
| `POST /api/categories` | 99.95% | < 20ms | < 50ms | < 100ms |
| `GET /api/transactions` | 99.9% | < 50ms | < 150ms | < 300ms |
| `POST /api/transactions` | 99.95% | < 30ms | < 100ms | < 200ms |
| `PUT /api/transactions/{id}` | 99.95% | < 30ms | < 100ms | < 200ms |
| `DELETE /api/transactions/{id}` | 99.95% | < 30ms | < 100ms | < 200ms |
| `GET /api/summary` | 99.9% | < 50ms | < 150ms | < 300ms |
| `GET /api/budgets` | 99.9% | < 30ms | < 100ms | < 200ms |
| `POST /api/budgets` | 99.95% | < 30ms | < 100ms | < 200ms |
| `GET /api/budgets/summary` | 99.9% | < 50ms | < 150ms | < 300ms |
| `GET /api/reports/monthly` | 99.5% | < 100ms | < 300ms | < 1s |
| `GET /api/reports/category-breakdown` | 99.5% | < 100ms | < 300ms | < 1s |
| `GET /api/reports/trends` | 99.5% | < 100ms | < 300ms | < 1s |
| `POST /api/ledger/transactions` | 99.95% | < 50ms | < 150ms | < 300ms |
| `GET /api/ledger/accounts` | 99.9% | < 10ms | < 50ms | < 100ms |
| `GET /api/ledger/transactions` | 99.9% | < 50ms | < 150ms | < 300ms |
| `POST /api/migrate/single-to-double` | 99.0% | < 1s | < 5s | < 10s |
| `POST /api/reconciliation` | 99.0% | < 500ms | < 2s | < 5s |
| `GET /api/audit/events` (admin) | 99.5% | < 100ms | < 300ms | < 1s |
| `POST /api/receipts/*` (future) | 99.0% | < 1s | < 3s | < 5s |

---

## Key Performance Indicators (KPIs)

| KPI | Target | Purpose |
|-----|--------|---------|
| Transaction success rate | > 99.99% | No lost or duplicate transactions |
| Idempotency hit rate | < 5% retries | Clients using idempotency keys correctly |
| Reconciliation accuracy | 100% matched | All uploaded statements reconcile within tolerance |
| Budget alert latency | < 30 seconds | Alert fires within 30s of budget overrun |

---

## Reporting

- SLO compliance reported weekly in `#ops` channel
- Monthly SLO review meeting (5 minutes)
- Exception process: any missed SLO requires a blameless postmortem and corrective action plan