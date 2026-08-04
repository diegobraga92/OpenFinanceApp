# 🏦 PudimFinance

> Personal finance application: Rust (Tokio + Axum) backend, React (Vite) web, React Native (Expo) mobile, PostgreSQL.
> Built incrementally — a working transaction tracker first, with double-entry ledger, event sourcing, and RabbitMQ added in later layers.

**Tech Stack:** Rust (Tokio + Axum) backend · React (Vite) web · React Native (Expo) mobile · PostgreSQL

---

## Project Structure

```
PudimFinance/
├── backend/           # Rust + Axum API server
│   ├── src/routes/    # Categories, transactions, summary handlers
│   ├── src/models.rs  # SQLx/utoipa data models
│   └── migrations/    # PostgreSQL migrations (sqlx)
├── web/               # React + TypeScript + Vite frontend
├── mobile/            # React Native + Expo mobile app
├── api/
│   └── openapi/       # Generated OpenAPI 3.1 spec (from Rust utoipa annotations)
├── infra/             # Terraform infrastructure-as-code (AWS)
├── docker-compose.yml # Local development environment (Postgres + Backend + Web)
└── docs/
    ├── adr/           # Architecture Decision Records
    ├── DEV_PLAN.md    # Full development plan (all layers)
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
# Start all services (PostgreSQL, backend, web)
docker compose up --build

# Services:
#   Backend API:  http://localhost:3000/health
#   Swagger UI:   http://localhost:3000/swagger-ui
#   Web UI:       http://localhost:5173
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

## API Endpoints (Layer 1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (API + database status) |
| `GET` | `/api/categories` | List categories (filter by `?type=income\|expense`) |
| `POST` | `/api/categories` | Create category |
| `GET` | `/api/transactions` | Paginated list with filters (category, type, date range) |
| `POST` | `/api/transactions` | Create transaction |
| `GET` | `/api/transactions/{id}` | Get single transaction |
| `PUT` | `/api/transactions/{id}` | Update transaction |
| `DELETE` | `/api/transactions/{id}` | Delete transaction |
| `GET` | `/api/summary` | Current month totals (income, expense, balance), grouped by category |

The full OpenAPI 3.1 spec is available at `http://localhost:3000/api-docs/openapi.json` and served via Swagger UI at `http://localhost:3000/swagger-ui`.

To regenerate the committed spec from Rust annotations:

```bash
cd backend && cargo run --bin gen-openapi > ../api/openapi/openapi.json
cd web && npm run generate-types   # regenerate TypeScript types
cd mobile && npm run generate-types
```

---

## Development Roadmap

| Layer | Focus | Status |
|-------|-------|--------|
| **Phase 0** | Project skeleton, health endpoint, CI/CD, ADRs | ✅ **Complete** |
| **Layer 1** | Simple income/expense tracking (categories + transactions) | ✅ **Complete** |
| **Layer 2** | Budgets, monthly reports, charts on web and mobile | 📋 Planned |
| **Layer 3** | Double-entry ledger, event sourcing, RabbitMQ, reconciliation | 📋 Planned |
| **Layer 4** | Observability deep-dive, security, DR, receipt scanner, docs | 📋 Planned |

See [DEV_PLAN.md](docs/DEV_PLAN.md) for the complete roadmap.

---

## Key Design Decisions

All significant decisions are documented as Architecture Decision Records (ADRs) in [`docs/adr/`](docs/adr/).

| ADR | Title | Status |
|-----|-------|--------|
| 001 | [Choose Rust and Web Framework](docs/adr/001-choose-rust-and-framework.md) | ✅ Accepted |
| 002 | [API Contract Strategy](docs/adr/002-api-contract-strategy.md) | ✅ Accepted |
| 003 | [Start Simple Single-Entry Before Double-Entry](docs/adr/003-start-simple-single-entry.md) | ✅ Accepted |

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

### CI Checks

```bash
./scripts/ci-checks.sh check   # Full suite (backend fmt/clippy/audit/build, OpenAPI, web, mobile)
```

---

## License

MIT