# Engineering Guide

Operational standards for working in this combo repo. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12 and Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

### API (`api/`)

| Command | Scope |
|---|---|
| `mise run api:install` | Install/update from `uv.lock`. `uv sync` |
| `mise run api:dev` | Dev server with reload. `uv run uvicorn <pkg>.main:app --reload --port 8000` |
| `mise run api:test` | Run tests. `uv run pytest` |
| `mise run api:lint` | Lint. `uv run ruff check .` |
| `uv run ruff format .` | Format. |
| `mise run api:typecheck` | Static type check. `uv run ty check` |
| `mise run api:openapi` | Emit contract artifact. `uv run python -m <pkg>.scripts.emit_openapi > ../shared/openapi.json` |

### Web (`web/`)

| Command | Scope |
|---|---|
| `mise run web:install` | Install deps. `pnpm install` |
| `mise run web:dev` | Vite dev server. Proxies `/api` -> `http://localhost:8000`. `pnpm run dev` |
| `mise run web:gen-api` | Runs `api:openapi` first. `openapi-typescript ../shared/openapi.json -o src/api-client/types.ts` (or your generator of choice). `pnpm run gen:api` |
| `mise run web:typecheck` | `tsc --noEmit`. `pnpm run typecheck` |
| `mise run web:lint` | Biome or ESLint. `pnpm run lint` |
| `mise run web:build` | Production bundle to `dist/`. `pnpm run build` |
| `mise run web:test` | Vitest. `pnpm run test` |

`mise run check` runs api lint/typecheck/test and web typecheck/lint/test. `mise run install` installs both sides.

State command scope precisely. "Tests pass" means the suite you actually ran.

## The Contract (Source of Truth)

The pydantic models in `api/src/<pkg>/models/` are the **only** authoritative source of the API shape.

Flow:

1. Edit / add a pydantic `BaseModel` in `api/`.
2. Run `uv run python -m <pkg>.scripts.emit_openapi > ../shared/openapi.json`.
3. Run `mise run web:gen-api` to refresh `web/src/api-client/types.ts`.
4. Commit `models/`, `shared/openapi.json`, and the generated types together.

Rules:

