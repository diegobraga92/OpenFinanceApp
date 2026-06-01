# 🏦 PudimFinance

> Personal finance application with an immutable double-entry ledger, event sourcing, and real-time reporting.
> Built to financial‑grade reliability, security, and performance standards.

**Tech Stack:** Rust (Tokio + Axum) backend · React (Vite) web · React Native (Expo) mobile · PostgreSQL · RabbitMQ

---

## Project Structure

```
PudimFinance/
├── backend/           # Rust + Axum API server
│   ├── src/           # Source code (routes, database, telemetry)
│   └── migrations/    # PostgreSQL migrations (sqlx)
├── web/               # React + TypeScript + Vite frontend
├── mobile/            # React Native + Expo mobile app
├── api/
│   └── openapi/       # OpenAPI 3.1 contract specifications
├── infra/             # Terraform infrastructure-as-code (AWS)
├── .github/
│   └── workflows/     # CI/CD pipelines (GitHub Actions)
├── docker-compose.yml # Local development environment
└── docs/
    ├── adr/           # Architecture Decision Records
    ├── DEV_PLAN.md    # Full development plan (all phases)
    └── slo.md         # Service Level Objectives
```

---

## Quickstart

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [Rust](https://rustup.rs/) (1.78+) for local backend development
- [Node.js](https://nodejs.org/) (20+) for web/mobile
- [Expo CLI](https://docs.expo.dev/get-started/installation/) for mobile

### Local Development (Docker)

```bash
# Start all services (PostgreSQL, RabbitMQ, backend, web)
docker compose up --build

# Services:
#   Backend API:  http://localhost:3000/health
#   Web UI:       http://localhost:5173
#   RabbitMQ UI:  http://localhost:15672 (pudim / pudim)
```

### Backend (local, without Docker)

```bash
cd backend
cp ../.env.example .env
cargo run
```

### Web (local, without Docker)

```bash
cd web
npm install
npm run dev
```

### Mobile (local)

```bash
cd mobile
npm install
npx expo start
```

---

## Architecture

### Current (Phase 0)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Web UI  │────▶│ Backend  │────▶│PostgreSQL│
│ :5173    │     │ :3000    │     │ :5432    │
└──────────┘     └────┬─────┘     └──────────┘
                      │
┌──────────┐          │    ┌──────────┐
│  Mobile  │──────────┘    │ RabbitMQ│
│ (Expo)   │               │ :5672   │
└──────────┘               └──────────┘
```

### Planned (Phases 1+)

- **Event sourcing**: Immutable event log → materialised views
- **Async consumers**: RabbitMQ fanout → reporting/audit services
- **Read replicas**: Report queries routed to replicas
- **Real-time reporting**: Event-driven materialised views

---

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **0** | Project skeleton, infrastructure, CI/CD | ✅ **Complete** |
| 1 | Core ledger: double-entry accounting + event sourcing | ⏳ In progress |
| 2 | Budgets, categories, reporting, reconciliation | 📋 Planned |
| 3 | Observability, performance, database engineering | 📋 Planned |
| 4 | Security hardening, audit dashboard | 📋 Planned |
| 5 | Disaster recovery, read replicas, chaos engineering | 📋 Planned |
| 6 | Mobile/web production polish, API versioning | 📋 Planned |
| 7 | Cost analysis, capacity planning, portfolio artifacts | 📋 Planned |

See [DEV_PLAN.md](docs/DEV_PLAN.md) for the complete roadmap.

---

## Key Design Decisions

All significant decisions are documented as Architecture Decision Records (ADRs) in [`docs/adr/`](docs/adr/).

| ADR | Title | Status |
|-----|-------|--------|
| 001 | [Choose Rust and Web Framework](docs/adr/001-choose-rust-and-framework.md) | ✅ Accepted |

---

## Operations

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","database":"connected","rabbitmq":"disabled","version":"0.1.0"}
```

### Metrics

```bash
curl http://localhost:3001/metrics
# Prometheus-format metrics
```

### Logging

Structured JSON logs with OpenTelemetry trace IDs:

```json
{"level":"INFO","message":"Server started","target":"backend","span":{"trace_id":"abc123"}}
```

---

## Stakeholder Guide

### For Product Managers

- **Transaction processing**: < 50ms P95 latency, 99.95% availability
- **Reporting dashboards**: Real-time via RabbitMQ event streaming, < 5s lag
- **Reconciliation**: Upload bank statements, auto-match transactions, resolve discrepancies

### For Compliance

- **Immutable audit trail**: All transactions recorded as append-only events
- **Idempotency keys**: Every transaction request logged with client-generated UUID
- **Full traceability**: Link audit events to original transactions, actor IDs, timestamps
- **Encryption**: TLS 1.3 in transit, AES-256 at rest (RDS encrypted storage)

### For Operations

- **SLOs**: 99.9% availability for health API (see [docs/slo.md](docs/slo.md))
- **Observability**: OpenTelemetry traces, Prometheus metrics, structured JSON logs
- **Runbooks**: Tracked in `docs/runbooks/` for failure scenarios
- **Infrastructure**: Defined as Terraform code in `infra/`

---

## License

MIT