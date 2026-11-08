# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) — what this codebase is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) — commands, Python standards, pipeline patterns, optional Databricks / dbt sections, safety.
- [.context/writing-tdds.md](.context/writing-tdds.md) — how to write a Technical Design Document for this repo.
- [.context/README.md](.context/README.md) — `.context/` conventions: durable guides vs. ephemeral `active/` design docs (`YYYYMMDD-<title>.md`, deleted when the work lands).

## Stack

Typed Python data-pipeline repo with `uv` for dependency and environment management, `ruff` for lint/format, `ty` for static type checking, `pytest` for tests. `pydantic-settings` for env-driven configuration; `pydantic` at ingestion boundaries; `@dataclass(frozen=True, slots=True)` for internal value objects. Dataframe library TODO (pandas / polars / PySpark). Dataframe schema validation TODO (pandera / framework-native expectations / none). Warehouse TODO. Orchestrator TODO (cron / Airflow / Dagster / Databricks Jobs / dbt Cloud). If Databricks or dbt is adopted, follow the optional sections in `.context/engineering-guide.md`.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

```
mise run install    # uv sync — install/update from uv.lock
mise run pipeline   # uv run python -m <pkg> run <pipeline> — run a named pipeline (TODO: confirm entry/CLI)
mise run test       # uv run pytest — tests
mise run lint       # uv run ruff check . — lint
mise run format     # uv run ruff format . — format
mise run typecheck  # uv run ty check — static type check
mise run check      # lint + typecheck + test
uv run pytest -k <expr>              # filtered tests
# TODO if dbt: uv run dbt build --select <model>
# TODO if Databricks: databricks bundle validate / deploy -t <target>
```

Cite exact command scope. Do not claim a command runs every test unless `pyproject.toml` / `pytest.ini` proves it.

## Standards

- Python TODO: minimum version (e.g., 3.12+). Pin in `pyproject.toml` `requires-python`.
- `from __future__ import annotations` at the top of every module. Type hints on every public function.
- `ty check` strict. No implicit `Any` in the codebase.
- `Settings(BaseSettings)` from `pydantic-settings` is the **only** path env vars take into the app. Constructed once at startup; passed explicitly downstream. Never `os.environ.get(...)` in business logic.
- Internal data: `@dataclass(frozen=True, slots=True)`. External boundaries (source records, file rows, third-party responses): `pydantic.BaseModel`.
- Layout: `src/<pkg>/` source, `tests/` mirrors the package tree. `__init__.py` per package, but keep them empty or expose narrow public APIs only.
- Pipelines are idempotent and re-runnable: re-running for the same partition produces the same result (overwrite-by-partition or merge-by-key, never blind append).
- Validate at ingestion: external records pass through `pydantic.BaseModel` (row-level) or a dataframe schema check (TODO: tool) before entering transforms.
- Every published dataset has an explicit partition/key strategy. Backfills run the same code with partition-range parameters — no one-off scripts.
- Notebooks (if any) are thin wrappers over package code, never the source of truth. See `.context/engineering-guide.md`.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials, `profiles.yml`, `~/.databrickscfg`, or production data extracts. Full list in `.context/engineering-guide.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## Where To Edit

| File | Owns |
|---|---|
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `pyproject.toml` | Package metadata, deps, tool config (ruff, ty, pytest). |
| `uv.lock` | Resolved dependency lockfile. Do not hand-edit. |
| `src/<pkg>/settings.py` | `Settings(BaseSettings)`. The one place env vars are read. |
| `src/<pkg>/__main__.py` | Pipeline CLI entry. Builds `Settings`, wires adapters, runs a named pipeline. |
| `src/<pkg>/pipelines/<name>/` | One pipeline per dir: `ingest.py`, `transform.py`, `publish.py` (TODO: or bronze/silver/gold — pick one stage convention). |
| `src/<pkg>/contracts/` | Pydantic ingestion models + dataframe schemas. The data contracts. |
| `src/<pkg>/io/` | Warehouse / object-storage / source-API adapters. Only layer that knows connection details. |
| `sql/` | TODO: SQL transforms if any (or a dbt project — see optional section in engineering guide). |
| `tests/` | Pytest suite mirroring `src/`. |
| `tests/fixtures/` | Small committed synthetic sample data for pipeline tests. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `pyproject.toml` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Record warehouse, orchestrator, dataframe library, validation tool, and stage-naming choices in `.context/project-context.md` so they survive turnover.
