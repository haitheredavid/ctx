# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) — what this codebase is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) — commands, Python standards, framework patterns, safety.
- [.context/writing-tdds.md](.context/writing-tdds.md) — how to write a Technical Design Document for this repo.
- [.context/README.md](.context/README.md) — `.context/` conventions: durable guides vs. ephemeral `active/` design docs (`YYYYMMDD-<title>.md`, deleted when the work lands).

## Stack

Python with `uv` for dependency and environment management, `ruff` for lint/format, `ty` for static type checking, `pytest` for tests. `pydantic-settings` for env-driven configuration; `pydantic` at trust boundaries; `@dataclass(frozen=True, slots=True)` for internal value objects.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

```
mise run install               # uv sync — install/update from uv.lock
mise run run                   # uv run python -m <pkg> — run app entry
mise run test                  # uv run pytest — tests
mise run lint                  # uv run ruff check . — lint
mise run format                # uv run ruff format . — format
mise run typecheck             # uv run ty check — static type check
mise run check                 # lint + typecheck + test
uv run pytest -k <expr>        # filtered tests
```

Cite exact command scope. Do not claim a command runs every test unless `pyproject.toml` / `pytest.ini` proves it.

## Standards

- Python TODO: minimum version (e.g., 3.12+). Pin in `pyproject.toml` `requires-python`.
- `from __future__ import annotations` at the top of every module. Type hints on every public function.
- `ty check` strict. No implicit `Any` in the codebase.
- `Settings(BaseSettings)` from `pydantic-settings` is the **only** path env vars take into the app. Constructed once at startup; passed explicitly downstream. Never `os.environ.get(...)` in business logic.
- Internal data: `@dataclass(frozen=True, slots=True)`. External boundaries (HTTP bodies, third-party responses, user input): `pydantic.BaseModel`.
- Layout: `src/<pkg>/` source, `tests/` mirrors the package tree. `__init__.py` per package, but keep them empty or expose narrow public APIs only.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/engineering-guide.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## Where To Edit

| File | Owns |
|---|---|
| `pyproject.toml` | Package metadata, deps, tool config (ruff, ty, pytest). |
| `uv.lock` | Resolved dependency lockfile. Do not hand-edit. |
| `src/<pkg>/settings.py` | `Settings(BaseSettings)`. The one place env vars are read. |
| `src/<pkg>/main.py` (or `__main__.py`) | Composition root. Builds `Settings`, wires services, runs the app. |
| `src/<pkg>/<domain>/` | Domain modules. Pure logic + small adapters. |
| `tests/` | Pytest suite mirroring `src/`. |
| `.context/` | Durable architecture, decisions, debt. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `pyproject.toml` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Record framework/library choices (web framework, ORM, task runner) in `.context/project-context.md` so they survive turnover.
