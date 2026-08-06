# ADR 009: API Deprecation Strategy

**Status:** Accepted
**Date:** 2026-08-06

## Context

As the PudimFinance API evolves through Layers 1-4, breaking changes may be required (schema changes, auth model, error format). Currently the API is an implicit single version. We need a documented strategy to retire old endpoints gracefully while keeping clients working during a transition.

## Decision

### 1. The API uses an implicit `v1`, with new major versions under `/api/v2/...`

- Current endpoints remain at their existing paths (`/api/transactions`, `/api/ledger/...`).
- Any breaking change introduces a new versioned prefix (`/api/v2/...`).
- Additive changes (new fields, new endpoints) never require a new version.

### 2. Deprecated endpoints send standard `Sunset`, `Deprecation`, and `Link` headers

When an endpoint is deprecated but still served, responses include:
- `Sunset: <RFC 1123 date>` — when the endpoint will return 410 Gone.
- `Deprecation: true` — indicates deprecation (per draft standard).
- `Link: </api/v2/...>; rel="successor-version"` — points to the replacement.

After the Sunset date, the endpoint returns **410 Gone** with a JSON error.

### 3. Minimum 6-month notice period

From the first `Sunset` header issuance to actual removal must be at least 6 months, giving clients time to migrate.

### 4. Simulated migration drives the process

Layer 4 includes a simulated `/api/v2/ledger/transactions` route alias to exercise the policy end-to-end: old path stays, new path added, headers attached, then old path marked for removal.

## Consequences

- Clients can migrate gracefully using `Link` headers.
- OpenAPI spec can mark deprecated paths (utoipa supports `deprecated`).
- A runtime header-checking test can verify `Sunset`/`Deprecation`/`Link` are present on deprecated routes.
- Maintaining both v1 and v2 paths adds surface area; pruned after the sunset period.

## Related ADRs

- ADR 002: API Contract Strategy (how the OpenAPI contract is managed)
- ADR 005: Ledger Design (the resource being versioned in the simulation)