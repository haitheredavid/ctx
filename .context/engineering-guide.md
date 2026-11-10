# Engineering Guide

## Commands

mise pins toolchain (bun, biome, hk, shellcheck), owns every task. First run: `mise trust && mise run setup`.

- `mise run setup` - `bun install`, `hk install --mise`, symlink `bin/ctx` into `~/.local/bin`.
- `mise run lint` - `hk check --all` (Biome, shellcheck on `bin/ctx`, trailing whitespace, final newlines).
- `mise run format` - `hk fix --all`.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test (CI runs this).

CLI:

- `ctx list` - list presets + descriptions.
- `ctx new <dir> [--preset <name>] [--force]` - copy preset; prompts for preset when stdin is TTY.
- `ctx scaffold [repo]` - dry-run scaffold generation (default repo: cwd).
- `ctx scaffold [repo] --write` - write scaffold files.
- `ctx scaffold [repo] --write --force` - overwrite existing scaffold paths.
- `ctx scaffold [repo] --preset <name>` - plan preset files; repo `mise.toml` tasks replace preset Commands sections.

Validation examples:

```bash
ctx scaffold ~/projects/some-repo --agent-shim
ctx scaffold ~/projects/some-monorepo --package-overlays
```

## TypeScript

- CLI MUST stay dependency-free at runtime: Bun + `node:` stdlib APIs only. `typescript` and `@types/bun` = devDeps for typechecking. [check: manual]
- Template keys explicit, simple: `{{key}}` replacement only.
- Small helpers over templating dependency.
- Output Markdown deterministic except intentional `generatedDate`.

## Template Rules

- `AGENTS.md` = canonical root guide.
- `AGENT.md` = tiny compatibility shim, not duplicate manual.
- Root guide compact, operational.
- `.context/project-context.md` holds architecture, ownership, durable decisions.
- `.context/engineering-guide.md` holds commands, style, tests, safety.
- `.context/writing-specs.md`, `.context/writing-dds.md`, `.context/writing-tdds.md` = spec -> DD -> TDD authoring guides; `.context/README.md` documents guides-vs-active split.
- `.context/active/` holds dated in-flight specs/DDs/TDDs (`YYYYMMDD-<title>-spec.md`, `-dd.md`, `-tdd.md`); lifecycle in `.context/writing-specs.md#lifecycle`.
- Guides MUST NOT carry progress/status. [check: manual]
- Package overlays say "Read root AGENTS.md first", no duplicated broad guidance.
- Preset docs reference commands as `mise run <task>`; every such task MUST exist in preset's `mise.toml`. [check: test/presets.test.ts]

## Search Scope

When grepping/finding/reading in repo, exclude dependency, cache, build output. Pollute results, slow `find`, no source-of-truth content.

- `node_modules/`
- `dist/`
- `coverage/`
- `.tsbuildinfo`

Examples (`rg -g` globs only needed outside repo's `.gitignore` scope, e.g. `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,coverage}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name coverage \) -prune -o -type f -print
```

Metadata reads inside excluded dirs fine when file itself is source of truth (e.g. `bun.lock`).


## Settings

All CLI args + env vars flow through single typed parser, no scattered `process.env` / `process.argv` reads.

- Scaffolder declares flags in one place in `src/cli.ts` (`parseArgs` from `node:util`). Downstream functions take parsed options as typed params.
- New flags/env reads go through parser. Detection and template-rendering code MUST NOT read `process.env.X` inline. [check: manual]
- Defaults live next to parser; tests override by constructing options object directly.


## Safety

- MUST NOT read `.env`, `.secrets`, local params, copied certs, bearer headers, database URLs, DSNs, AWS secrets, local credential values. [check: manual]
- Metadata reads allowed: `package.json`, `tsconfig*.json`, known config filenames, workspace package manifests, `mise.toml`, MCP configs (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`), `SKILL.md` frontmatter. Output carries only MCP server name, transport, sanitized command name; never args/env/headers/URL text, script bodies, or mise `run` text.
- Dry-run MUST stay default. [check: test/scaffold.test.ts]
- Writes MUST skip existing files unless `--force` explicit. [check: test/scaffold.test.ts]


## Commits

- **One concern per commit.** No bundling refactor + feature + dep bump.
- **Subject ≤ 72 chars, imperative.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** Diff shows what.
- **Generated artifacts ride with source change.** Template edits commit with dependent scaffolder change.
- **MUST NOT commit secrets.** Real tokens, DSNs, bearer headers, cloud creds. `.env.example` = variable names only. [check: manual]
- **Preserve unrelated dirty work.** MUST NOT restage/revert files not intentionally touched. [check: manual]


## Local Agent Scratch

Agents drop transient files at repo root mid-task: `PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`. One session's in-flight reasoning. Not durable design docs, not for git.

Add to `.gitignore`:

```
PLAN.md
TODO.md
NOTES.md
SCRATCH.md
```

- `AGENTS.md` **durable**, stays committed. Canonical entrypoint, not scratch; MUST NOT be added to `.gitignore`. [check: manual]
- Durable architecture, decisions, caveats → `.context/` (committed). Scratch → root (ignored).
- Plan worth keeping graduates to dated design doc under `.context/active/` (see `.context/README.md`) or PR description before scratch discarded. MUST NOT park it in a root scratch file. [check: manual]


## Testing

`mise run test` runs `bun test` over `test/*.test.ts`.

- Each test builds fixture repo under `mkdtemp(join(tmpdir(), "ctx-"))`, removes in `afterEach`. Fixtures MUST NOT be committed. [check: manual]
- `test/presets.test.ts` checks preset structure, `presets.json` coverage, devcontainer mise feature, every documented `mise run` task exists, `## MCP Servers`/`## Skills` sections and single `## Commands` section scaffold replaces, and that preset `.context/README.md` and `writing-*.md` match their templates byte-for-byte.
- `test/new.test.ts` covers preset copy, conflict refusal with no partial writes, `--force`, unknown presets.
- `test/scaffold.test.ts` covers rendered content (mise tasks/tools, package scripts, workspaces, MCP servers without secrets, skills), dry-run vs write, skip/overwrite, bun detection, malformed `mise.toml`, `--preset` with/without repo mise.
- `test/own-docs.test.ts` checks every hard-rule bullet in root `AGENTS.md` and `.context/engineering-guide.md` ends with a `[check: ...]` marker whose paths exist.
