# Engineering Guide

Operational standards for working in this FastAPI service. Read before changing code.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install/update from `uv.lock`. Creates `.venv/` if missing. `uv sync` |
| `mise run dev` | Dev server (TODO: confirm entry path). `uv run uvicorn <pkg>.main:app --reload` |
| `mise run test` | Run full test suite. `uv run pytest` |
| `mise run check` | Lint + type check + tests. |
| `uv run pytest -k <expr>` | Filter by expression. |
| `uv run pytest tests/<file>` | Run one test file. |
| `mise run lint` | Lint. `uv run ruff check .` |
| `uv run ruff check --fix .` | Lint + autofix safe changes. |
| `mise run format` | Format. `uv run ruff format .` |
| `mise run typecheck` | Static type check. `uv run ty check` |
| `mise run openapi` | Dump `app.openapi()` JSON to stdout (TODO: confirm entry). `uv run python -m <pkg>.openapi` |
| `uv lock --upgrade` | Refresh `uv.lock` (intentional dep upgrade). |

State command scope exactly. Do not say "tests pass" if `-k` filtered out coverage you needed.

## Python Standards

- `from __future__ import annotations` at the top of every module.
- Type hints on every public function, method, and module-level value. Internal helpers should be typed too unless trivially obvious.
- `ty check` strict. No implicit `Any`. Annotate generics fully (`list[int]`, not `list`).
- Prefer composition over inheritance. Inheritance is for type substitutability, not code reuse.
- No mutable default arguments. No mutable module-level state.
- Imports: stdlib, third-party, first-party - three groups, each sorted. `ruff` enforces.
- Async throughout. Every route handler, every client call, every dependency that touches I/O is `async`. No `requests`, no sync `httpx.Client`, no thread pool for I/O.

## Data Contracts

Two kinds of data, two tools:

**Internal value objects** - use `@dataclass`:
```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class UserId:
    value: str
```
- `frozen=True` makes instances hashable and forces explicit replace-via-constructor mutation.
- `slots=True` for memory and to catch typos that would otherwise create stray attributes.
- Internal data does not need runtime validation - the type system covers it.

**External boundaries** - use `pydantic.BaseModel`:
```python
from pydantic import BaseModel, Field

class CreateUserRequest(BaseModel):
    email: str = Field(min_length=3)
    name: str
```
- HTTP request/response bodies and upstream API responses.
- Validate **once** at the boundary, then convert to internal `@dataclass` for downstream code.

## Layout

```
src/
  <pkg>/
    __init__.py          # narrow public surface
    main.py              # FastAPI app factory + lifespan
    settings.py          # Settings(BaseSettings)
    auth.py              # auth dependency
    errors.py            # exception types + handlers
    openapi.py           # CLI entry: dump app.openapi() (optional)
    routes/
      __init__.py
      <domain>.py        # APIRouter per domain
    services/
      <domain>.py        # business logic
    clients/
      <upstream>.py      # httpx.AsyncClient adapter
tests/
  conftest.py            # shared fixtures (httpx.AsyncClient against app)
  routes/
    test_<domain>.py
  services/
    test_<domain>.py
```

- One router per domain. Routers mounted in `main.py`.
- Clients are thin: take an `AsyncClient` in, call out, validate response with Pydantic, return.

## FastAPI Patterns

- **App factory** in `main.py`. `create_app(settings: Settings) -> FastAPI`. The factory mounts routers, registers exception handlers, and wires the lifespan handler.
- **Lifespan** (`@asynccontextmanager`) constructs the shared `httpx.AsyncClient` with timeouts and stores it on `app.state`. The dependency `get_http_client` yields it. The client closes on shutdown.
- **Routers** are per-domain `APIRouter(prefix="/...", tags=[...])`. Mount with `app.include_router(...)` in the factory.
- **Endpoints** declare `response_model=` so OpenAPI gets typed responses without depending on inferred annotations. `status_code=` set explicitly when not 200.
- **Dependencies** carry typed values in: `Settings`, principal (from `auth.py`), `AsyncClient`. Services receive these as constructor args, not as globals.
- **Versioning**: prefix per major version (`/v1/...`) if you expect to break compatibility. Decide early and record in `.context/project-context.md`.

## Auth

- One dependency in `auth.py`: `async def current_principal(...) -> Principal`. Verifies the token once, returns a `@dataclass` principal.
- Protected routes declare `principal: Principal = Depends(current_principal)`. Public routes omit the dependency.
- TODO: provider (JWT issuer + JWKS / session backend / API key store / mTLS).
- Auth errors raise a typed exception (e.g. `Unauthorized`, `Forbidden`) that the centralized handler maps to `401` / `403` with a problem+json envelope.
- Tests override the dependency with `app.dependency_overrides[current_principal] = ...`. Do not mint real tokens in tests.

## Errors

- Define typed exceptions in `errors.py`. Register handlers with `app.exception_handler(MyError)` in the app factory.
- Default envelope: `application/problem+json` (RFC 7807) - `{ "type", "title", "status", "detail", "instance" }`. TODO: confirm or override per house style.
- Never leak tracebacks or upstream error bodies to clients. Log internally with the full context; respond with a safe envelope.
- Map Pydantic `RequestValidationError` to `422` (FastAPI default) or remap to `400` with the same problem+json shape - pick one and stick to it.
- Each error response carries the request id (set in middleware) so logs and client reports correlate.

