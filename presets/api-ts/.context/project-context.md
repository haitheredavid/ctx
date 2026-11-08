# Project Context

Durable architecture and ownership. Update when the shape of the service changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What surface this API exposes, who consumes it (browser / mobile / another service), what it talks to upstream.

Default assumption baked into this preset: a Node + TypeScript HTTP API. Persistence is external — databases, caches, and queues sit behind outbound adapters or other services. Hono owns the surface; Zod owns the contract; OpenAPI is generated from those Zod schemas, not maintained in parallel.

## Architecture (Data Flow)

```
HTTP request
  → Hono middleware chain (auth, request id, logger)
  → Hono route (Zod-validated input)
  → service module (business logic)
  → outbound adapter (HTTP / queue / external store) via typed client
  → typed response (Zod-encoded)
```

Source of truth for the HTTP contract is the Zod schemas. Source of truth for persistent data lives outside this repo (TODO: identify — DB service, upstream API, message bus). The API does not own background processing; long-running work is pushed to a separate worker or external job runner.

## Ownership Map

| Path | Owns |
|---|---|
| `src/index.ts` | HTTP server entry. Wires config, logger, middleware, routes, error handlers. |
| `src/routes/` | Route handlers. Validate inputs, delegate to services, shape responses. |
| `src/services/` | Business logic. The only layer that calls outbound clients. |
| `src/middleware/auth.ts` | Auth middleware. Attaches identity to `c.var`. |
| `src/middleware/errors.ts` | Centralized error middleware. Maps errors to `application/problem+json`. |
| `src/lib/http-client.ts` | Outbound HTTP wrapper. Timeouts, retries, Zod-validated responses. |
| `src/lib/logger.ts` | Pino factory; loggers carry request context. |
| `src/config.ts` | Env parsing (Zod-validated) into typed config. |
| `src/schemas/` | Shared Zod schemas (optional — colocated per route is also fine). |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, env vars, deployment. |

## External Integrations

TODO. Document each external system this API talks to:
- TODO: auth provider (issuer, token validation, session source of truth).
- TODO: upstream APIs (rate limits, retry posture, credential scope).
- TODO: queue or event bus (if this API enqueues async work).
- TODO: object storage (if this API generates signed URLs or proxies uploads).
- TODO: telemetry sink (logs, metrics, traces).

For each: where credentials come from, what the API reads vs writes, what happens on failure.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No business logic in route handlers — they validate and delegate.
- No outbound calls outside `src/services/` and `src/lib/http-client.ts`.
- No in-process database. Persistence lives behind an external adapter.
- No long-running work inside HTTP handlers — push to an external worker if it cannot complete inside a request timeout.
- No hand-maintained types parallel to Zod schemas.
- No secrets in source, build artifacts, or logs.
