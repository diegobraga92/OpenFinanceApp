# Capacity Plan & Cost Estimate

> Resource sizing and projected AWS costs for PudimFinance at increasing scale.
> Layer 4 final documentation (original Phase 7).

---

## Current Local Runtime Footprint

| Service | Image | CPU (idle) | RAM (idle) | Disk |
|---------|-------|-----------|------------|------|
| postgres | postgres:16-alpine | ~0.1% | ~60 MB | ~1 GB data |
| rabbitmq | rabbitmq:3.13 | ~0.3% | ~150 MB | ~50 MB |
| backend | rust/axum | ~0.1% | ~30 MB | ~150 MB binary |
| web | nginx | ~0.1% | ~20 MB | ~10 MB |
| prometheus | prom/prometheus | ~0.2% | ~120 MB | ~200 MB tsdb |
| grafana | grafana/grafana | ~0.3% | ~80 MB | ~50 MB |
| **Total** | | **~1 vCPU** | **~460 MB** | **~1.5 GB** |

---

## Scaling Scenarios

### Scenario A — Single User (current)

- 1 containerized stack on a single VM
- **AWS t3.micro** (2 vCPU, 1 GB RAM) is sufficient with headroom
- Monthly cost: **~$8–12** (compute only; +$5 for 20 GB gp3 EBS)

### Scenario B — 10 Users (family / small group)

- Add PgBouncer for connection pooling (or raise `max_connections`)
- Add read-only caching for report queries (optional; use proper indexes)
- **AWS t3.small** (2 vCPU, 2 GB RAM)
- Monthly cost: **~$15–20**

### Scenario C — 100 Users (small community)

- Managed PostgreSQL (RDS db.t3.small) + managed RabbitMQ (or SQS)
- Backend behind ALB with 2 instances (t3.small)
- Frontend on S3 + CloudFront
- Metrics: Prometheus on EC2 + Grafana Cloud (free tier) or self-hosted
- Monthly cost: **~$120–180**

### Scenario D — 1,000 Users (production)

- RDS db.t4g.medium (multi-AZ), ElastiCache Redis for cache
- ECS/Fargate backend (min 2 tasks, 0.25 vCPU each), auto-scaling
- RabbitMQ via Amazon MQ (single-instance or HA)
- Cost: **~$450–700/month** depending on storage + egress

---

## Rough Monthly AWS Cost Table

| Component | t3.micro (1 user) | t3.small (10) | ECS+RDS (100) | HA (1000) |
|-----------|------------------|---------------|---------------|-----------|
| Compute (EC2/ECS) | $8 | $15 | $40 | $150 |
| Database (RDS) | (self-hosted) | (self-hosted) | $25 | $90 |
| Managed broker | — | — | $15 | $60 |
| Storage (EBS/S3) | $5 | $5 | $10 | $30 |
| Load balancer | — | — | $20 | $25 |
| CDN | — | — | $5 | $15 |
| **Monthly total** | **~$13** | **~$20** | **~$115** | **~$370** |

---

## Bottlenecks & Mitigations

| Bottleneck | Impact | Mitigation |
|------------|--------|-----------|
| DB connection saturation | Pool exhaustion at high concurrency | PgBouncer, raise `pool_max_connections`, RDS proxy |
| Report aggregation (EXTRACT scans) | Slow monthly reports with >100k tx | Rewrite queries to range filters; materialized view |
| RabbitMQ single-node | Broker outage stops events (not DB) | Events replayable from `events` table; HA broker in prod |
| Metrics retention | Prometheus disk growth | Set retention window; move to Thanos/Mimir if scaling |
| Receipt image storage | Disk growth if images were added | S3 lifecycle rules, image compression |

---

## Recommendations

1. **Stay single-node (docker compose)** until >5 concurrent users — it's free and sufficient.
2. **When scaling:** move Postgres to RDS first (automatic backups/PITR), then add PgBouncer.
3. **Re-evaluate** after 6 months: the app is a study/portfolio project — keep costs near-zero if possible.