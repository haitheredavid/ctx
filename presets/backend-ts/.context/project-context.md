# Project Context

Durable architecture and ownership. Update when the shape of the service changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What surface this service exposes, who consumes it (browser / mobile / another service), what it persists, what it talks to.

Default assumption baked into this preset: a Node + TypeScript backend that serves a typed HTTP API, persists to Postgres via Drizzle, and optionally runs async work behind a queue.

## Architecture (Data Flow)

```
HTTP request
  → Hono route (Zod validation)
  → service module (business logic)
  → Drizzle / provider SDK
  → typed response (Zod-encoded)

# Optional async path
HTTP request
  → route enqueues job (Redis/SQS)
  → worker consumes
  → service module
  → Drizzle write
  → progress / result published
```

Source of truth for durable state is Postgres. Source of truth for in-flight job state (if you have workers) is Redis. The API does not own background processing semantics — the worker does. Keep them split.

## Ownership Map

| Path | Owns |
|---|---|
| `src/index.ts` | HTTP server entry. Wires config, logger, routes, error handlers. |
| `src/routes/` | Route handlers. Validate, delegate to services, shape responses. |
| `src/services/` | Business logic. The only layer that calls Drizzle or provider SDKs. |
| `src/db/schema.ts` | Drizzle table definitions. Single source of truth for shape. |
| `src/db/migrations/` | Generated migration SQL. |
| `src/db/client.ts` | Postgres connection + Drizzle instance. |
| `src/config.ts` | Env parsing (Zod-validated) into typed config. |
| `src/lib/logger.ts` | Pino factory; loggers carry request context. |
| `src/workers/` | (Optional) async consumers. Mirror routes/ shape: validate payload → service → result. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, env vars, deployment. |

## External Integrations

TODO. Document each external system this service talks to:
- Postgres (connection string from env, pool size, schema migration story).
- TODO: auth provider (session source of truth, token validation).
- TODO: object storage (S3 / R2 / local — and what is stored there).
- TODO: queue (SQS / BullMQ / none).
- TODO: third-party APIs (rate limits, retry posture, credential scope).

For each: where credentials come from, what the service reads vs writes, what happens on failure.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No business logic in route handlers — they validate and delegate.
- No ORM calls outside `src/services/` and `src/db/`.
- No long-running work inside HTTP handlers — push to a worker if it cannot complete inside a request timeout.
- No string-concatenated SQL. Drizzle or parameterized raw queries only.
- No secrets in source, build artifacts, or logs.
