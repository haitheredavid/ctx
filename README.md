# ctx

Personal agent-readable repo context: ten stack-tailored presets (`AGENTS.md`, `.context/`, a mise-based devcontainer, and a `mise.toml` with pinned tools and tasks) plus a scaffolder that infers the same structure for existing repos. Everything runs through one Bun + TypeScript CLI, `ctx`, executed straight from this checkout.

## Setup

Requires [mise](https://mise.jdx.dev).

```bash
mise trust && mise run setup
```

This installs the pinned toolchain and dev deps, installs git hooks via hk, and symlinks `bin/ctx` into `~/.local/bin` (make sure that is on your `PATH`).

## Usage

```bash
ctx list                                     # presets + descriptions
ctx new ~/projects/foo --preset api-ts       # copy a preset (omit --preset to pick interactively)
ctx new ~/projects/foo --preset api-ts --force   # overwrite existing files
```

`ctx new` refuses to overwrite anything without `--force` and writes nothing on conflict. Afterwards:

```bash
cd ~/projects/foo
mise trust && mise install
grep -rn TODO AGENTS.md .context/ mise.toml  # fill in markers
```

Open in VS Code or Codespaces and "Reopen in Container" to get the preset's toolchain via mise.

### Adding context to an existing repo

```bash
ctx scaffold ~/projects/bar                      # dry-run (default repo: cwd)
ctx scaffold ~/projects/bar --write              # write base files
ctx scaffold ~/projects/bar --write --force      # overwrite existing files
ctx scaffold ~/projects/bar --agent-shim         # also generate AGENT.md
ctx scaffold ~/projects/bar --package-overlays   # AGENTS.md inside detected workspace packages
```

Reads only metadata (`package.json`, `tsconfig*.json`, `mise.toml`, common config files, workspace manifests). When a `mise.toml` exists, its tools and tasks become the generated Toolchain and Commands sections. Skips existing files unless `--force`. Leaves `TODO:` markers where it can't infer. Does not read `.env`, `.secrets`, certs, or provider payloads.

## Presets

| Variant | Pick when |
|---|---|
| `frontend-ts` | React + Vite + Tailwind SPA. No backend in this repo (or backend lives separately). |
| `backend-ts` | Node + Hono + Drizzle + Postgres service. Optional SQS/Redis worker section. |
| `fullstack-ts` | One repo, `src/{client,server,shared}`, React + Hono with shared Zod contracts. |
| `python` | `uv` + `ruff` + `ty` + `pytest`. `pydantic-settings` entry, `@dataclass` internal, `pydantic` at boundaries. |
| `combo-ts-python` | React + Vite frontend (`web/`) and FastAPI backend (`api/`) with OpenAPI-generated TS client. |
| `api-ts` | Node + Hono + Zod HTTP API. No DB layer assumed — storage and queues sit behind external adapters. |
| `api-py` | Python + FastAPI + Pydantic HTTP API. Async, `httpx` outbound, OpenAPI authoritative. No DB layer assumed. |
| `library-ts` | Published TS package or developer CLI tool. ESM, `tsc`-only, runtime-neutral, Changesets, optional `bin`. |
| `library-py` | Published Python package or developer CLI tool. `uv` + `ruff` + `ty` + `pytest` + `hatchling`, `py.typed` shipped, optional `[project.scripts]`. |
| `data-py` | Python data pipelines: `uv` + `ruff` + `ty` + `pytest`, ingest→transform→publish, idempotent partitioned writes. Optional Databricks (DABs, Lakeflow/DLT, Unity Catalog) and dbt + SQL warehouse sections. |

Each preset drops these files:

- `AGENTS.md` — canonical entrypoint. Compact, operational. Stack, commands, standards, ownership map.
- `.context/README.md` — conventions for `.context/`: durable guides vs. ephemeral `active/` docs.
- `.context/project-context.md` — purpose, architecture, ownership, durable decisions.
- `.context/engineering-guide.md` — commands, language standards, framework patterns, testing, safety, commits.
- `.context/writing-tdds.md` — how to write a Technical Design Document for the repo.
- `.context/active/` — dated in-flight design docs (`YYYYMMDD-<title>.md`); the PR that lands the work deletes the doc. Guides never carry progress.
- `.devcontainer/devcontainer.json` — VS Code / Codespaces dev environment for that stack.
- `mise.toml` — pinned toolchain (Node + pnpm, Python + uv, or both) and task entrypoints matching the documented commands.

`.context/` uses a two-tier lifecycle: durable **guides** at the root never describe progress, and ephemeral **active docs** carry in-flight design and are deleted when their work lands. See `.context/README.md` in any preset.

`AGENTS.md` is the canonical name. Some tools expect singular `AGENT.md` — generate it as a shim (`ctx scaffold --agent-shim`), not the source of truth.

## Development

All tasks live in `mise.toml`:

- `mise run setup` - install deps, git hooks, and the `ctx` symlink.
- `mise run lint` - hk checks (Biome, shellcheck, whitespace).
- `mise run format` - apply hk fixes.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test (CI runs this).

See [`AGENTS.md`](AGENTS.md) for repo-internal conventions.
