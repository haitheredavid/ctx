# Engineering Guide

Operational standards for working in this Python data-pipeline repo. Read before changing code.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install/update from `uv.lock`. Creates `.venv/` if missing. (`uv sync`) |
| `mise run pipeline` | Run a named pipeline. TODO: confirm entry/CLI shape. (`uv run python -m <pkg> run <pipeline>`) |
| `mise run test` | Run full test suite. (`uv run pytest`) |
| `uv run pytest -k <expr>` | Filter by expression. |
| `uv run pytest tests/<file>` | Run one test file. |
| `mise run lint` | Lint. (`uv run ruff check .`) |
| `uv run ruff check --fix .` | Lint + autofix safe changes. |
| `mise run format` | Format. (`uv run ruff format .`) |
| `mise run typecheck` | Static type check. (`uv run ty check`) |
| `mise run check` | Lint + typecheck + test. |
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

class SourceRecord(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
```
- Source API responses, file rows, anything entering the process from outside.
- Validate **once** at the boundary, then convert to internal `@dataclass` for downstream code.

**Dataframe boundaries** - row-level pydantic is right for API/file records; bulk dataframes get a schema check instead:
- Validate dataframe schemas at ingestion and again before publish. TODO: tool - `pandera` schemas for pandas/polars; explicit `StructType` + expectations if PySpark/DLT. Record the choice in `.context/project-context.md`.
- A dataframe with an unchecked schema never crosses a stage boundary. Column names, dtypes, and nullability are part of the contract.

## Layout

```
src/
  <pkg>/
    __init__.py          # narrow public surface
    __main__.py          # CLI: run a named pipeline
    settings.py          # Settings(BaseSettings)
    contracts/           # pydantic models + dataframe schemas
    io/                  # adapters: warehouse, object storage, source APIs
    pipelines/
      <pipeline>/
        ingest.py        # pull + validate raw data
        transform.py     # pure logic over typed data
        publish.py       # partitioned, idempotent writes
sql/                     # TODO: SQL transforms / dbt project (see SQL File Ownership)
tests/
  conftest.py            # shared fixtures
  fixtures/              # small committed sample data
  pipelines/
    <pipeline>/
      test_transform.py
```

- One pipeline per directory. Avoid deep nesting beyond 2-3 levels.
- Adapters are thin: convert in, call out, convert back. No business logic.
- Transforms import from `contracts/`, never from `io/`.

## Pipeline Standards

- **Stage naming**: pick one convention and use it everywhere - `ingest` / `transform` / `publish`, or `bronze` / `silver` / `gold`. TODO: pick, record in `.context/project-context.md`. Do not mix.
- **Idempotency**: re-running a pipeline for the same inputs/partition produces the same published state. Writes are overwrite-by-partition or merge-by-key - never blind append. No side effects that prevent a re-run.
- **Partitioning & backfills**: every published dataset declares an explicit partition key (TODO: per dataset). A backfill is the same entry point with explicit partition-range arguments - no one-off scripts. Backfills must not change current-partition semantics.
- **Incremental vs full-refresh**: pick a stance per pipeline. TODO: record per pipeline in `.context/project-context.md`.

## Local Dev vs Warehouse Execution

- Every transform must run locally against `tests/fixtures/` data with no warehouse credentials.
- Warehouse-specific behavior is isolated in `io/` adapters; transforms stay engine-agnostic.
- TODO: remote execution path (databricks-connect / dbt target / direct SQL over a driver).
- Never point local runs at production targets. Separate `Settings` values per environment.

## Notebook Discipline

Default: no notebooks as production code. If the platform requires them (TODO):

- Notebooks live in `notebooks/` and contain only orchestration glue calling `src/<pkg>/` functions.
- Commit with outputs stripped.
- Logic developed in a notebook is promoted into the package before being scheduled.

## SQL File Ownership

If transforms are SQL, decide the owner (TODO): `sql/` files executed by Python, or a dbt project (then the dbt optional section governs).

- One purpose per file. SQL is reviewed like code.
- TODO: formatter/linter (e.g. `sqlfluff`).
- No duplicated logic between SQL and Python - each transform has exactly one home.

## Databricks Patterns (Optional)

If this repo targets Databricks, follow these:

- **Asset Bundles (DABs)**: `databricks.yml` at repo root is the authoritative definition of jobs, pipelines, and targets. Deploy via `databricks bundle validate` / `deploy -t <target>` / `run`. Targets at minimum `dev` and `prod`. TODO: workspace hosts come from per-developer profile config, never committed.
- **Lakeflow / DLT pipelines**: declarative pipeline code lives in the package. Use expectations (`@dlt.expect...`) as the data-quality gate equivalent of the dataframe schema check. Medallion (bronze/silver/gold) is the natural stage convention here.
- **Unity Catalog**: three-level names `catalog.schema.table` everywhere. TODO: catalog-per-environment mapping. Table names come from `Settings`, never hardcoded across environments.
- **databricks-connect**: local dev path for Spark code against a remote cluster. Add as a `uv` dev dependency; keep it out of the production wheel if versions conflict (TODO).
- **CLI + auth**: the `databricks` CLI authenticates via profiles in `~/.databrickscfg` (do not read this file - covered by Safety). CI uses OAuth/env-injected secrets via the secrets backend.
- **Devcontainer**: if adopted, extend `postCreateCommand` with the official CLI installer: `curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh`.

## dbt + SQL Warehouse Patterns (Optional)

If transforms run as dbt against a SQL warehouse:

- **Division of labor**: dbt owns transforms (`models/staging/`, `models/marts/`); Python owns ingestion (extract/load into raw schemas) and orchestration glue. Python never re-implements a dbt model.
- dbt installed as a `uv` dev dependency (`dbt-core` + TODO: adapter). Run via `uv run dbt build|run|test --select <selector>`.
- `sources.yml` declares the raw tables Python ingestion produces - the contract between the Python and dbt halves. Keep it in sync with ingestion outputs (Refresh Checklist item).
- dbt tests (`unique`, `not_null`, `relationships`, accepted values, custom) are the data-quality layer for transformed models; pytest covers Python ingestion.
- `profiles.yml` is credential-bearing: env-var driven (`env_var(...)`) or kept outside the repo. Never committed, never read (Safety list).
- `target/`, `dbt_packages/` are build output (Search Scope).

## Testing

- Pytest. Test modules mirror `src/<pkg>/` paths.
- Fixtures in `conftest.py`. No global state - every fixture is explicit per-test.
- `tmp_path` for filesystem. `pytest.MonkeyPatch` (via the `monkeypatch` fixture) for env vars.
- **Do not `unittest.mock.patch` first-party modules.** If a test feels like it needs that, the code under test is missing a seam - pass the dependency in instead.
- Third-party SDKs may be patched at their import site, but prefer a thin adapter you can replace with a fake.
- Sample data lives in `tests/fixtures/` as small committed files (CSV/JSON/parquet) - kilobytes, synthetic, no real user data.
- Transform tests are pure-function tests: fixture in, expected frame/records out. Golden files are acceptable, regenerated deliberately.
- Test idempotency explicitly: apply the publish-merge logic twice, assert the same final state.
- `io/` adapters are replaced with fakes - no test talks to a real warehouse.
- If dbt is adopted, `dbt build` in CI is the test gate for models.

## Boundaries

- Transforms do not import `io/`. They are pure over typed data in, typed data out.
- Pipelines compose `contracts/` + `io/` + transforms. Adapters contain no business logic.
- Domain models do not import from adapters. Dependency arrow points inward.
- `__main__.py` (or the pipeline runner) is the only place that knows about both `Settings` and concrete adapter implementations.
- Orchestrator definitions (DAGs, `databricks.yml` jobs, dbt configs) reference package entry points - never inline logic.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `.venv/`, `venv/`
- `__pycache__/`
- `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.tox/`
- `dist/`, `build/`
- `*.egg-info/`
- `.coverage`, `htmlcov/`
- `target/`, `dbt_packages/` (dbt build output)
- `.databricks/`, `spark-warehouse/`, `metastore_db/`
- `data/` local scratch, `*.parquet`, `*.duckdb`, checkpoint dirs

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{.venv,venv,__pycache__,.pytest_cache,.ruff_cache,.mypy_cache,dist,build,*.egg-info,target,dbt_packages,.databricks,spark-warehouse,data}/**' '<pattern>'
find . -type d \( -name .venv -o -name venv -o -name __pycache__ -o -name .pytest_cache -o -name dist -o -name build -o -name target -o -name dbt_packages -o -name .databricks -o -name data \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (e.g. `uv.lock`).

## Settings

`pydantic-settings` is the entry point for all environment variables.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_")
    warehouse_url: str  # TODO: actual warehouse connection field(s)
    raw_bucket: str  # TODO: object storage location(s)
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
- `profiles.yml` (dbt credentials), `~/.databrickscfg`
- Warehouse DSNs, JDBC URLs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Production data extracts or PII-bearing sample files - fixtures must be synthetic

Metadata reads are fine: `pyproject.toml`, `uv.lock`, `pytest.ini`, `tox.ini`, `ruff.toml`, `databricks.yml`, `dbt_project.yml`, and public config files.

Use `.env.example` only for variable names. Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Lockfile updates commit with the source change that triggered them.** `uv.lock` rides with the `pyproject.toml` edit. Generated artifacts (dbt manifest, exported schemas) commit with the model edit that produced them, if committed at all.
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
- Record warehouse, orchestrator, dataframe library, validation tool, stage convention, and dbt-vs-Python transform ownership in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
