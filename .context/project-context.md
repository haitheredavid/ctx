# Project Context

## What This Repo Is

`ctx` packages reusable agent-context starter material behind one CLI, run from this checkout via `bin/ctx` (symlinked into `~/.local/bin`):

1. **`ctx new <dir> --preset <name>`** copies a stack-tailored preset (`AGENTS.md`, `.context/`, `.devcontainer/`, `mise.toml`) into a new or empty repo.
2. **`ctx scaffold [repo]`** infers generic context from an existing repo's metadata (including `mise.toml`) when a preset does not fit.

Core value: new and existing repos should get a consistent `AGENTS.md` plus `.context/` structure that helps agents understand purpose, commands, boundaries, safety, and durable project decisions without inventing facts. Each preset also ships a `mise.toml` whose tasks match its documented commands, and a devcontainer that installs mise and runs `mise install`.

## Architecture

```text
Preset flow:      ctx new <dir> --preset X -> presets/X/ -> conflict check -> copy into <dir>
Scaffolder flow:  target repo metadata (+ mise.toml) -> src/detect.ts -> src/scaffold.ts
                  -> templates/agent-context -> generated docs (dry-run by default; --write to apply)
```

`bin/ctx` resolves this checkout through its symlink and runs `src/cli.ts` with the bun version pinned by this repo's `mise.toml`, keeping the caller's cwd. The scaffolder reads safe metadata from a target repo, builds a render context, then writes or previews Markdown files. It does not modify target repos unless `--write` is passed. `ctx new` checks every destination before writing and writes nothing if any exists without `--force`.

## Ownership

| Area | Owns |
|------|------|
| `bin/ctx` | Shim resolving the mise-pinned bun and this checkout's `src/cli.ts`. |
| `src/cli.ts` | Arg parsing, subcommands, output. |
| `src/presets.ts` | List and apply presets. |
| `src/detect.ts` | Metadata detection: package manager, workspaces, tsconfig, config files, `mise.toml`. |
| `src/scaffold.ts` | Template rendering and dry-run/write behavior. |
| `presets/<variant>/` and `presets/presets.json` | Stack-tailored starter content and one-line descriptions for `ctx list`. |
| `templates/agent-context/` | Generic Markdown skeletons for root agent guide, `.context` files, shim, and package overlays. |
| `test/` | `bun test` suites over presets, `ctx new`, and the scaffolder. |
| `mise.toml` / `hk.pkl` / `biome.json` | Toolchain pins and tasks, git hooks, lint/format. |
| `.github/workflows/ci.yml` | CI running `mise run check`. |
| `README.md` | Usage examples and preset catalog. |
| `AGENTS.md` and `.context/` | Context for this repo itself. |

## Durable Decisions

Choices this repo has committed to. Not status or progress — in-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- `AGENTS.md` is the canonical root guide. `AGENT.md` is an opt-in compatibility shim only (`--agent-shim`), never a duplicate manual.
- One CLI run from this checkout via `bin/ctx`; there is no GitHub-template / self-deleting applier flow.
- mise pins every tool and owns every task; `package.json` has no `scripts`.
- The CLI has zero runtime dependencies (Bun + `node:` stdlib only).
- Presets ship a `mise.toml` whose tasks match their docs 1:1, enforced by `test/presets.test.ts`.
- Preset devcontainers install mise and run `mise install`.
- `ctx scaffold` defaults to dry-run, skips existing files unless `--force`, and reads only safe metadata (including `mise.toml`) — never secret-bearing files.
- `ctx new` refuses any overwrite without `--force` and writes nothing on conflict.
- Generated templates leave `TODO:` markers for facts that cannot be inferred safely.
- `.context/` follows the guides-vs-active split (see `.context/README.md`): durable guides at the root, dated ephemeral design docs in `active/`. There is no `roadmap-notes.md`.

## Accepted Limitations

- Workspace glob support handles common one-level patterns, not full glob semantics.
