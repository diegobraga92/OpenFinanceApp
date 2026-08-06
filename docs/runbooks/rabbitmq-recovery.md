# Runbook — RabbitMQ Recovery

> Procedures for recovering the PudimFinance RabbitMQ broker.
> Layer 4: Disaster Recovery.

---

## 1. Identify the Failure

```bash
# Health endpoint shows rabbitmq status
curl -s http://localhost:3000/health | jq .rabbitmq

# Container status
docker ps --filter name=pudimfinance-rabbitmq

# Backend logs
docker compose logs backend | grep -i rabbitmq
```

**Symptoms:**
- Health returns `"rabbitmq": "connecting"` or `"disconnected"`
- Backend logs show `RabbitMQ not reachable yet, retrying` or `Failed to create channel`
- Grafana `pudim_rabbitmq_connected` gauge = 0

**Important:** Layer 4 continues to function without RabbitMQ. The backend's
event publisher degrades gracefully — DB transactions commit normally and events
are stored in the `events` table. RabbitMQ is a fan-out mechanism, not the source
of truth.

---

## 2. Restart the Container

```bash
docker compose restart rabbitmq
docker compose restart backend   # reconnects + redeclares exchange
```

Wait for health:
```bash
docker compose ps rabbitmq --format "table {{.Status}}"
# Should show "healthy"
```

Verify exchange re-declared:
```bash
docker exec pudimfinance-rabbitmq-1 rabbitmqctl list_exchanges | grep finance
```

---

## 3. Recovers from Wipe / Data Loss

If the broker data is gone (fresh broker), the exchange is re-declared automatically
by the backend on startup (the `EventPublisher` retry loop). No action needed —
new transactions publish fine.

Lost messages during the outage were **not** delivered, but are safe because:
- The `events` table holds the full `TransactionRecorded` event payloads.
- Any consumer can rebuild state from the events table.
- A future outbox pattern can replay events to the broker if needed.

---

## 4. Rebind Consumers

After recovery, consumers (reporting/audit/integration) must bind to the
`finance.ledger.transactions` fanout exchange:

```bash
# Example: declare a durable queue and bind to the exchange via management API
curl -u pudim:pudim -X PUT http://localhost:15672/api/queues/%2F/audit-queue \
  -H "content-type: application/json" -d '{"durable":true}'
curl -u pudim:pudim -X POST http://localhost:15672/api/bindings/%2F/e/finance.ledger.transactions/q/audit-queue \
  -H "content-type: application/json" -d '{}'
```

---

## 5. Replay Lost Events (optional)

To replay events that were missed during a broker outage, read from the `events`
table and republish. A simple SQL-backed replay:

```bash
# Get events after a timestamp and publish each (pseudocode for a consumer script)
docker compose exec postgres psql -U pudim -d pudimfinance \
  -c "SELECT event_type, payload FROM events WHERE occurred_at > '2026-08-06T14:00:00Z'"
```

---

## 6. Checklist

- [ ] Health returns `"rabbitmq": "connected"`
- [ ] `finance.ledger.transactions` exchange exists (durable fanout)
- [ ] Backend logs show `Published TransactionRecorded event`
- [ ] `pudim_rabbitmq_connected` gauge = 1 in Prometheus/Grafana
- [ ] Events table intact (source of truth for replay)