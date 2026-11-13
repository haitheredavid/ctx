# Project Context

## What This Repo Is

`ctx` packages reusable agent-context starter material behind one CLI. Run from this checkout via `bin/ctx` (symlinked into `~/.local/bin`):

1. **`ctx new <dir> --preset <name> [--profile <name>]`** composes shared core guides, a stack-tailored preset (`AGENTS.md`, `.context/`, `.devcontainer/`, `mise.toml`), and a team profile into a new or empty repo.
2. **`ctx scaffold [repo] [--preset <name>] [--profile <name>]`** infers generic context from existing repo metadata (incl. `mise.toml`, MCP configs, skill dirs) and layers core guides + profile over it; with `--preset`, brings a preset's stack docs into the repo, swapping in the repo's own mise commands when present.

Core value: new + existing repos get consistent `AGENTS.md` + `.context/` structure. Helps agents understand purpose, commands, boundaries, safety, durable project decisions. No invented facts. Each preset ships `mise.toml` with tasks matching documented commands, plus devcontainer that installs mise and runs `mise install`.

## Architecture

```text
Preset flow:      ctx new <dir> --preset X -> core/ + presets/X/ + profiles/P/ (later wins) -> conflict check -> copy into <dir>
Scaffolder flow:  target repo metadata (+ mise.toml, MCP configs, skills) -> src/detect.ts -> src/scaffold.ts
                  -> core/ + templates/agent-context + profiles/P/ -> generated docs (dry-run by default; --write to apply)
Packs:            ~/.config/ctx/config.toml packs -> src/packs.ts -> extra presets/ + profiles/ beside the builtins
```

`bin/ctx` resolves this checkout through its symlink. Runs `src/cli.ts` with bun version pinned by this repo's `mise.toml`. Keeps caller's cwd. Scaffolder reads safe metadata from target repo, builds render context, then writes or previews Markdown files. No target repo changes unless `--write` passed. `ctx new` checks every destination before writing. Any exists without `--force` → writes nothing.

## Ownership

| Area | Owns |
|------|------|
| `bin/ctx` | Shim: resolves mise-pinned bun + this checkout's `src/cli.ts`. |
| `src/cli.ts` | Arg parsing, subcommands, output. |
| `src/presets.ts` | Apply a composed preset + profile (conflict check, rollback). |
| `src/packs.ts` | Pack discovery, `~/.config/ctx/config.toml`, layer listing + merge. |
| `src/detect.ts` | Metadata detection: package manager, workspaces, tsconfig, config files, `mise.toml`, MCP servers, skills. |
| `src/scaffold.ts` | Template or preset rendering, dry-run/write behavior. |
| `presets/<variant>/` and `presets/presets.json` | Stack-only starter content + one-line descriptions for `ctx list`. |
| `core/` | Shared `.context` guides copied into every generated repo. |
| `profiles/<name>/` and `profiles/profiles.json` | Builtin team-workflow overlays; `local` is the default. |
| `templates/agent-context/` | Generic Markdown skeletons: root agent guide, project context, engineering guide, shim, package overlays. |
| `test/` | `bun test` suites over presets, `ctx new`, scaffolder. |
| `mise.toml` / `hk.pkl` / `biome.json` | Toolchain pins + tasks, git hooks, lint/format. |
| `.github/workflows/ci.yml` | CI running `mise run check`. |
| `README.md` | Usage examples, preset catalog. |
| `AGENTS.md` and `.context/` | Context for this repo itself. |

## Durable Decisions

Committed choices. Not status/progress — in-flight work + known gaps live where `.context/guides/doc-lifecycle.md` says, never here.

- `AGENTS.md` = canonical root guide. `AGENT.md` = opt-in compat shim only (`--agent-shim`), never duplicate manual.
- One CLI, run from this checkout via `bin/ctx`. No GitHub-template / self-deleting applier flow.
- mise pins every tool, owns every task. `package.json` has no `scripts`.
- CLI has zero runtime deps (Bun + `node:` stdlib only).
- Presets ship `mise.toml` with tasks matching docs 1:1, enforced by `test/presets.test.ts`.
- Preset devcontainers install mise + run `mise install`.
- `ctx scaffold` defaults to dry-run, skips existing files unless `--force`, reads only safe metadata (incl. `mise.toml`) - never secret-bearing files. Detection parses MCP config files and `SKILL.md` frontmatter but emits only server name, transport, and a sanitized command name; never args/env/headers/URL text, script bodies, or mise `run` text.
- `ctx new` refuses any overwrite without `--force`, writes nothing on conflict.
- Generated templates leave `TODO:` markers for facts not safely inferable.
- `.context/` follows the guides / reference / archive layout (see `.context/README.md`); in-flight docs live where `doc-lifecycle.md` says. No `roadmap-notes.md`.
- Every generated repo ships the brief -> design -> spec guides from `core/`; only `.context/guides/doc-lifecycle.md` varies by profile.
- Layered packs: core < preset (or rendered scaffold files) < profile, later replaces same path. External packs come from `~/.config/ctx/config.toml` `packs`; `[profiles]` maps directories to default profiles. One engine, no forks.

## Accepted Limitations

- Workspace glob support handles common one-level patterns, not full glob semantics.
