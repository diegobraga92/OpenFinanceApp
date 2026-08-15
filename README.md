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

> **Auth:** the API requires a JWT on every `/api/*` route except `/api/auth/*`.
> On first launch the web UI shows a registration form — create an account
> there and subsequent visits keep you signed in (tokens live in `localStorage`,
> auto-refreshed for 7 days).

Running on a shared LAN server where Docker ports may conflict? See
[LAN Server Deployment](#lan-server-deployment).

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

### Mobile: Configuring the backend server (in-app)

The mobile app's backend address is **configured on the device** — not baked
into the APK — so you can point the app at any PudimFinance server without
rebuilding:

- **First launch / sign-in screen**: there is a "Server" field at the top of
  the login form. Enter your server's LAN address (e.g. `http://192.168.1.100:3000`)
  before signing in — it is saved automatically.
- **Already signed in**: open the drawer → **Server** to view, change, test
  (`/health` ping) and save the address. Changes take effect immediately.
- If no address is configured, the app falls back to `EXPO_PUBLIC_API_BASE_URL`
  (if baked in at build time) and finally `http://localhost:3000`.

> Android: the APK is built with `usesCleartextTraffic` enabled
> (`expo-build-properties` plugin), so plain `http://` LAN addresses work.


### Installing on an Android phone (CI-built APK)

Every push to `main` touching `mobile/**` triggers the **Mobile APK Build**
workflow (`.github/workflows/mobile-apk.yml`), which produces an installable
**release** APK (embedded JS bundle, signed with the debug keystore so it
sideloads without a Play Store):

1. Open the **Actions** tab on GitHub → select **Mobile APK Build**.
2. Pick the latest run (green check) → **Artifacts** → download
   `pudimfinance-release`.
3. Unzip → transfer `app-release.apk` to your phone (USB, Drive, or direct
   download) and tap it to install.

You can also trigger a build anytime by opening the workflow and clicking
**Run workflow** (the `workflow_dispatch` trigger) — no push required.
Debug-signed release APKs support sideloading; enable *"Install unknown apps"*
for the source app if your phone prompts you.


### Mobile: Push Notification Capture

PudimFinance can auto-capture transactions from bank/payment push notifications
(Nubank, Itaú, Banco do Brasil, PicPay, PIX, …):

1. Open **Notification Capture** from the drawer menu.
2. Toggle **Auto-capture transactions** on and grant notification access.
3. Pick the apps to monitor (or leave empty to watch all) and choose a capture
   mode:
   - **Ask before creating** — a confirmation dialog appears with the parsed
     amount/description before anything is saved.
   - **Auto-create** — transactions are saved immediately (Snackbar confirms).
4. Optionally pick a **default category** used when the merchant can't be
   matched to an existing category.

The parser understands common Brazilian alert formats:

```
Compra aprovada R$ 49,90 em IFOOD        → expense 49.90 · IFOOD
Pix recebido R$ 500,00 de MARIA SANTOS   → income 500.00 · MARIA SANTOS
Cartão final 1234 R$ 100,00 às 14:30     → expense 100.00
Boleto pago R$ 85,75                     → expense 85.75
```

> **Android only.** Capture works by reading other apps' notifications through a
> native `NotificationListenerService` (the local `expo-notification-listener`
> module). The user must grant **Notification access** (Settings → Special app
> access → Notification access). It works while the app is backgrounded or
> killed. On iOS, reading other apps' notifications is blocked by the sandbox,
> so the feature is disabled there.


### Credit Cards, Faturas & Antecipação

Credit cards are `liability` accounts with a **closing day** (fatura fecha) and a
**due day** (vencimento). Card purchases are recorded as expenses dated at
purchase time — so they count in the month they're made — and post double-entry
ledger entries (debit expense, credit card), growing the card balance.

Each purchase is attached to the billing cycle it falls into, producing monthly
**bills** with computed totals and a payment deadline:

- `POST /api/credit-cards/{id}/purchases` — record a card purchase (expense + ledger + bill).
- `POST /api/credit-cards/{id}/bills/{bill_id}/pay` — pay a bill as a **transfer**
  (debit card, credit your bank account). Payments are never counted as expenses,
  so paying the card doesn't inflate monthly spending.
- `POST /api/credit-cards/{id}/anticipate` — **antecipar parcelas**: bring future
  installments (of plans linked to the card) onto the current bill, optionally
  with the discount the provider offers for early payment.

Installment plans accept an optional `account_id`, so their generated installments
land on the right card and become anticipatable.


---

## LAN Server Deployment

Running PudimFinance on a LAN server that already hosts other web services in Docker
requires two things:

1. **No port conflicts** — the default host ports (`3000`, `5173`, `5432`, `5672`,
   `15672`, `9090`, `3001`) may already be taken by other containers.
2. **A backend URL that works from other devices** — the web app defaults to same-origin
   URLs, so it must be able to reach the backend from LAN clients (not from `localhost`
   on the server itself).

All host ports and the web → backend URL are configurable via environment variables,
so you never need to edit `docker-compose.yml`.

### 1. Check for port conflicts

```bash
ss -tlnp | grep -E ':(3000|5173|5432|5672|15672|9090|3001)\b'
```

Anything listed is already in use — override it with a free port in step 2.

### 2. Configure the deployment

A ready-made template is committed at [`.env.docker`](.env.docker). Use it with
`--env-file` so it does **not** overwrite the root `.env` used by `scripts/run.sh`:

```bash
cp .env.docker .env.docker.local
$EDITOR .env.docker.local
```

Set `PUBLIC_HOST` to this server's LAN IP/hostname as seen by other devices:

```bash
hostname -I        # e.g. 192.168.1.100
```

Then change any ports that collided in step 1:

```dotenv
PUBLIC_HOST=192.168.1.100
BACKEND_PORT=3100   # 3000 was taken by another container
WEB_PORT=4200       # 5173 was taken by another container
```

### 3. Choose how the web app reaches the backend

`VITE_API_BASE_URL` is **baked into the web bundle at build time**. Two supported
strategies:

#### Option A — direct backend URL (simplest)

Uncomment and set `VITE_API_BASE_URL` to the backend's LAN address:

```dotenv
VITE_API_BASE_URL=http://192.168.1.100:3100
```

Then build and start:

```bash
docker compose --env-file .env.docker.local up --build -d
```

Browsers call `http://192.168.1.100:3100` directly (the backend is already
CORS-permissive and binds `0.0.0.0`).

**Trade-off:** the URL is baked in — if the server IP or port changes, edit
`.env.docker.local` and rebuild the `web` container:

```bash
docker compose --env-file .env.docker.local build web
docker compose --env-file .env.docker.local up -d web
```

#### Option B — same-origin nginx proxy (recommended, no rebuild on IP change)

Leave `VITE_API_BASE_URL` **empty** (the default):

```dotenv
VITE_API_BASE_URL=
```

The web container's nginx proxies `/api/`, `/health`, `/metrics`, `/swagger-ui`, and
`/api-docs/` to the backend over the internal Docker network, so the app uses relative
URLs and works from any device, at any server IP/port, with no rebuild:

```bash
docker compose --env-file .env.docker.local up --build -d
```

**Trade-off:** all API traffic is funneled through the web container, and the backend
is not directly reachable via HTTP from the LAN.

> **Note:** with either option, if you run `docker compose up` *without* `--env-file`,
> Compose falls back to the root `.env`, which sets `VITE_API_BASE_URL=http://localhost:3000`
> (fine for the dev quickstart, broken for LAN clients).

### 4. Open the firewall (if enabled)

```bash
sudo ufw allow 4200/tcp   # web UI — required for both options
sudo ufw allow 3100/tcp   # backend — only needed for Option A
```

### 5. Verify

From the server itself:

```bash
curl -s http://localhost:4200/health
# {"status":"ok","database":"connected",...}
```

From another machine on the same LAN (replace with your server's IP):

```bash
curl -s http://192.168.1.100:4200/health
curl -s http://192.168.1.100:4200/api/categories
```

Then open `http://192.168.1.100:4200` in a browser on the LAN device.

The app now requires authentication: the first browser session shows a
**Create account** form (the backend auto-creates the `users` table on startup).
Any subsequent device just signs in with the same credentials.

### Configuration reference

| Variable | Default | Host port / role |
|----------|---------|------------------|
| `PUBLIC_HOST` | — | Server LAN IP/hostname (documentation only) |
| `JWT_SECRET` | `dev-secret-change-me-in-production` | Signs JWTs — override in production (`openssl rand -hex 32`); changing it signs everyone out |
| `PG_PORT` | `5432` | PostgreSQL |
| `RABBIT_PORT` | `5672` | RabbitMQ AMQP |
| `RABBIT_MGMT_PORT` | `15672` | RabbitMQ management UI |
| `BACKEND_PORT` | `3000` | Rust backend API |
| `WEB_PORT` | `5173` | Web UI (nginx) |
| `PROMETHEUS_PORT` | `9090` | Prometheus |
| `GRAFANA_PORT` | `3001` | Grafana |
| `VITE_API_BASE_URL` | *(empty)* | Web → backend URL (baked at build time) |

Internal container-to-container communication (`postgres:5432`, `backend:3000`,
`prometheus:9090`, ...) is unaffected — only host-facing ports are configurable.

---

## API Endpoints (Layer 1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (API + database status) |
| `GET` | `/api/categories` | List categories (filter by `?type=income\|expense`) |
| `POST` | `/api/categories` | Create category |
| `GET` | `/api/categories/{id}` | Get single category |
| `PUT` | `/api/categories/{id}` | Update category |
| `DELETE` | `/api/categories/{id}` | Delete category (409 if in use) |
| `GET` | `/api/accounts` | List chart-of-accounts with computed balances |
| `POST` | `/api/accounts` | Create account (asset/liability/equity/income/expense; liability = credit card when `closing_day`/`due_day` set) |
| `GET` | `/api/accounts/{id}` | Get single account with balance |
| `PUT` | `/api/accounts/{id}` | Update account |
| `DELETE` | `/api/accounts/{id}` | Delete account (409 if in use) |
| `GET` | `/api/credit-cards` | List credit cards with balances and current bill |
| `GET` | `/api/credit-cards/{id}` | Get a credit card with balance and current bill |
| `GET` | `/api/credit-cards/{id}/bills` | List billing cycles ("faturas") with computed totals |
| `POST` | `/api/credit-cards/{id}/purchases` | Record a card purchase (expense + ledger entries, attached to its bill) |
| `POST` | `/api/credit-cards/{id}/bills/{bill_id}/pay` | Pay a bill (transfer — never an expense) |
| `POST` | `/api/credit-cards/{id}/anticipate` | Anticipate future installments onto the current bill with an optional discount |
| `GET` | `/api/ledger/transactions` | List double-entry ledger transactions |
| `POST` | `/api/ledger/transactions` | Create balanced double-entry transaction |
| `POST` | `/api/migrate/single-to-double` | Migrate simple transactions to double-entry |
| `GET` | `/api/transactions` | Paginated list with filters (category, type, date range) |
| `POST` | `/api/transactions` | Create transaction (optionally split into 2-60 installments) — posts balanced ledger entries |
| `GET` | `/api/transactions/{id}` | Get single transaction |
| `PUT` | `/api/transactions/{id}` | Update transaction (re-posts its ledger entries) |
| `DELETE` | `/api/transactions/{id}` | Delete transaction (removes its ledger entries) |
| `GET` | `/api/summary` | Current month totals (income, expense, balance), grouped by category |
| `GET` | `/api/receipts` | List saved receipts (includes items + normalized product ids) |
| `POST` | `/api/receipts` | Save a parsed receipt |
| `POST` | `/api/receipts/scan` | Parse an NFC-e QR code into receipt data |
| `GET` | `/api/receipts/price-history` | Price history for a normalized product |
| `POST` | `/api/receipts/product/merge` | Merge duplicate normalized products |
| `POST` | `/api/reconciliation` | Upload bank statement CSV for reconciliation |
| `GET` | `/api/audit/events` | List immutable audit events (admin-only) |

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