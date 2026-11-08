# Agent Guide

## Project Context

`ctx` is a personal agent-context toolkit: stack-tailored presets plus a scaffolder, exposed as one Bun + TypeScript CLI (`ctx`) run from this checkout via `bin/ctx`. `ctx new` copies a preset into a new or empty repo; `ctx scaffold` renders generic context into an existing repo from its metadata.

Additional durable context lives in `.context/` (conventions in `.context/README.md`):

- `.context/project-context.md` - purpose, architecture, ownership, and durable decisions.
- `.context/engineering-guide.md` - commands, TypeScript style, template rules, testing, and safety.
- `.context/writing-tdds.md` - how to write a Technical Design Document for this repo.
- `.context/active/` - dated in-flight design docs (`YYYYMMDD-<title>.md`); the PR that lands the work deletes the doc. Guides never carry progress.

## Repo Shape

| Path | Owns |
|------|------|
| `bin/ctx` | Bash shim: resolves its real path through the `~/.local/bin` symlink and execs `src/cli.ts` with the mise-pinned bun, preserving the caller's cwd. |
| `src/cli.ts` | Arg parsing, subcommands (`list`, `new`, `scaffold`, `help`), and all console output. |
| `src/presets.ts` | List presets and apply one to a target dir (conflict check before any write). |
| `src/detect.ts` | Repo metadata detection: package manager, workspaces, tsconfig, config files, `mise.toml`. |
| `src/scaffold.ts` | Render context templates and plan/apply dry-run or write results. |
| `presets/<variant>/` and `presets/presets.json` | Stack-tailored starter packs (`AGENTS.md`, `.context/`, `.devcontainer/`, `mise.toml`) and their one-line descriptions. |
| `templates/agent-context/` | Markdown templates for root, context guides, shim, and package overlay files. |
| `test/` | `bun test` suites with tmpdir fixtures. |
| `mise.toml` / `hk.pkl` / `biome.json` | Toolchain pins and tasks, git hooks, lint/format config. |
| `.github/workflows/ci.yml` | CI: `mise run check` via `jdx/mise-action`. |

## Commands

Toolchain and tasks live in `mise.toml`. First run: `mise trust && mise run setup`.

- `mise run setup` - `bun install`, install hk git hooks, symlink `bin/ctx` into `~/.local/bin`.
- `mise run lint` - all hk checks (Biome, shellcheck, whitespace) on every file.
- `mise run format` - apply all hk fixes on every file.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test.

CLI:

- `ctx list` - list presets.
- `ctx new <dir> [--preset <name>] [--force]` - copy a preset into `<dir>`.
- `ctx scaffold [repo] [--write] [--force] [--agent-shim] [--package-overlays]` - dry-run (or write) generated context for a repo.

## Standards

- `AGENTS.md` is canonical. `AGENT.md` is optional compatibility shim only.
- Templates and presets must stay generic and leave TODOs for unknown project-specific facts.
- Every `mise run <task>` in a preset's docs must exist in that preset's `mise.toml` (enforced by `test/presets.test.ts`).
- `ctx new` must never overwrite without `--force` and must write nothing on conflict.
- Scaffolder must default to dry-run and skip existing files unless `--force` is passed.
- Detection must use repo metadata, not secret-bearing files.
- Keep templates ASCII, compact, and source-backed.

## Safety

- Do not read or copy `.env`, `.secrets`, local params, copied certs, bearer headers, database URLs, DSNs, AWS secrets, or local credential values.
- Do not make scaffolder read broad source trees unless needed; prefer metadata files and existence checks.
- Preserve unrelated dirty work. Never revert files you did not intentionally change.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## Where To Edit

- CLI behavior and output: `src/cli.ts`.
- Preset application: `src/presets.ts`.
- Preset content: `presets/<variant>/{AGENTS.md,.context/*,.devcontainer/devcontainer.json,mise.toml}`; descriptions in `presets/presets.json`.
- Scaffolder detection: `src/detect.ts`; rendering and write behavior: `src/scaffold.ts`.
- Scaffolder-generated text: `templates/agent-context/*.tmpl`.
- Toolchain, tasks, hooks, lint: `mise.toml`, `hk.pkl`, `biome.json`.
- Usage docs: `README.md`.
- Durable project context: `.context/*.md`.
