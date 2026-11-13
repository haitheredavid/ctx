# ctx

Personal agent-readable repo context: shared core guides (brief -> design -> spec, pull requests, context maintenance), stack-tailored presets (`AGENTS.md`, `.context/`, mise-based devcontainer, `mise.toml` with pinned tools + tasks), and team profiles that decide where in-flight docs live, plus a scaffolder that infers the same structure for existing repos. All runs through one Bun + TypeScript CLI, `ctx`, executed direct from this checkout.

## Install

Needs [mise](https://mise.jdx.dev). Released binaries (macOS arm64, Linux arm64/x64) ship with `presets/`, `profiles/`, `core/`, `templates/` beside them:

```bash
mise use -g github:haitheredavid/ctx@<version>   # e.g. @0.1.0
ctx --version
```

Set `CTX_ROOT` to point a binary at another checkout's `presets/`, `profiles/`, `core/`, `templates/`.

### Dev install (from this checkout)

```bash
mise trust && mise run setup
```

Installs pinned toolchain + dev deps, git hooks via hk, symlinks `bin/ctx` into `~/.local/bin` (must be on `PATH`). Runs source directly; edits take effect immediately.

## Usage

```bash
ctx list                                     # presets + profiles with descriptions
ctx new ~/projects/foo --preset api-ts       # copy a preset (omit --preset to pick interactively)
ctx new ~/projects/foo --preset api-ts --profile local   # pick the profile explicitly
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
ctx scaffold ~/projects/bar --claude-shim        # also generate CLAUDE.md containing `@AGENTS.md`
ctx scaffold ~/projects/bar --package-overlays   # AGENTS.md inside detected workspace packages
ctx scaffold ~/projects/bar --preset api-ts      # preset stack docs; repo mise.toml tasks replace preset commands
ctx scaffold ~/projects/bar --profile local      # team profile layered over core + generated files
```

Reads metadata only (`package.json`, `tsconfig*.json`, `mise.toml`, common config files, workspace manifests). If `mise.toml` exists, its tools + tasks become generated Toolchain and Commands sections. MCP servers (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`) and skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`) fill the `## MCP Servers` and `## Skills` sections; only server name, transport, and program name (first token of `command`, directories stripped) are emitted, never args, env, headers, or URLs. Generated command lists show mise task descriptions and package script names, never command bodies. `scaffold` requires an existing directory. Skips existing files unless `--force`. Leaves `TODO:` markers where can't infer. Never reads `.env`, `.secrets`, certs, provider payloads.

Base files (generic path): core guides (`.context/README.md`, `.context/guides/{writing-briefs,writing-designs,writing-specs,pull-requests,context-maintenance}.md`), rendered `AGENTS.md`, `.context/project-context.md`, `.context/guides/engineering.md`, then the profile's files (`local`: `.context/guides/doc-lifecycle.md`, `.context/active/.gitkeep`).

With `--preset <name>`, scaffold plans the preset's files instead of the generic templates. When the repo has its own `mise.toml`/`.mise.toml`, preset Commands sections are replaced with the repo's detected commands (mise tasks, else package scripts) and the preset's `mise.toml` is not written, even with `--force`; otherwise preset commands and `mise.toml` are kept as-is.

### Layers, profiles, and packs

Files compose in layers; a later layer replaces an earlier file at the same path:

1. `core/` - shared `.context` guides, identical in every generated repo.
2. The preset (`ctx new`, `scaffold --preset`) or the rendered generic files (`scaffold`).
3. The profile - team workflow. Only `.context/guides/doc-lifecycle.md` differs between profiles; profiles can also add files such as scripts (executable bits are kept).

The builtin `local` profile keeps briefs, designs, and specs as committed files in `.context/active/`, deleted when the work lands. More presets and profiles come from external packs listed in `~/.config/ctx/config.toml` (override the path with `CTX_CONFIG`):

```toml
packs = ["~/work/ctx-pack"]   # each pack holds presets/ and/or profiles/ with a presets.json / profiles.json manifest

[profiles]
"~/work" = "team"             # default profile for repos under this directory (longest match wins; else local)
```

Pack names must not collide with builtins or each other.

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
- `.context/guides/engineering.md` — commands, language standards, framework patterns, testing, safety, commits.
- `.devcontainer/devcontainer.json` — VS Code / Codespaces dev env for stack.
- `mise.toml` — pinned toolchain (Node + pnpm, Python + uv, both, or Flutter) + task entrypoints matching documented commands.
- Core guides + profile files: `.context/README.md`, `.context/guides/{writing-briefs,writing-designs,writing-specs,pull-requests,context-maintenance}.md`, and the profile's `.context/guides/doc-lifecycle.md` (plus `.context/active/` for `local`).

`.context/` layout: prescriptive **guides** in `guides/`, descriptive **reference** in `reference/`, frozen **archive** in `archive/`; in-flight docs live where `doc-lifecycle.md` says. See `core/.context/README.md`.

`AGENTS.md` = canonical name. Some tools expect singular `AGENT.md` — generate as shim (`ctx scaffold --agent-shim`), not source of truth. Claude Code reads `CLAUDE.md`; `--claude-shim` writes one that just imports `AGENTS.md`.

## Development

All tasks in `mise.toml`:

- `mise run setup` - install deps, git hooks, `ctx` symlink.
- `mise run lint` - hk checks (Biome, shellcheck, whitespace).
- `mise run format` - apply hk fixes.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test (CI runs this).

Releases: bump `version` in `package.json`, then push a matching `v<version>` tag. `.github/workflows/release.yml` compiles `ctx` for darwin-arm64, linux-arm64, linux-x64 and attaches `ctx-<version>-<os>-<arch>.tar.gz` (binary + `presets/` + `templates/` + `core/` + `profiles/`) to a GitHub release.

See [`AGENTS.md`](AGENTS.md) for repo-internal conventions.
