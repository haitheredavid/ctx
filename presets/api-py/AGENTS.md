# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this API is, architecture, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, Python standards, FastAPI patterns, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

## Stack

Python HTTP API. FastAPI + Pydantic for request/response models, `pydantic-settings` for env-driven configuration, `httpx.AsyncClient` for outbound calls, `pytest` + `httpx.AsyncClient` (via `pytest-asyncio`) for tests, `uv` for environment management, `ruff` for lint/format, `ty` for static type checking. Async throughout. Storage is external - this preset does not assume an in-process database; persistence sits behind outbound clients or other services.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

```
mise run install    # uv sync - install/update from uv.lock
mise run dev        # uv run uvicorn <pkg>.main:app --reload - dev server (TODO: confirm entry)
mise run test       # uv run pytest - tests
mise run lint       # uv run ruff check .
mise run format     # uv run ruff format .
mise run typecheck  # uv run ty check - static type check
mise run openapi    # uv run python -m <pkg>.openapi - TODO: dump openapi.json from app.openapi()
mise run check      # lint + typecheck + test
uv run pytest -k <expr>              # filtered tests
```

Cite exact command scope. Do not claim a command runs every test unless `pyproject.toml` / `pytest.ini` proves it.

## Standards

- Python TODO: minimum version (e.g., 3.12+). Pin in `pyproject.toml` `requires-python`.
- `from __future__ import annotations` at the top of every module. Type hints on every public function.
- `ty check` strict. No implicit `Any` in the codebase.
- Async throughout: every route handler and every outbound call is `async`. No sync I/O inside request handling. Mixing sync and async is a maintenance trap.
- `pydantic.BaseModel` at every trust boundary - HTTP requests/responses and outbound responses. Validate once at the edge, convert to internal `@dataclass` for downstream code.
- `Settings(BaseSettings)` from `pydantic-settings` is the **only** path env vars take into the app. Constructed once at startup, passed explicitly via FastAPI dependencies. Never `os.environ.get(...)` in business logic.
- One `httpx.AsyncClient` per app lifetime, created in the lifespan handler and injected via dependency. Do not construct clients per request.
- Auth via FastAPI dependency (`Security(...)`). TODO: provider (JWT / session / API key / mTLS).
- Errors flow through `app.exception_handler(...)` emitting `application/problem+json` (RFC 7807) by default. Never leak tracebacks. TODO: confirm or override envelope.
- FastAPI's `app.openapi()` is authoritative for the contract; the schema is generated from Pydantic models, not hand-maintained.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/guides/engineering.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/guides/engineering.md`](.context/guides/engineering.md).

## MCP Servers

- TODO: list MCP servers agents may use (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`).

## Skills

- TODO: list agent skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`).

## Where To Edit

| File | Owns |
|---|---|
| `pyproject.toml` | Package metadata, deps, tool config (ruff, ty, pytest). |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `uv.lock` | Resolved dependency lockfile. Do not hand-edit. |
| `src/<pkg>/settings.py` | `Settings(BaseSettings)`. The one place env vars are read. |
| `src/<pkg>/main.py` | FastAPI app factory. Builds `Settings`, mounts routers, registers handlers, runs lifespan. |
| `src/<pkg>/routes/` | FastAPI routers per domain. Validate -> service -> response. |
| `src/<pkg>/services/` | Business logic. The only layer that calls outbound clients. |
| `src/<pkg>/clients/` | `httpx.AsyncClient` adapters for upstream APIs. Validate responses with Pydantic. |
| `src/<pkg>/auth.py` | Auth dependency (TODO: provider). Yields the verified principal. |
| `src/<pkg>/errors.py` | Exception types + `app.exception_handler` registrations. |
| `src/<pkg>/openapi.py` | Optional CLI entry that dumps `app.openapi()` to stdout for consumers. |
| `tests/` | Pytest suite mirroring `src/`. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `pyproject.toml` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Record auth/contract/deployment choices in `.context/project-context.md` so they survive turnover.
