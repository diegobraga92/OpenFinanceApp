# API Deprecation Policy — PudimFinance

> How the PudimFinance API handles endpoint versioning and deprecation.
> Layer 4: API deprecation strategy.

---

## Policy Overview

- The API aims for **backward compatibility** for the lifetime of a major version (`v1`).
- When a breaking change is required, a **new versioned path** (`/api/v2/...`) is introduced.
- The old path continues to work for a defined period, marked with `Sunset` headers, then is removed.

---

## Versioning Strategy

- The current API is the **implicit v1** (paths like `/api/transactions`, `/api/ledger/...`).
- New breaking versions are introduced as **`/api/v2/...`**.
- Internal resources keep their paths; only the version prefix changes.

### What triggers a new major version?

| Change | Major (v2) required? |
|--------|---------------------|
| Remove/rename an endpoint | Yes |
| Change request/response schema (breaking) | Yes |
| Add optional fields / new endpoints | No (backward compatible) |
| Change error format | Yes |
| Change auth model | Yes |

---

## Deprecation Headers

Deprecated (but still working) endpoints respond with:

```
Sunset: Sun, 01 Jan 2027 00:00:00 GMT
Deprecation: true
Link: </api/v2/transactions>; rel="successor-version"
```

| Header | Meaning |
|--------|---------|
| `Sunset` | After this date the endpoint will return 410 Gone |
| `Deprecation` | Indicates the endpoint is deprecated (true) |
| `Link` | Points to the successor version (RFC 8288) |

---

## Simulated v1 → v2 Migration

### Example: `/api/ledger/transactions`

1. **v2 introduced:** create `/api/v2/ledger/transactions` with the same (or improved) contract.
2. **v1 frozen:** `/api/ledger/transactions` remains, but now responds with:
   - `Sunset: Sun, 01 Jan 2027 00:00:00 GMT`
   - `Deprecation: true`
   - `Link: </api/v2/ledger/transactions>; rel="successor-version"`
3. **Clients migrate** per the `Link` header.
4. **After Sunset:** `/api/ledger/transactions` returns `410 Gone` with `{"error":"Gone — use /api/v2/ledger/transactions"}`.

### Timeline

| Date | Event |
|------|-------|
| Now | v1 supported, no deprecation headers |
| +6 months (planned) | v2 announced, v1 starts sending `Sunset` + `Link` headers |
| +12 months | v1 retired (410 Gone) |

---

## Implementation Sketch

Middleware to add `Sunset`/`Deprecation`/`Link` headers on deprecated routes:

```rust
async fn deprecation_middleware(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        "Sunset",
        HeaderValue::from_static("Sun, 01 Jan 2027 00:00:00 GMT"),
    );
    response.headers_mut().insert("Deprecation", HeaderValue::from_static("true"));
    response.headers_mut().insert(
        "Link",
        HeaderValue::from_static("</api/v2/...>; rel=\"successor-version\""),
    );
    response
}
```

---

## Communication Plan

1. **Discovery:** Swagger UI + OpenAPI documents which endpoints are deprecated (add `deprecated: true` in spec).
2. **Runtime:** Deprecation headers inform API clients programmatically.
3. **Humans:** README "API Versioning" section + release notes.
4. **Notice period:** Minimum 6 months of `Sunset` header before removal (per policy).

---

## Related

- ADR 009: `api-deprecation-strategy.md`
- ADR 002: API Contract Strategy