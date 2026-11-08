# Agent Guide

## Project Context

`ctx` = personal agent-context toolkit: stack-tailored presets + scaffolder, exposed as one Bun + TypeScript CLI (`ctx`) run from this checkout via `bin/ctx`. `ctx new` copies preset into new/empty repo; `ctx scaffold` renders generic context into existing repo from its metadata.

More durable context in `.context/` (conventions in `.context/README.md`):

- `.context/project-context.md` - purpose, architecture, ownership, durable decisions.
- `.context/engineering-guide.md` - commands, TypeScript style, template rules, testing, safety.
- `.context/writing-tdds.md` - how to write Technical Design Document for this repo.
- `.context/active/` - dated in-flight design docs (`YYYYMMDD-<title>.md`); PR landing the work deletes doc. Guides never carry progress.

## Repo Shape

| Path | Owns |
|------|------|
| `bin/ctx` | Bash shim: resolves real path through `~/.local/bin` symlink, execs `src/cli.ts` with mise-pinned bun, keeps caller cwd. |
| `src/cli.ts` | Arg parsing, subcommands (`list`, `new`, `scaffold`, `help`), all console output. |
| `src/presets.ts` | List presets, apply one to target dir (conflict check before any write). |
| `src/detect.ts` | Repo metadata detection: package manager, workspaces, tsconfig, config files, `mise.toml`. |
| `src/scaffold.ts` | Render context templates, plan/apply dry-run or write results. |
| `presets/<variant>/` and `presets/presets.json` | Stack-tailored starter packs (`AGENTS.md`, `.context/`, `.devcontainer/`, `mise.toml`) + one-line descriptions. |
| `templates/agent-context/` | Markdown templates for root, context guides, shim, package overlay files. |
| `test/` | `bun test` suites with tmpdir fixtures. |
| `mise.toml` / `hk.pkl` / `biome.json` | Toolchain pins + tasks, git hooks, lint/format config. |
| `.github/workflows/ci.yml` | CI: `mise run check` via `jdx/mise-action`. |

## Commands

Toolchain + tasks in `mise.toml`. First run: `mise trust && mise run setup`.

- `mise run setup` - `bun install`, install hk git hooks, symlink `bin/ctx` into `~/.local/bin`.
- `mise run lint` - all hk checks (Biome, shellcheck, whitespace) on every file.
- `mise run format` - apply all hk fixes on every file.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test.

CLI:

- `ctx list` - list presets.
- `ctx new <dir> [--preset <name>] [--force]` - copy preset into `<dir>`.
- `ctx scaffold [repo] [--write] [--force] [--preset <name>] [--agent-shim] [--package-overlays]` - dry-run (or write) generated context for repo; `--preset` uses preset stack docs with repo mise commands.

## Standards

- `AGENTS.md` canonical. `AGENT.md` optional compat shim only.
- Templates + presets stay generic, leave TODOs for unknown project-specific facts.
- Every `mise run <task>` in preset docs must exist in that preset's `mise.toml` (enforced by `test/presets.test.ts`).
- `ctx new` never overwrites without `--force`; writes nothing on conflict.
- Scaffolder defaults to dry-run, skips existing files unless `--force`.
- Detection uses repo metadata, not secret-bearing files.
- Templates ASCII, compact, source-backed.

## Safety

- No reading/copying `.env`, `.secrets`, local params, copied certs, bearer headers, database URLs, DSNs, AWS secrets, local credential values.
- Scaffolder no broad source tree reads unless needed; prefer metadata files + existence checks.
- Preserve unrelated dirty work. Never revert files not intentionally changed.

Search scope, settings discipline, commit style in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## Where To Edit

- CLI behavior + output: `src/cli.ts`.
- Preset application: `src/presets.ts`.
- Preset content: `presets/<variant>/{AGENTS.md,.context/*,.devcontainer/devcontainer.json,mise.toml}`; descriptions in `presets/presets.json`.
- Scaffolder detection: `src/detect.ts`; rendering + write behavior: `src/scaffold.ts`.
- Scaffolder-generated text: `templates/agent-context/*.tmpl`.
- Toolchain, tasks, hooks, lint: `mise.toml`, `hk.pkl`, `biome.json`.
- Usage docs: `README.md`.
- Durable project context: `.context/*.md`.