## Outbound HTTP (httpx)

- One `httpx.AsyncClient` per app lifetime, created in lifespan, closed on shutdown. Injected via dependency.
- Explicit timeouts on the client (`httpx.Timeout(connect=..., read=..., write=..., pool=...)`). No silent infinite waits.
- Each client adapter lives in `src/<pkg>/clients/<upstream>.py`, takes the shared `AsyncClient` in, exposes typed methods.
- Responses are Pydantic-validated before being returned to the service. A schema mismatch is a programming error and surfaces as 502 via the error handler.
- Retry posture stated per call site. Idempotent GETs may retry with backoff; POSTs require an explicit idempotency key from the caller.
- Outbound credentials come from `Settings`, not `os.environ`.

## OpenAPI Export

- FastAPI's `app.openapi()` is the authoritative schema - generated from Pydantic models and route signatures.
- Expose an export entry (e.g. `python -m <pkg>.openapi`) that prints `json.dumps(app.openapi())` to stdout. Downstream consumers (clients, gateway configs) run this in CI.
- Commit a generated `openapi.json` in-repo only if a consumer pins to it; otherwise let downstream pipelines regenerate.
- When models change in a way that breaks the schema, the export commits in the same PR as the model edit.

## Testing

- Pytest + `pytest-asyncio`. Test modules mirror `src/<pkg>/` paths.
- Integration tests build the app via the factory, then issue requests with `httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")`. No live server.
- Override dependencies with `app.dependency_overrides[...]` for auth principals, settings, and clients. Reset overrides in fixture teardown.
- Mock at the client boundary (a fake `AsyncClient` or a `respx` mounted transport), not inside service methods.
- **Do not `unittest.mock.patch` first-party modules.** If a test feels like it needs that, the code under test is missing a seam - pass the dependency in instead.
- `tmp_path` for filesystem. `pytest.MonkeyPatch` for env vars before constructing `Settings`.
- Reset any module-level singletons in fixture teardown. Better: do not have module-level singletons.

## Boundaries

- Routes do not import from `clients/`. Routes call services; services call clients.
- Services do not read `os.environ`. They take `Settings` (or specific fields) in.
- Clients do not contain business logic. They translate request/response shapes.
- Domain models do not import from `clients/` or `routes/`. Dependency arrow points inward.
- `main.py` (the app factory) is the only place that knows about both `Settings` and concrete adapter implementations.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `.venv/`, `venv/`
- `__pycache__/`
- `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.tox/`
- `dist/`, `build/`
- `*.egg-info/`
- `.coverage`, `htmlcov/`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{.venv,venv,__pycache__,.pytest_cache,.ruff_cache,.mypy_cache,dist,build,*.egg-info}/**' '<pattern>'
find . -type d \( -name .venv -o -name venv -o -name __pycache__ -o -name .pytest_cache -o -name dist -o -name build \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (e.g. `uv.lock`, generated `openapi.json`).

## Settings

`pydantic-settings` is the entry point for all environment variables.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")
    log_level: str = "INFO"
    # TODO: auth issuer / audience, upstream API base URLs and keys.
```

Rules:
- One `Settings` class per app. Constructed exactly once at startup, inside the app factory.
- Every env-driven value goes through it. **Never** call `os.environ.get(...)` in domain code.
- `Settings` (or specific fields) are passed in via FastAPI dependencies (`Depends(get_settings)`), not imported as a global.
- In tests, build a `Settings` with overrides or use `monkeypatch.setenv(...)` before constructing the app.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `pyproject.toml`, `uv.lock`, `pytest.ini`, `tox.ini`, `ruff.toml`, and public config files.

Use `.env.example` only for variable names. Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Lockfile updates commit with the source change that triggered them.** `uv.lock` rides with the `pyproject.toml` edit. Generated `openapi.json` (if committed) rides with the Pydantic model edit that produced it.
- **Never commit secrets.** Real tokens, DSNs, bearer headers, cloud credentials. `.env.example` is for variable names only.
- **Preserve unrelated dirty work.** Never restage or revert files you did not intentionally touch.

## Local Agent Scratch

Agents drop transient working files at repo root while in the middle of a task: `PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`. These reflect one session's in-flight reasoning. They are not durable design docs and should not enter git.

Add to `.gitignore`:

```
PLAN.md
TODO.md
NOTES.md
SCRATCH.md
```

- `AGENTS.md` is **durable** and stays committed. It is the canonical entrypoint, not scratch - do not add it to `.gitignore`.
- Durable architecture, decisions, and short-lived focus notes belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.

## Context Maintenance

- Keep `AGENTS.md` compact. Push detail into these files.
- Update `Commands` when `pyproject.toml` scripts change.
- Update `.context/project-context.md` when architecture, integrations, or ownership shift.
- Record durable decisions (auth model, error envelope, async stance, deployment target) in `.context/project-context.md`.
- In-flight specs, DDs, and TDDs live in `.context/active/`; see `.context/writing-specs.md#lifecycle` for naming and lifecycle.
