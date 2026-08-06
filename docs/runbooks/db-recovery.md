# Runbook — PostgreSQL Recovery

> Procedures for recovering the PudimFinance PostgreSQL database from failures.
> Layer 4: Disaster Recovery.

---

## 1. Identify the Failure

Check database health:

```bash
# Health endpoint (shows DB status)
curl -s http://localhost:3000/health | jq .database

# Container status
docker ps --filter name=pudimfinance-postgres

# Backend logs
docker compose logs backend | grep -i "database\|error"
```

**Symptoms:**
- `GET /health` returns `"database": "disconnected"`
- Backend logs show `Failed to connect to PostgreSQL`
- `pg_isready` fails inside the container

---

## 2. Restart the Container

```bash
docker compose restart postgres
docker compose restart backend   # backend reconnects after DB is healthy
```

Wait for health:
```bash
docker compose ps postgres --format "table {{.Status}}"
# Should show "healthy"
```

---

## 3. Restore from Backup

If the container is unrecoverable or data is corrupted:

### 3a. Start a fresh PostgreSQL container (data volume intact)

```bash
# Stop the stack (keep the data volume)
docker compose stop

# Start only postgres to inspect
docker compose up -d postgres

# Verify existing tables
docker compose exec postgres psql -U pudim -d pudimfinance -c "\dt" | grep -E "transactions|categories|ledger"
```

### 3b. Restore from SQL dump

```bash
# If a backup exists (produced by scripts/backup.sh if configured)
cat backups/pudimfinance-$(date +%Y%m%d).sql | docker compose exec -T postgres psql -U pudim -d pudimfinance
```

### 3c. Restore from pg_dump

```bash
# Take a fresh dump if the DB is still partially accessible
docker compose exec postgres pg_dump -U pudim -d pudimfinance > backups/pudimfinance-latest.sql

# Restore into a fresh DB
docker compose exec -T postgres psql -U pudim -d pudimfinance < backups/pudimfinance-latest.sql
```

---

## 4. Verify Recovery

```bash
# Confirm tables exist
docker compose exec postgres psql -U pudim -d pudimfinance -c "SELECT COUNT(*) FROM transactions;"
docker compose exec postgres psql -U pudim -d pudimfinance -c "SELECT COUNT(*) FROM ledger_entries;"

# Health check
curl -s http://localhost:3000/health | jq .
```

If ledger entries are missing (only simple transactions present), re-run migration:
```bash
curl -s -X POST http://localhost:3000/api/migrate/single-to-double -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 5. Point-In-Time Recovery (PITR) — Docker Simulation

> The full PITR setup (WAL archiving) requires `archive_mode = on` in postgresql.conf and
> an archive target. For a lightweight local simulation:

### 5a. Enable WAL archiving (edit compose or use volume mount)

Add to `docker-compose.yml` postgres service:
```yaml
postgres:
  command: >
    postgres
    -c wal_level=replica
    -c archive_mode=on
    -c archive_command='cp %p /var/lib/postgresql/data/archive/%f'
```

### 5b. Simulated restore

1. Take a base backup: `pg_basebackup` (or stop the DB and copy the data dir)
2. Let new writes occur (timeline moves forward)
3. To restore to a point in time:
   - Restore the base backup dir
   - Create `recovery.signal`
   - Set `recovery_target_time` in postgresql.conf
   - Restart PostgreSQL — it replays WAL up to the target time

### 5c. RTO/RPO measurement

Documented in `docs/dr-test.md`. Expected for local Docker:
- **RTO** (Recovery Time Objective): ~2-5 minutes (container restart + WAL replay)
- **RPO** (Recovery Point Objective): ~0-1 hour (depends on archive frequency; typically 0 with WAL archiving)

---

## 6. Checklist

- [ ] Backend shows `"database": "connected"` in `/health`
- [ ] All tables present (`categories`, `transactions`, `budgets`, `accounts`, `ledger_entries`, `events`, `receipts`)
- [ ] Transaction count matches pre-failure value
- [ ] Ledger entries intact (debits = credits for each transaction)
- [ ] Users table intact (auth still works)
- [ ] RabbitMQ events republished if needed (from `events` table)