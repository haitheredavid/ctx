# Engineering Guide

## Commands

mise pins the toolchain (bun, biome, hk, shellcheck) and owns every task. First run: `mise trust && mise run setup`.

- `mise run setup` - `bun install`, `hk install --mise`, and symlink `bin/ctx` into `~/.local/bin`.
- `mise run lint` - `hk check --all` (Biome, shellcheck on `bin/ctx`, trailing whitespace, final newlines).
- `mise run format` - `hk fix --all`.
- `mise run typecheck` - `tsc --noEmit`.
- `mise run test` - `bun test`.
- `mise run check` - lint + typecheck + test (what CI runs).

CLI:

- `ctx list` - list presets with descriptions.
- `ctx new <dir> [--preset <name>] [--force]` - copy a preset; prompts for a preset when stdin is a TTY.
- `ctx scaffold [repo]` - dry-runs scaffold generation (default repo: cwd).
- `ctx scaffold [repo] --write` - writes scaffold files.
- `ctx scaffold [repo] --write --force` - overwrites existing scaffold paths.

Validation examples:

```bash
ctx scaffold ~/projects/some-repo --agent-shim
ctx scaffold ~/projects/some-monorepo --package-overlays
```

## TypeScript

- Keep the CLI dependency-free at runtime; use Bun + `node:` stdlib APIs only. `typescript` and `@types/bun` are devDeps for typechecking.
- Keep template keys explicit and simple: `{{key}}` replacement only.
- Prefer small helpers over adding a templating dependency.
- Keep output Markdown deterministic except intentional `generatedDate`.

## Template Rules

- Use `AGENTS.md` as canonical root guide.
- Keep `AGENT.md` as a tiny compatibility shim, not a duplicate manual.
- Root guide should be compact and operational.
- `.context/project-context.md` should hold architecture, ownership, and durable decisions.
- `.context/engineering-guide.md` should hold commands, style, tests, and safety.
- `.context/writing-tdds.md` is the TDD authoring guide; `.context/README.md` documents the guides-vs-active split.
- `.context/active/` holds dated in-flight design docs; the PR that lands the work deletes them. Guides never carry progress or status.
- Package overlays should say "Read root AGENTS.md first" and avoid duplicating broad guidance.
- Preset docs reference commands as `mise run <task>`; every such task must exist in the preset's `mise.toml`.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and contain no source-of-truth content.

- `node_modules/`
- `dist/`
- `coverage/`
- `.tsbuildinfo`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,coverage}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name coverage \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (e.g. `bun.lock`).


## Settings

All CLI args and environment variables flow through a single typed parser, not scattered reads of `process.env` / `process.argv` across the codebase.

- The scaffolder declares its flags in one place in `src/cli.ts` (`parseArgs` from `node:util`). Downstream functions take the parsed options as typed parameters.
- New flags or env reads go through that parser. No inline `process.env.X` in detection or template-rendering code.
- Defaults live next to the parser; tests override by constructing the options object directly.


## Safety

- Do not read `.env`, `.secrets`, local params, copied certs, bearer headers, database URLs, DSNs, AWS secrets, or local credential values.
- Metadata reads are allowed for `package.json`, `tsconfig*.json`, known config filenames, and workspace package manifests.
- Dry-run must remain default.
- Writes must skip existing files unless `--force` is explicit.


## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject ≤ 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Generated artifacts ride with their source change.** Template edits commit with any scaffolder change that depends on them.
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

- `AGENTS.md` is **durable** and stays committed. It is the canonical entrypoint, not scratch — do not add it to `.gitignore`.
- Durable architecture, decisions, and caveats belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.


## Testing

`mise run test` runs `bun test` over `test/*.test.ts`.

- Each test builds its fixture repo under `mkdtemp(join(tmpdir(), "ctx-"))` and removes it in `afterEach`. Fixtures are never committed.
- `test/presets.test.ts` checks preset structure, `presets.json` coverage, devcontainer mise feature, and that every documented `mise run` task exists.
- `test/new.test.ts` covers preset copy, conflict refusal with no partial writes, `--force`, and unknown presets.
- `test/scaffold.test.ts` covers rendered content (mise tasks/tools, package scripts, workspaces), dry-run vs write, skip/overwrite, bun detection, and malformed `mise.toml`.
