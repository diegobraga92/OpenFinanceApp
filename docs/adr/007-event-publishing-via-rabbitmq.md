# ADR 007: Event Publishing via RabbitMQ

**Status:** Accepted

**Date:** 2026-08-06

## Context

Layer 3 re-introduces RabbitMQ to publish ledger `TransactionRecorded` events for downstream consumers (reporting, audit, integration). We need to decide:

1. The exchange type and routing key strategy
2. Message persistence and delivery guarantees
3. Failure handling when RabbitMQ is unavailable
4. How events in the DB correlate with messages on the broker

## Decision

### 1. Fanout exchange with no routing key

A durable fanout exchange named `finance.ledger.transactions` is declared at backend startup. Fanout delivers every message to all bound queues, so any consumer (audit, reporting, analytics) can bind without competing for routing keys.

**Rationale:** Fanout is the simplest model for broadcast-style ledger events. Consumers who need specific filtering can implement it in their own binding/queue logic. Routing keys add coupling between publisher and consumer that isn't needed for a personal finance system.

### 2. Persistent messages with confirm-less publishing

Messages are published with `BasicProperties::delivery_mode = 2` (persistent). Publishing uses `PublisherConfirm::NotRequired` (fire-and-forget).

**Rationale:** Persistence ensures the broker survives a restart with the message intact. Confirm mode (`publisher_confirm`) would add a round-trip per message; at our scale (single user, personal finance) the risk of message loss is mitigated by the DB `events` table, which is the source of truth.

### 3. Best-effort publishing with graceful degradation

If RabbitMQ is unreachable at publish time:
1. The publisher logs a warning.
2. The publish returns `Ok(())` — the DB transaction is unaffected.
3. The event remains recoverable in the DB `events` table.

At startup, a background task retries declaring the exchange every 5 seconds until success, so the system self-heals when RabbitMQ comes online.

**Rationale:** The ledger must never be blocked by the message broker. The DB is the source of truth; RabbitMQ is a fan-out mechanism. If messages are lost, they can be replayed from the events table in Layer 4 (outbox pattern / transactional outbox if needed).

### 4. DB events table as the durable record

Every ledger transaction also inserts into PostgreSQL `events` table with the full payload. This is the durable, immutable record. RabbitMQ is a *publish* side-effect, not the source of truth.

**Rationale:** This gives us "event sourcing on the DB, event notification on the broker." A future outbox pattern (reading from `events` and republishing) can close any gap created by broker outages.

## Consequences

- The `finance.ledger.transactions` fanout exchange must exist before consumers can bind.
- RabbitMQ is configured in `docker-compose.yml` with management UI on port 15672 and amqp on 5672.
- The backend health endpoint reports RabbitMQ connection state but does not fail the health check when it's "connecting" — the app works without it.
- If messages are dropped during a broker outage, they can be replayed from the DB events table.

## Related ADRs

- ADR 005: Ledger Design and Event Sourcing (DB event table as source of truth)
- ADR 006: Isolation Level Choice (ledger writes use READ COMMITTED)