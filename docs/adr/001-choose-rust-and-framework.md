# ADR 001: Choose Rust and Web Framework

## Status

Accepted

## Context

The PudimFinance backend needs to be built on a technology stack that meets financial-grade requirements for correctness, performance, security, and maintainability. The system will handle immutable double-entry ledger transactions, event sourcing, and real-time messaging via RabbitMQ.

### Key Requirements

1. **Correctness** — No silent data corruption. Type system should prevent invalid states at compile time.
2. **Performance** — Low latency for transaction processing (< 50ms P95), high throughput for report queries.
3. **Concurrency Safety** — Prevent data races in async transaction processing with database connections.
4. **Security** — Memory safety for handling sensitive financial data.
5. **Ecosystem** — Good support for async HTTP, PostgreSQL, RabbitMQ, and OpenTelemetry.
6. **Maintainability** — Clear error handling, explicit control flow, no hidden costs.

### Alternatives Considered

| Language | Framework | Rationale |
|----------|-----------|-----------|
| Go | net/http + Chi | Good performance, simple concurrency model, larger hiring pool |
| Rust | Axum + Tokio | Zero-cost abstractions, memory safety without GC, stronger type system |
| Node.js | Express/Fastify | Fastest development cycle, largest ecosystem, dynamic types |
| Python | FastAPI | Fast development, great for data processing, GIL limits throughput |
| C++ | drogon/crow | Maximum performance, high development cost, memory safety risks |
| Java/Kotlin | Spring Boot | Mature ecosystem, great tooling, heavier runtime, verbose |
| .NET/C# | ASP.NET Core | Good performance, solid tooling, less common in fintech backend |

## Decision

We will use **Rust** with the following framework and library choices:

### HTTP Framework: **Axum**

- Built on top of Tokio (the de-facto Rust async runtime)
- Uses `tower` middleware ecosystem (shared with Go's gRPC community via tonic)
- Strongly typed extractors that prevent deserialization errors at compile time
- First-class OpenTelemetry support via tower-http
- Active development by the Tokio team

### Async Runtime: **Tokio**

- Industry standard for Rust async
- Work-stealing scheduler for balanced load
- Comprehensive ecosystem (tokio-postgres, lapin/amqprs, tonic)
- Excellent support for graceful shutdown

### Database Driver: **sqlx**

- Compile-time checked SQL queries (optional but available)
- Native async PostgreSQL support
- Built-in migration management
- Connection pooling with configurable health checks

### Message Queue: **lapin**

- Pure Rust RabbitMQ client
- Supports all AMQP 0-9-1 features needed (exchanges, queues, bindings)
- Async-native with Tokio

### Key Rationale

1. **Type-driven correctness**: Rust's type system encodes invariants (like `Result<T, E>` for fallible operations, `Option<T>` for nullable values) that prevent entire classes of bugs at compile time. For a financial ledger, this is critical.

2. **No garbage collector**: Predictable latency for transaction processing. No GC pauses that could affect P99 latency targets.

3. **Fearless concurrency**: The borrow checker prevents data races at compile time. Combined with Tokio's async model, this allows safe shared state across concurrent request handlers.

4. **Zero-cost abstractions**: High-level expressiveness with no runtime overhead. The ledger domain model can be expressed naturally without sacrificing performance.

5. **Ecosystem maturity**: While younger than Go/Java, the Rust async ecosystem (Tokio, Axum, sqlx, lapin, OpenTelemetry) is production-ready and well-maintained.

### Tradeoffs

| Concern | Mitigation |
|---------|------------|
| **Longer compile times** | Use incremental compilation for dev, optimized CI caching. Target ~30s for CI builds with caching. |
| **Steeper learning curve** | Team is already proficient. Use `clippy` as a teaching tool. Enforce `#![deny(unsafe_code)]` in the crate. |
| **Smaller hiring pool** | Acceptable for a portfolio project. Code quality and completeness matter more. |
| **Library churn** | Pin major versions. Use well-established libraries (Tokio, Axum, sqlx). Avoid niche dependencies. |

## Consequences

### Positive

- Compile-time guarantees for financial invariants (e.g., debits == credits enforced at type level)
- Predictable runtime performance for transaction processing
- No null pointer exceptions, no data races, no undefined behavior
- Rich enum-based domain modeling (e.g., `AccountType`, `EntryType`)
- Excellent tooling (clippy, rust-analyzer, cargo-audit)

### Negative

- Slower iteration during initial development due to compile times
- Must manage Rust-specific concerns (lifetimes, borrow checker) in async context
- Smaller library selection compared to Go/Node.js for certain integrations
- Need to stay current with Rust edition changes (we target 2021 edition)

### Neutral

- Async model (Tokio) is conceptually similar to Go's goroutines and Node.js event loop
- Error handling via `anyhow` and `thiserror` is explicit but verbose compared to exceptions
- Testing infrastructure (test containers, property-based testing) is well-supported but requires setup

## References

- [Axum Documentation](https://docs.rs/axum/latest/axum/)
- [Tokio Documentation](https://tokio.rs/)
- [sqlx Documentation](https://docs.rs/sqlx/latest/sqlx/)
- [Lapin Documentation](https://docs.rs/lapin/latest/lapin/)
- [OpenTelemetry Rust](https://opentelemetry.io/docs/instrumentation/rust/)
- [Rust Language Reference](https://doc.rust-lang.org/reference/)