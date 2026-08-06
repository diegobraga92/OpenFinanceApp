# Tradeoffs Summary

> One-page summary of key technical decisions, alternatives considered, and lessons learned.
> Layer 4 final documentation.

---

## Key Decisions & Alternatives

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Backend framework | Rust + Axum (Tokio) | Go, Node, Django | Performance, type safety, study value (ADR 001) |
| DB schema | Single-entry → double-entry ledger | Full double-entry from day one | Working app first; clean migration path (ADR 003, 005) |
| Event sourcing | DB `events` table (source of truth) + RabbitMQ fanout | Transactional outbox pattern | Simplicity; outbox can be layered later (ADR 007) |
| Idempotency | `idempotency_keys` table (24h) | Client-generated request IDs only | Server-side dedup at Layer 3 (ADR 002) |
| Budget alerts | Computed on-read via summary endpoint | Event-driven background worker | No worker needed at single-user scale (ADR 004) |
| Isolations | READ COMMITTED for ledger writes | SERIALIZABLE + retries | Atomic tx + row locks sufficient; fewer retry loops (ADR 006) |
| Reconciliation | JSON payload, amount + date ±1 day | CSV upload + fuzzy description match | Simple, works for Brazilian bank exports; fuzzy planned later (ADR 008) |
| Receipt scanner | NFC-e QR parsing only (no OCR) | Tesseract OCR pipeline | QR covers ~90% of Brazilian receipts; OCR heavy (per user decision) |
| Auth | OAuth2/JWT + Argon2id, user/admin RBAC | API keys | Study value; matches original plan (overengineering OK for study) |
| Rate limiting | In-memory fixed-window (tower) | Redis token bucket | No infra dependency; per-IP sufficient for single user |
| Metrics | metrics-rs + Prometheus exporter | OpenTelemetry metrics only | Simple, standard Prometheus format |
| API versioning | Implicit v1 + `/api/v2/...` + Sunset headers | Path-only versioning | RFC-standard Sunset/Deprecation/Link headers (ADR 009) |
| Events broker failure | Degrade gracefully (log + store in DB) | Block writes / retry queue | DB is source of truth; app stays functional during broker outage |

---

## Lessons Learned

1. **`SMALLINT` vs `i32` type mismatch** in sqlx cost real debugging time — use `::int` casts or align Rust types with PG types early.
2. **`lapin` API changed** between docs and 2.5.x — `create_channel()` + `basic_publish` + `PublisherConfirm` required careful adaptation.
3. **OAuth2 is more work than it appears** — even a simplified JWT flow spans config, middleware, request structs, OpenAPI schemas, and frontend clients.
4. **Receipt parsing without OCR is dramatically simpler** and covers most real-world use for Brazilian NFC-e receipts.
5. **Frontend type-safety** (openapi-typescript) catches API contract drift immediately — regenerate types after every backend schema change.

---

## What Was Cut / Deferred (Honestly)

- **OCR pipeline** (Tesseract) — deferred by user decision; QR-only implemented
- **PITR WAL archiving** — documented + simulated, not fully implemented (needs config change in compose)
- **Read replica** — documented as Docker simulation; not a running service
- **Cost/DR chaos** — scripts and docs provided, but not run against a live multi-node cluster
- **Mobile camera/QR screen** — receipt screen pending; web UI complete
- **trivy** — CI step added, but requires trivy binary to run
- **C4/README final polish** — C4 + capacity + tradeoffs now written; README refresh still pending

---

## Final Reflection

The project demonstrates a realistic evolution: simple single-entry tracking → structured budgeting/reports → immutable double-entry ledger with event sourcing → production hardening (auth, observability, DR, receipt scanning). Each layer kept a working app, documented decisions via ADRs, and preserved backward compatibility. This mirrors how real financial systems are built incrementally.