- The web client **never** authors a type that overlaps with an API response shape. Always pull from generated types.
- If you find yourself patching `types.ts` by hand to fix a TS error, the fix belongs in the pydantic model (or the route's `response_model`). Regenerate.
- Treat `shared/openapi.json` as a build artifact that is also a contract - committed for traceability, regenerated on every model change.

## API (Python) Standards

Inherit the rules from the standalone `python` preset (this file is a subset). Highlights:

- `from __future__ import annotations` at module top. Type hints on everything public.
- `ty check` strict. No implicit `Any`.
- `Settings(BaseSettings)` is the only env reader. Constructed once in app factory. Never `os.environ.get` in business logic.
- Internal data: `@dataclass(frozen=True, slots=True)`. External boundary: `pydantic.BaseModel`.
- FastAPI route handlers validate inputs (path/query/body), delegate to services, return typed `response_model`.
- Services own DB and external-SDK calls. Routes do not.
- Async vs sync: pick one stance per service. If you use `def` handlers, FastAPI runs them on a threadpool; if `async def`, the whole stack must be async-aware.

## Web (TypeScript) Standards

Inherit the rules from the standalone `frontend-ts` preset. Highlights:

- Strict TypeScript. No implicit `any`.
- React + Vite + Tailwind. shadcn/Radix primitives.
- `react-hook-form` + Zod resolver for forms. Validate against shapes derived from the generated types where possible.
- Every async surface renders idle/loading/success/error explicitly.
- API client (`web/src/api-client/index.ts`) is a thin `fetch` wrapper that consumes generated types. No business logic.
- TODO: state management library (MobX / Zustand / Context).
- TODO: server-data caching (TanStack Query / SWR / hand-rolled).

## Dev Loop

- Two terminals: `cd api && uv run uvicorn ...` and `mise run web:dev`.
- Vite proxies `/api` to the FastAPI port. Web fetches `/api/...` and never knows the API origin in dev.
- When you change a pydantic model: regenerate `shared/openapi.json` and `web/src/api-client/types.ts` before web typechecks.

## Build & Deploy

Default: TODO. Choose one of:

- **Same-origin**: FastAPI mounts the built `web/dist/` as static files. Single deploy artifact.
- **Split-origin**: web on a CDN, API on a separate host. CORS configured explicitly in FastAPI. `VITE_API_BASE_URL` injected at build time.

Document the choice in `.context/project-context.md` and reflect it in `web/vite.config.ts` and the API's static-mount config.

## Auth & Error Envelope

TODO. Pick once and document:

- Auth: TODO (session cookie / bearer token / OIDC proxy headers). Whichever, expose a JSON endpoint the web client uses to derive logged-in state. Do not duplicate auth state in client storage.
- Error envelope: a single error response shape across all endpoints (`{ "error": { "code": ..., "message": ... } }`). Define it as a pydantic model so it appears in the OpenAPI schema and ends up in generated TS types.

## Testing

- API: pytest. Use `TestClient` from `fastapi.testclient` or `httpx.AsyncClient`. DB tests use a real Postgres (containerized) or sqlite for unit-level. Mock the network at adapter seams, not inside service methods.
- Web: Vitest + jsdom for components. MSW for fetch mocking, fed by the generated types so tests stay in sync.
- Contract: optional snapshot test that the committed `shared/openapi.json` matches a fresh emit. Catches forgotten regeneration in PRs.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output on each side. They pollute results, slow `find`, and hold no source-of-truth content.

Web (`web/`):

- `node_modules/`, `dist/`, `.vite/`, `coverage/`, `.turbo/`, `.tsbuildinfo`

API (`api/`):

- `.venv/`, `venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.tox/`, `dist/`, `build/`, `*.egg-info/`, `.coverage`, `htmlcov/`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,.vite,coverage,.venv,venv,__pycache__,.pytest_cache,.ruff_cache,.mypy_cache,build,*.egg-info}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name .venv -o -name __pycache__ -o -name .pytest_cache -o -name coverage \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (`uv.lock`, web lockfile, committed `shared/openapi.json`).

## Settings

Each side owns its own typed settings seam. Settings never cross the contract - only request/response shapes do.

**API (`api/`)** - `Settings(BaseSettings)` in `api/src/<pkg>/settings.py` is the only env reader:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")
    database_url: str
    log_level: str = "INFO"
```

Constructed once in `api/src/<pkg>/main.py` (the app factory). Services take `Settings` (or specific fields) in. **Never** `os.environ.get(...)` in domain code.

**Web (`web/`)** - `web/src/env.ts` is the only module that reads `import.meta.env`:

```ts
import { z } from "zod";

const Env = z.object({
  VITE_API_BASE_URL: z.string().url().optional(),
  MODE: z.enum(["development", "production", "test"]),
});

export const env = Env.parse(import.meta.env);
```

Rules:

- API secrets never reach the web bundle. The only API-related value in `web/` is the public base URL (and even that is optional in same-origin deploys).
- New API env var: extend `Settings`, update `api/.env.example`, document any operational rollout in `.context/project-context.md`.
- New web env var: extend the Zod schema, add to `web/.env.example`, prefix with `VITE_`.
- Tests on each side build settings from overrides - never mutate `os.environ` or `import.meta.env` globally.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `pyproject.toml`, `uv.lock`, `package.json`, `tsconfig*.json`, lock files, `vite.config.ts`, `ruff.toml`, `pytest.ini`, and `shared/openapi.json`.

Use `.env.example` only for variable names. Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Contract changes ride together.** A pydantic model edit in `api/` commits in the same change as the regenerated `shared/openapi.json` and `web/src/api-client/types.ts`. Splitting them creates silent drift.
- **Lockfile updates commit with the source change** that triggered them (`uv.lock` with `pyproject.toml`; web lockfile with `package.json`).
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
- Update `Commands` when scripts change in either side.
- Update `.context/project-context.md` when architecture, integrations, or ownership shift.
- Every API model change triggers contract regen. If you change `models/` without committing the new `openapi.json` and `types.ts`, the contract drifts silently - treat that as a bug.
- Record durable cross-language decisions (deploy topology, auth scheme, error envelope, pagination model) in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
