# ctx

Personal agent-readable repo context: ten stack-tailored presets (`AGENTS.md`, `.context/`, mise-based devcontainer, `mise.toml` with pinned tools + tasks) plus scaffolder that infers same structure for existing repos. All runs through one Bun + TypeScript CLI, `ctx`, executed direct from this checkout.

## Setup

Needs [mise](https://mise.jdx.dev).

```bash
mise trust && mise run setup
```

Installs pinned toolchain + dev deps, git hooks via hk, symlinks `bin/ctx` into `~/.local/bin` (must be on `PATH`).

## Usage

```bash
ctx list                                     # presets + descriptions
ctx new ~/projects/foo --preset api-ts       # copy a preset (omit --preset to pick interactively)
ctx new ~/projects/foo --preset api-ts --force   # overwrite existing files
```

`ctx new` won't overwrite without `--force`; writes nothing on conflict. After:

```bash
cd ~/projects/foo
mise trust && mise install
grep -rn TODO AGENTS.md .context/ mise.toml  # fill in markers
```

Open in VS Code or Codespaces, "Reopen in Container" → preset toolchain via mise.

### Adding context to an existing repo

```bash
ctx scaffold ~/projects/bar                      # dry-run (default repo: cwd)
ctx scaffold ~/projects/bar --write              # write base files
ctx scaffold ~/projects/bar --write --force      # overwrite existing files
ctx scaffold ~/projects/bar --agent-shim         # also generate AGENT.md
ctx scaffold ~/projects/bar --package-overlays   # AGENTS.md inside detected workspace packages
ctx scaffold ~/projects/bar --preset api-ts      # preset stack docs; repo mise.toml tasks replace preset commands
```

Reads metadata only (`package.json`, `tsconfig*.json`, `mise.toml`, common config files, workspace manifests). If `mise.toml` exists, its tools + tasks become generated Toolchain and Commands sections. MCP servers (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`) and skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`) fill the `## MCP Servers` and `## Skills` sections; only server name, transport, and program name (first token of `command`, directories stripped) are emitted, never args, env, headers, or URLs. Generated command lists show mise task descriptions and package script names, never command bodies. `scaffold` requires an existing directory. Skips existing files unless `--force`. Leaves `TODO:` markers where can't infer. Never reads `.env`, `.secrets`, certs, provider payloads.

Base files (generic path): `AGENTS.md`, `.context/project-context.md`, `.context/engineering-guide.md`, `.context/writing-specs.md`, `.context/writing-dds.md`, `.context/writing-tdds.md`, `.context/README.md`, `.context/active/.gitkeep`.

With `--preset <name>`, scaffold plans the preset's files instead of the generic templates. When the repo has its own `mise.toml`/`.mise.toml`, preset Commands sections are replaced with the repo's detected commands (mise tasks, else package scripts) and the preset's `mise.toml` is not written, even with `--force`; otherwise preset commands and `mise.toml` are kept as-is.

## Presets

| Variant | Pick when |
|---|---|
| `frontend-ts` | React + Vite + Tailwind SPA. No backend here (or backend separate). |
| `flutter` | Flutter + Dart app (iOS/Android, optional web). Riverpod + codegen, `go_router`, `freezed`/`json_serializable` via `build_runner`. |
| `backend-ts` | Node + Hono + Drizzle + Postgres service. Optional SQS/Redis worker section. |
| `fullstack-ts` | One repo, `src/{client,server,shared}`, React + Hono, shared Zod contracts. |
| `python` | `uv` + `ruff` + `ty` + `pytest`. `pydantic-settings` entry, `@dataclass` internal, `pydantic` at boundaries. |
| `combo-ts-python` | React + Vite frontend (`web/`) + FastAPI backend (`api/`), OpenAPI-generated TS client. |
| `api-ts` | Node + Hono + Zod HTTP API. No DB layer assumed — storage + queues behind external adapters. |
| `api-py` | Python + FastAPI + Pydantic HTTP API. Async, `httpx` outbound, OpenAPI authoritative. No DB layer assumed. |
| `library-ts` | Published TS package or dev CLI tool. ESM, `tsc`-only, runtime-neutral, Changesets, optional `bin`. |
| `library-py` | Published Python package or dev CLI tool. `uv` + `ruff` + `ty` + `pytest` + `hatchling`, ships `py.typed`, optional `[project.scripts]`. |
| `data-py` | Python data pipelines: `uv` + `ruff` + `ty` + `pytest`, ingest→transform→publish, idempotent partitioned writes. Optional Databricks (DABs, Lakeflow/DLT, Unity Catalog) and dbt + SQL warehouse sections. |

Each preset drops:

- `AGENTS.md` — canonical entrypoint. Compact, operational. Stack, commands, standards, ownership map.
- `.context/project-context.md` — purpose, architecture, ownership, durable decisions.
- `.context/engineering-guide.md` — commands, language standards, framework patterns, testing, safety, commits.
- `.context/writing-specs.md` — how to write a spec (what and why) and the spec -> DD -> TDD flow.
- `.context/writing-dds.md` — how to write a design document (DD) that splits work into TDDs.
- `.context/writing-tdds.md` — how to write a Technical Design Document (TDD) for one shippable unit.
- `.context/README.md` — `.context/` conventions: durable guides vs. ephemeral `active/` docs.
- `.context/active/` — dated in-flight specs, DDs, TDDs; naming + lifecycle in `.context/writing-specs.md#lifecycle`. Guides never carry progress.
- `.devcontainer/devcontainer.json` — VS Code / Codespaces dev env for stack.
- `mise.toml` — pinned toolchain (Node + pnpm, Python + uv, both, or Flutter) + task entrypoints matching documented commands.

`.context/` two-tier lifecycle: durable **guides** at root never describe progress; ephemeral **active docs** carry in-flight design, deleted when work lands. See `.context/README.md` in any preset.

`AGENTS.md` = canonical name. Some tools expect singular `AGENT.md` — generate as shim (`ctx scaffold --agent-shim`), not source of truth.

## Development

All tasks in `mise.toml`:

- `mise run setup` - install deps, git hooks, `ctx` symlink.
- `mise run lint` - hk checks (Biome, shellcheck, whitespace).
- `mise run format` - apply hk fixes.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test (CI runs this).

See [`AGENTS.md`](AGENTS.md) for repo-internal conventions.
