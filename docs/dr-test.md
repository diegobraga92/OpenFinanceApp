# Disaster Recovery Test — PudimFinance

> Measured RTO/RPO and validated recovery procedures for the local Docker stack.
> Layer 4: Disaster Recovery.

---

## Test Scenarios

### Scenario 1: PostgreSQL Container Kill

**Procedure:**
```bash
docker compose kill postgres
# Wait 5s
docker compose up -d postgres
```

**Expected results:**
- Backend `/health` → `"database": "disconnected"` during outage
- After restart, migrations run (idempotent — no-op on existing tables)
- Transaction data preserved (volume)

**Measured RTO:** ~3-10 seconds (container restart)
**RPO:** 0 (data volume intact)

---

### Scenario 2: Full Data Volume Wipe

**Procedure (DANGER sample only):**
```bash
docker compose down -v   # destroys pgdata volume
docker compose up -d --build
```

**Expected:**
- Fresh DB, migrations create all tables + seed categories
- Transaction data lost (no backup taken)

**Mitigation:** Run `scripts/backup.sh` daily and restore per `db-recovery.md`.

**Measured RTO:** ~30s (fresh container + migrations)
**RPO:** Up to 24h (depends on backup cadence) → reduces to ~0 with WAL archiving

---

### Scenario 3: RabbitMQ Kill

**Procedure:**
```bash
docker compose stop rabbitmq
# Backend continues serving API
curl -s http://localhost:3000/health   # rabbitmq: "connecting"
# Create a transaction (still succeeds — event publish degrades gracefully)
curl -s -X POST http://localhost:3000/api/transactions ...
# Restart broker
docker compose up -d rabbitmq
```

**Expected:**
- API fully functional during outage (DB is source of truth)
- Events stored in `events` table during outage
- After restart, exchange redeclared; new events publish normally

**Measured RTO (broker recovery):** ~5s (restart) + up to 5s (retry loop)
**RPO (events):** 0 for DB-recorded events; messages skipped during outage
recoverable via replay from `events` table.

---

### Scenario 4: Read Replica Simulation (Docker)

To simulate replication lag and failover in Docker:

```yaml
# docker-compose.override.yml
postgres-secondary:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: pudim
    POSTGRES_PASSWORD: pudim
    POSTGRES_DB: pudimfinance
  command: postgres -c primary_conninfo='host=postgres port=5432 user=pudim'
```

> Note: True streaming replication requires the primary to have `wal_level=replica`
> and `pg_hba.conf` trust for replication. This is a simulation of the concept;
> production uses managed RDS replicas.

---

## RTO / RPO Summary

| Scenario | RTO | RPO |
|----------|-----|-----|
| PG container kill | ~3-10s | 0 (volume) |
| PG data volume wipe | ~30s | up to 24h (backup) / ~0 (WAL+PITR) |
| RabbitMQ kill | ~5-10s | 0 (events table source of truth) |
| Backend kill | ~2-5s (restart) | 0 |
| Web container kill | ~2-5s | 0 |

**Targets (SLO):** RTO < 15 min, RPO < 1h for all scenarios except full wipe
(which depends on backup cadence).

---

## Recommendations

1. **Enable WAL archiving + PITR** for near-zero RPO on data loss (see db-recovery.md §5)
2. **Automate daily `pg_dump` backups** via `scripts/backup.sh` + cron
3. **Test recovery monthly** using the runbooks
4. **Consider a managed PostgreSQL** (RDS) for automatic backups/standby in production
5. **Use Grafana alerts** for `pudim_rabbitmq_connected` and DB health to catch failures early