# Project Context

Durable architecture and ownership. Update when the shape of the service changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What surface this API exposes, who consumes it (browser / mobile / another service), what it talks to upstream.

Default assumption baked into this preset: a Python FastAPI service. Async throughout. Persistence is external — databases, caches, and queues sit behind outbound clients or other services. Pydantic owns the contract; FastAPI's `app.openapi()` is the authoritative schema. Internal data is `@dataclass`; external boundaries use `pydantic.BaseModel`.

## Architecture (Data Flow)

```
HTTP request
  → FastAPI dependency chain (auth, request id, settings)
  → FastAPI route (Pydantic request model)
  → service module (business logic)
  → httpx.AsyncClient adapter (upstream API)
  → Pydantic response model
```

Source of truth for the HTTP contract is the Pydantic models — FastAPI generates OpenAPI from them. Source of truth for persistent data lives outside this repo (TODO: identify — DB service, upstream API, message bus). Background work, if any, runs out-of-process; this service does not host long-running tasks inside request handlers.

## Ownership Map

| Path | Owns |
|---|---|
| `pyproject.toml` | Package metadata, dependencies, tool config (ruff, ty, pytest). |
| `uv.lock` | Resolved dependency lockfile. |
| `src/<pkg>/settings.py` | `Settings(BaseSettings)`. Only file that reads env. |
| `src/<pkg>/main.py` | FastAPI app factory. Lifespan creates `httpx.AsyncClient`, wires routers, registers exception handlers. |
| `src/<pkg>/routes/` | FastAPI routers per domain. Validate, delegate, respond. |
| `src/<pkg>/services/` | Business logic. The only layer that calls clients. |
| `src/<pkg>/clients/` | `httpx.AsyncClient` adapters for upstream APIs. Pydantic-validated responses. |
| `src/<pkg>/auth.py` | Auth dependency. Yields the verified principal. |
| `src/<pkg>/errors.py` | Exception types + handler registrations. |
| `src/<pkg>/openapi.py` | Optional entry that dumps `app.openapi()` for downstream consumers. |
| `tests/` | Pytest suite mirroring `src/`. |
| `tests/conftest.py` | Shared fixtures (no global mutable state). |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, env vars, run commands. |

## External Integrations

TODO. Document each external system this API talks to:
- TODO: auth provider (issuer, JWKS endpoint, audience / scope checks).
- TODO: upstream APIs (rate limits, retry posture, credential scope).
- TODO: queue or event bus (if this API enqueues async work).
- TODO: object storage (if this API generates signed URLs or proxies uploads).
- TODO: telemetry sink (logs, metrics, traces).

For each: where credentials come from, what the API reads vs writes, what happens on failure.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No `os.environ` reads outside `Settings`.
- No business logic in route handlers — they validate and delegate.
- No outbound calls outside `src/<pkg>/services/` and `src/<pkg>/clients/`.
- No in-process database. Persistence lives behind an external adapter.
- No long-running work inside HTTP handlers — push to an external worker.
- No `unittest.mock.patch` on first-party modules. If you reach for it, restructure for dependency injection.
- No global `httpx.AsyncClient` constructed at import time. Build inside the FastAPI lifespan.
- No hand-maintained schema parallel to Pydantic models — FastAPI's OpenAPI is authoritative.
