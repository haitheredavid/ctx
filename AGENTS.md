# Agent Guide

## Project Context

`ctx` = personal agent-context toolkit: stack-tailored presets + scaffolder, exposed as one Bun + TypeScript CLI (`ctx`) run from this checkout via `bin/ctx`. `ctx new` copies preset into new/empty repo; `ctx scaffold` renders generic context into existing repo from its metadata; `ctx scaffold --preset <name>` uses that preset's stack docs instead.

More durable context in `.context/` (conventions in `.context/README.md`):

- `.context/project-context.md` - purpose, architecture, ownership, durable decisions.
- `.context/engineering-guide.md` - commands, TypeScript style, template rules, testing, safety.
- `.context/writing-specs.md` - how to write a spec (what and why) and the spec -> DD -> TDD flow.
- `.context/writing-dds.md` - how to write a design document (DD) that splits work into TDDs.
- `.context/writing-tdds.md` - how to write a Technical Design Document (TDD) for one shippable unit.
- `.context/active/` - dated in-flight docs (`YYYYMMDD-<title>-spec.md`, `-dd.md`, `-tdd.md`); naming + lifecycle in `.context/README.md`. Guides never carry progress.

## Repo Shape

| Path | Owns |
|------|------|
| `bin/ctx` | Bash shim: resolves real path through `~/.local/bin` symlink, execs `src/cli.ts` with mise-pinned bun, keeps caller cwd. |
| `src/cli.ts` | Arg parsing, subcommands (`list`, `new`, `scaffold`, `help`), all console output. |
| `src/presets.ts` | List presets, `findPreset`/`presetFiles`, apply one to target dir (conflict check before any write). |
| `src/detect.ts` | Repo metadata detection: package manager, workspaces, tsconfig, config files, `mise.toml`, MCP servers, skills. |
| `src/safe-fs.ts` | Symlink-safe write checks (`entryExists`, `assertSafeWritePath`) shared by `new` and `scaffold`. |
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
- Detection uses repo metadata, not secret-bearing files; it parses MCP config files and `SKILL.md` frontmatter but emits only server name, transport, and a sanitized command name; never args/env/headers/URL text, script bodies, or mise `run` text.
- Writes never follow symlinks or leave the target dir; `ctx new` rolls back on failure.
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
