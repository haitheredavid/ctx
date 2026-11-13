# Engineering Guide

Operational standards for working in this library. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install deps from lockfile. (`pnpm install`) |
| `mise run typecheck` | `tsc --noEmit`. Run before claiming type safety. (`pnpm run typecheck`) |
| `mise run lint` | Biome or ESLint. (`pnpm run lint`) |
| `mise run build` | `tsc -p tsconfig.build.json` -> `dist/`. Run before claiming the package is shippable. (`pnpm run build`) |
| `mise run test` | Vitest. State precise scope (unit / contract / snapshot). (`pnpm run test`) |
| `mise run changeset` | Record an upcoming user-facing change (interactive). (`pnpm run changeset`) |
| `mise run version` | `changeset version` - bumps `package.json` and updates `CHANGELOG.md`. (`pnpm run version`) |
| `mise run release` | `build && changeset publish` - publishes to npm using the active token. (`pnpm run release`) |
| `mise run check` | typecheck + lint + test. |

State command scope exactly. Do not say "all tests pass" unless the script you ran covers every suite.

## TypeScript

- `strict: true`. No implicit `any`. `noUncheckedIndexedAccess` recommended.
- ESM-first (`"type": "module"`). Use `.ts` on relative imports when tsc rewrites them; alternatively configure Node subpath imports (`"imports": { "#src/*": "./src/*.ts" }`) for extension-free internal paths.
- Two configs: `tsconfig.json` for editor + lint (may include `src/__tests__/`), `tsconfig.build.json` for emission (excludes tests, sets `outDir: dist`, `declaration: true`, `declarationMap: true`, `sourceMap: true`).
- Avoid `any`. If unavoidable, isolate it at one SDK call site and comment.
- All public surface is fully typed. `.d.ts` is shipped - consumers rely on it.

## Public API

- `src/index.ts` is the **only** re-export site. It re-exports the named values and types that form the contract.
- Anything not re-exported from `src/index.ts` is private, even if technically importable. Deep imports (`<pkg>/dist/internal.js`) are not part of the contract - consumers who reach for them are on their own.
- Breaking the public surface - removing an export, renaming, changing a signature, narrowing a return type - requires a `major` changeset.
- Additive changes - new exports, new optional params, widened return types - require a `minor` changeset.
- Bugfixes and internal refactors that leave the contract intact require a `patch` changeset.

## Build & Distribution

- Build: `tsc -p tsconfig.build.json` emits `dist/index.js` (+ submodules), `dist/*.d.ts`, and source maps.
- `package.json` shape:

```jsonc
{
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "bin": { /* optional: "<bin-name>": "./dist/cli.js" */ }
}
```

- `files` is a whitelist. Confirm `npm pack --dry-run` shows only `dist/`, `README.md`, `LICENSE`, `package.json`. Anything else leaking in is a packaging bug.
- `"sideEffects": false` is a promise: every module is import-safe and tree-shakeable. If a module legitimately has side effects, list it explicitly instead of dropping the flag.

## Runtime Neutrality

- No `node:*` imports in `src/` (CLI file is the documented exception).
- No `window`, `document`, `global`, `process`. Use `globalThis` for cross-runtime access.
- Crypto, date/time, fetch: use standard ECMAScript APIs (`crypto.subtle`, `Date`, `fetch`) - they exist in Node 18+, modern browsers, Bun, Deno, and workers. If a consumer needs to inject a custom provider, accept it as an option.
- If a feature genuinely requires Node, isolate it behind a separate subpath export (`<pkg>/node`) and document the runtime requirement. Do not poison the default export.

## Tests

- Vitest under `src/__tests__/` (or `src/**/__tests__/`). Fast unit suite.
- Test the public surface first. Cover internal modules only where they encode tricky invariants.
- No filesystem or network I/O in tests unless behind an adapter shape (`{ readFile }`) the test passes in a fake for.
- Snapshot tests reserved for serialized public output (formatted strings, generated AST nodes). Avoid snapshotting internal data shapes.
- Reset module-level state in `afterEach`. Better: have none.

## CLI (Optional)

