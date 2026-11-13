# Engineering Guide

Operational standards for working in this Python repo. Read before changing code.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install/update from `uv.lock`. Creates `.venv/` if missing. (`uv sync`) |
| `mise run run` | Run package entry point. (`uv run python -m <pkg>`) |
| `mise run test` | Run full test suite. (`uv run pytest`) |
| `uv run pytest -k <expr>` | Filter by expression. |
| `uv run pytest tests/<file>` | Run one test file. |
| `mise run lint` | Lint. (`uv run ruff check .`) |
| `uv run ruff check --fix .` | Lint + autofix safe changes. |
| `mise run format` | Format. (`uv run ruff format .`) |
| `mise run typecheck` | Static type check. (`uv run ty check`) |
| `mise run check` | lint + typecheck + test. |
| `uv lock --upgrade` | Refresh `uv.lock` (intentional dep upgrade). |

State command scope exactly. Do not say "tests pass" if `-k` filtered out coverage you needed.

## Python Standards

- `from __future__ import annotations` at the top of every module.
- Type hints on every public function, method, and module-level value. Internal helpers should be typed too unless trivially obvious.
- `ty check` strict. No implicit `Any`. Annotate generics fully (`list[int]`, not `list`).
- Prefer composition over inheritance. Inheritance is for type substitutability, not code reuse.
- No mutable default arguments. No mutable module-level state (constants are fine if truly immutable).
- Imports: stdlib, third-party, first-party - three groups, each sorted. `ruff` enforces.

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
- HTTP request/response bodies, third-party API responses, anything entering the process from outside.
- Validate **once** at the boundary, then convert to internal `@dataclass` for downstream code.

## Layout

```
src/
  <pkg>/
    __init__.py          # narrow public surface
    __main__.py          # `python -m <pkg>` entry
    settings.py          # Settings(BaseSettings)
    <domain>/
      __init__.py
      models.py          # @dataclass value objects
      services.py        # business logic (pure where possible)
      adapters/          # I/O seams (HTTP / DB / fs)
tests/
  conftest.py            # shared fixtures
  <domain>/
    test_services.py
```

- One package per top-level concern. Avoid deep nesting beyond 2-3 levels.
- `__init__.py` files stay slim - they document what is public, not what exists.
- Adapters are thin: convert in, call out, convert back. No business logic.

## Web / Framework Patterns (Optional)

If this codebase is a web service or worker, follow these:

- HTTP framework TODO (FastAPI / Litestar / Starlette / Flask). Route handlers validate via `BaseModel`, delegate to services, return typed responses.
- Async vs sync: pick one stance per service and stick to it. Mixing is a maintenance trap.
- TODO: ORM (SQLAlchemy / SQLModel / none) - repos hide the ORM behind typed methods.
- TODO: background work (RQ / Celery / arq / cron + script) - workers reuse services; queue is just transport.

## Testing

- Pytest. Test modules mirror `src/<pkg>/` paths.
- Fixtures in `conftest.py`. No global state - every fixture is explicit per-test.
- `tmp_path` for filesystem. `pytest.MonkeyPatch` (via the `monkeypatch` fixture) for env vars.
- **Do not `unittest.mock.patch` first-party modules.** If a test feels like it needs that, the code under test is missing a seam - pass the dependency in instead.
- Third-party SDKs may be patched at their import site, but prefer a thin adapter you can replace with a fake.
- Reset module-level singletons (if any) in fixture teardown. Better: do not have module-level singletons.

## Boundaries

- Services do not parse env or read process state. They take typed config in.
- Adapters do not contain business logic. They translate.
- Domain models do not import from adapters. Dependency arrow points inward.
- `__main__.py` (or the app factory) is the only place that knows about both `Settings` and concrete adapter implementations.

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

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (e.g. `uv.lock`).

## Settings

`pydantic-settings` is the entry point for all environment variables.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")
    database_url: str
    log_level: str = "INFO"
```

Rules:
- One `Settings` class per app. Constructed exactly once at startup.
- Every env-driven value goes through it. **Never** call `os.environ.get(...)` in domain code.
- Pass the `Settings` instance (or specific fields) explicitly into composition root. Do not import a global.
- In tests, build a `Settings` with overrides or use `monkeypatch.setenv(...)` before constructing.

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
- **Lockfile updates commit with the source change that triggered them.** `uv.lock` rides with the `pyproject.toml` edit. Generated OpenAPI or stub artifacts (if any) commit with the model edit that produced them.
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
- Record framework choices (web framework, ORM, async vs sync, task runner) in `.context/project-context.md`.
- In-flight specs, DDs, and TDDs live in `.context/active/`; see `.context/writing-specs.md#lifecycle` for naming and lifecycle.
