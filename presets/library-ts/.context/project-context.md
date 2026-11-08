# Project Context

Durable architecture and ownership. Update when the public surface or build/distribution model changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What this library does, who imports it, what surface it exposes (functions, classes, React hooks, plugin object, CLI binary).

Default assumption baked into this preset: a published TypeScript library. Importable as `import { x } from "<pkg>"`. ESM-only. No service entry point, no runtime process, no env reads. Consumers compose this library into their own runtime.

If `bin` is set in `package.json`, this repo also ships a developer CLI built from `src/cli.ts`. The CLI section in `.context/engineering-guide.md` covers the rules; delete it if not applicable.

## Architecture (Data Flow)

```
src/<feature>.ts (internals)
  → src/index.ts  (barrel — public surface)
  → tsc build      → dist/index.{js,d.ts}
  → npm registry   → consumer `import { ... } from "<pkg>"`
```

Optional CLI flow (delete if not a CLI):

```
argv
  → src/cli.ts  (only file that touches node:process / node:fs)
  → calls into the same internals as the library API
  → exit code (0 success, non-zero on error); stderr for errors, stdout for output
```

Source of truth for the consumer contract: `src/index.ts` plus the emitted `dist/index.d.ts`. Anything reachable only through deep imports is private and may change without a major bump.

## Ownership Map

| Path | Owns |
|---|---|
| `src/index.ts` | Public surface. Re-exports only — no inline logic. |
| `src/*.ts` | Internal modules. Importable inside the package; not contract. |
| `src/__tests__/` | Vitest unit tests. |
| `src/cli.ts` | (Optional) CLI entry. Only file allowed `node:*` imports. |
| `dist/` | Generated build output. Gitignored. Published. |
| `.changeset/` | Pending release notes. One file per user-facing change. |
| `CHANGELOG.md` | Generated. Reflects the public surface history. |
| `package.json` | `exports`, `types`, `bin`, `files`, `sideEffects`, scripts. |
| `tsconfig.json` | Editor + lint config. |
| `tsconfig.build.json` | Stricter emission config used by `build`. |
| `vitest.config.ts` | Test runner config. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing usage, install, supported runtimes, example snippets. |

## External Integrations

Most libraries have none. Keep this section only if you wrap a vendor SDK or hit a specific runtime API.

- TODO: vendor SDK wrapped (auth scope, version constraint, retry posture).
- TODO: runtime-specific API used (and which runtime layers are gated behind it).

For each: where the dependency comes from, what surface area is exposed, and what changes when the underlying API breaks.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No business app concerns: no DB, no HTTP server, no queue.
- No `process.env` / `import.meta.env` / `process.cwd` reads in library code.
- No filesystem or network I/O at import time. Side-effect-free modules so consumers can tree-shake.
- No internal logger. Throw on error; return on success.
- No deep import paths promised. `src/internal.ts` is implementation detail even if reachable.
- No `any` in the public surface. Internal `any` only at an isolated SDK boundary with a comment.