Delete this section if `bin` is not set in `package.json`.

- `src/cli.ts` is the only file allowed `node:*` imports (`node:process`, `node:fs`, `node:path`, etc.).
- The CLI is a thin wrapper: parse argv -> call into the library -> print result -> set exit code. No business logic in the CLI itself.
- Argv parsing: TODO (`citty` / `commander` / `node:util.parseArgs`). `parseArgs` is zero-dep but verbose; `citty`/`commander` are nicer for subcommands.
- Exit codes: `0` success; non-zero on error. Document each non-zero code in `README.md`.
- Streams: results to **stdout**, diagnostics and errors to **stderr**. Never mix.
- Shebang at the top: `#!/usr/bin/env node`. `tsc` preserves it; if it does not, add a `chmod +x dist/cli.js` step to `build`.
- Tests: invoke the underlying library functions directly. Reserve subprocess tests for argv parsing and exit-code wiring.

## Releases (Changesets)

Workflow per user-facing PR:

1. Write code + tests.
2. `mise run changeset` - pick patch / minor / major and write one sentence describing the change from a consumer's perspective. Commit the generated `.changeset/*.md` alongside the code.
3. Merge.
4. On the release branch: `mise run version` - bumps `package.json`, updates `CHANGELOG.md`, deletes consumed `.changeset/*.md`. Commit.
5. `mise run release` - runs `build` then `changeset publish`. Uses the npm token in the active environment.

Rules:

- Every user-facing PR includes a `.changeset/` entry. Internal-only PRs (CI, docs, tests, refactors that change nothing observable) do not.
- The first release should be rehearsed: `npm publish --dry-run` to confirm the tarball contents before `release`.
- Pre-1.0 (`0.x.y`): minor = breaking. Treat minor changesets as the breaking-change channel until you cut 1.0.
- Yanking is forbidden - release a patch that fixes or reverts instead.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `node_modules/`
- `dist/`
- `coverage/`
- `.tsbuildinfo`
- `.turbo/`, `.cache/`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,coverage,.turbo,.cache}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name coverage -o -name .turbo -o -name .cache \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (lockfiles).

## Settings (Libraries Do Not Read Env)

Libraries do not read `process.env`, `import.meta.env`, or any other ambient configuration source. The host application owns env.

If your library needs configuration, accept it explicitly:

```ts
export interface ClientOptions {
  apiUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export function createClient(opts: ClientOptions) { /* ... */ }
```

Rules:

- No `process.env.X` in `src/`. CLI (`src/cli.ts`) is the documented exception - but it parses env once, hands typed values to the library, and never lets ambient env reach internal modules.
- Tests construct option objects directly. They do not mutate `process.env`.
- Document defaults at the call site (in the option type's JSDoc and in `README.md`), not via runtime env lookups.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- `.npmrc` containing auth tokens (`//registry.npmjs.org/:_authToken=...`)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `package.json`, `tsconfig*.json`, `lockfile`, `vitest.config.ts`, `.changeset/config.json`.

Use `.env.example` only for variable names (rare for libraries). Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Every user-facing change ships a `.changeset/` entry in the same commit (or the immediately following one).** PR review checks for it.
- **Generated artifacts ride with their source change.** `CHANGELOG.md` updates land in the same PR as the `changeset version` run. Lockfile updates commit with the `package.json` change.
- **Never commit secrets.** Real tokens, DSNs, bearer headers, npm tokens. `.env.example` is for variable names only.
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

- `AGENTS.md` is **durable** and stays committed. It is the canonical entrypoint, not scratch - do not add it to `.gitignore`.
- Durable architecture, decisions, and short-lived focus notes belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.

## Context Maintenance

- Keep `AGENTS.md` compact. Push detail into these files.
- Update `Commands` when `package.json` scripts change.
- Update `.context/project-context.md` when the public surface or build shape shifts.
- Record durable decisions (supported runtimes, CJS stance, peer-dep strategy, optional CLI) in `.context/project-context.md`.
- In-flight specs, DDs, and TDDs live in `.context/active/`; see `.context/writing-specs.md#lifecycle` for naming and lifecycle.
