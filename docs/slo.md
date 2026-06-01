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

## Planned SLOs (Phases 1+)

These targets are documented now for future implementation:

| API | Availability | P50 Latency | P99 Latency | Freshness |
|-----|-------------|-------------|-------------|-----------|
| `POST /transactions` | 99.95% | < 30ms | < 100ms | — |
| `GET /transactions` | 99.9% | < 50ms | < 200ms | — |
| `GET /accounts` | 99.9% | < 20ms | < 100ms | — |
| Report queries | 99.5% | < 500ms | < 2s | — |
| Real-time dashboards | 99.0% | < 1s | < 5s | < 5s lag |

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