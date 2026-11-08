# Project Context

Durable architecture and ownership. Update when the shape of the codebase changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What data this repo ingests, transforms, and publishes; who consumes the outputs; what schedule it runs on.

Default assumption baked into this preset: a typed Python data-pipeline codebase managed with `uv`. Configuration flows through a single `Settings(BaseSettings)` object. Internal data is `@dataclass`; external boundaries use `pydantic.BaseModel` or a dataframe schema check. Pipelines are idempotent and partition-aware. Warehouse TODO; orchestrator TODO; ingestion sources TODO.

## Architecture (Data Flow)

```
source systems (TODO: APIs / files / DBs / events)
  → ingest: io/ adapters pull raw data; validate at the boundary
      (pydantic per record, or dataframe schema check — TODO: tool)
  → transform: pure functions over typed data / dataframes
  → publish: partitioned, idempotent writes via io/ adapters
      → warehouse / object storage (TODO: target)
orchestrator (TODO) triggers pipeline runs
Settings(BaseSettings) ← env vars (only here)
```

Source of truth for runtime config: the `Settings` instance. Source of truth for published data: TODO (warehouse tables / object-store paths). Transforms are pure where possible; I/O sits behind `io/` adapter seams that can be swapped in tests. Stage convention TODO: `ingest/transform/publish` or `bronze/silver/gold` — pick one and record in `.context/project-context.md`.

## Ownership Map

| Path | Owns |
|---|---|
| `pyproject.toml` | Package metadata, dependencies, tool config (ruff, ty, pytest). |
| `uv.lock` | Resolved dependency lockfile. |
| `src/<pkg>/__init__.py` | Public surface for the package. Keep narrow. |
| `src/<pkg>/settings.py` | The `Settings(BaseSettings)` class. Only file that reads env. |
| `src/<pkg>/__main__.py` | Pipeline CLI entry. Builds `Settings`, wires adapters, runs a named pipeline. |
| `src/<pkg>/pipelines/<name>/` | One pipeline per dir: `ingest.py`, `transform.py`, `publish.py`. |
| `src/<pkg>/contracts/` | Pydantic ingestion models + dataframe schemas. The data contracts. |
| `src/<pkg>/io/` | Warehouse / object-storage / source-API adapters. Only layer that knows connection details. |
| `sql/` | TODO: SQL transforms if any (or a dbt project — see engineering guide). |
| `notebooks/` | TODO: only if notebooks exist — thin wrappers, outputs stripped. |
| `tests/` | Pytest suite. Mirrors `src/<pkg>/` layout. |
| `tests/conftest.py` | Shared fixtures (no global mutable state). |
| `tests/fixtures/` | Small committed synthetic sample data for pipeline tests. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, env vars, run commands. |

## External Integrations

TODO. Document each external system this codebase talks to:
- TODO: warehouse / storage target (engine, auth, write pattern).
- TODO: each ingestion source (auth scope, rate limits, incremental cursor).
- TODO: orchestrator / scheduler (what triggers runs, where logs land).
- TODO: object storage (bucket layout, retention).
- TODO: secrets backend (env var / vault / cloud secret manager).

For each: where credentials come from, what is read vs written, what happens on failure.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No `os.environ` reads outside `Settings`.
- No mutable module-level state shared across requests/calls.
- No `Any` in domain code. Boundaries may use `dict[str, Any]` only when calling into untyped third-party APIs, and must immediately validate into a typed model.
- No `unittest.mock.patch` on first-party modules. If you reach for it, restructure for dependency injection instead.
- No global database/HTTP clients constructed at import time. Build inside the composition root.
- No blind-append writes to published datasets — every write is overwrite-by-partition or merge-by-key.
- No unvalidated external data crossing into transforms.
- No business logic in notebooks or in orchestrator DAG/job definitions — they call package code.
- No reads of production data into tests — fixtures only.
