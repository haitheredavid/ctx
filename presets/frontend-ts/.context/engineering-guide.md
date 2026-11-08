# Engineering Guide

Operational standards for working in this repo. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install deps from lockfile (`pnpm install`). |
| `mise run dev` | Vite dev server with HMR. (`pnpm run dev`) |
| `mise run typecheck` | `tsc --noEmit`. Run before claiming type safety. (`pnpm run typecheck`) |
| `mise run lint` | ESLint or Biome. (`pnpm run lint`) |
| `mise run build` | Production bundle to `dist/`. Run before claiming production-ready. (`pnpm run build`) |
| `mise run preview` | Serve `dist/` locally. (`pnpm run preview`) |
| `mise run test` | Vitest. State scope precisely (unit / component / e2e). (`pnpm run test`) |
| `mise run check` | typecheck + lint + test. |

State command scope exactly. Do not say "all tests pass" unless the script you ran covers every suite — check `package.json` first.

## TypeScript

- `strict: true`. No implicit `any`. `noUncheckedIndexedAccess` recommended.
- Path alias `@/*` → `src/client/*` (or your chosen root).
- Module resolution: `Bundler` (Vite-friendly).
- Validate unknown external input at the network boundary with Zod, then trust the typed value internally.
- Avoid `any`. If unavoidable, isolate it at one SDK/transport call site and comment why.

## React Patterns

- Components small and single-purpose. Co-locate component-only helpers.
- Controlled forms via `react-hook-form` with Zod resolver. No uncontrolled inputs in production code.
- Async surfaces render four states explicitly: **idle, loading, success, error**. Render useful empty/error states — do not silently swallow failures.
- Effects should not own data ownership. Prefer derived state and explicit fetch hooks.
- Suspense + ErrorBoundary at route or feature root, not per-component.

## State Management

TODO: choose one and document the rule here.
- **MobX**: observable stores per feature, composed under a `RootStore`. React via `mobx-react-lite`.
- **Zustand**: one slice per concern, selectors at the hook boundary.
- **Context + useReducer**: for low-frequency global state only; avoid for high-churn data.

Whichever choice: forms own their own state (react-hook-form), routing owns navigation state, server data owns itself (TODO: pick TanStack Query / SWR / hand-rolled). Do not duplicate.

## Styling

- TailwindCSS with CSS custom properties for theme tokens (light/dark).
- shadcn/Radix UI for unstyled, accessible primitives.
- `clsx` + `tailwind-merge` (via `cn` helper) for conditional classnames.
- Class Variance Authority (CVA) for component variants.
- No inline styles except for dynamic values that cannot be expressed as classes.

## Vite

- API requests proxied in dev: `/api` → backend port (configure in `vite.config.ts`).
- Env: only `VITE_*`-prefixed vars are exposed to the bundle. Never put secrets behind that prefix.
- Build output `dist/` is the single deploy artifact.

## Testing

- Vitest for unit + component (jsdom or happy-dom).
- Playwright for end-to-end if needed.
- Reset module-level state (singletons, stores) in `afterEach`.
- Mock the network at the boundary (MSW or fetch stub), not at component prop level.
- Run `<pkg> run typecheck` and `<pkg> run build` before claiming a change is ready.

## Boundaries

- `src/client/` (browser) never imports from `src/server/` (if it exists). Cross-boundary types live in `src/shared/`.
- API client is a thin module — no business logic, just request shaping and response parsing.
- Stores do not call `fetch` directly; they go through the API client.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `node_modules/`
- `dist/`
- `.vite/`
- `coverage/`
- `.turbo/`, `.parcel-cache/`
- `.tsbuildinfo`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,.vite,coverage,.turbo,.parcel-cache}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name .vite -o -name coverage \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (lockfiles).

## Settings

`src/env.ts` is the only module that touches `import.meta.env`. It validates the Vite-exposed `VITE_*` vars with Zod and exports a typed `env` object. Components, hooks, and the API client import `env` — they never read `import.meta.env` directly.

```ts
import { z } from "zod";

const Env = z.object({
  VITE_API_BASE_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  MODE: z.string(),
});

export const env = Env.parse(import.meta.env);
export type Env = typeof env;
```

`VITE_API_BASE_URL` is optional — same-origin deploys leave it unset and let the client call `/api/...` relative paths. `MODE` is a free string because Vite supports custom modes via `vite --mode <name>`.

Rules:

- Only `VITE_*`-prefixed vars enter the bundle. Never put secrets behind that prefix.
- Outside `src/env.ts`, do not reference `import.meta.env.X`. Lint rule recommended (`no-restricted-syntax` with selector `MemberExpression[object.type='MetaProperty'][property.name='env']`).
- Tests stub the module (`vi.mock("@/env", ...)`) instead of mutating `import.meta.env`.
- New `VITE_*` var: extend the Zod schema and add it to `.env.example`.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `package.json`, `tsconfig*.json`, lock files, public config files (`vite.config.ts`, `tailwind.config.ts`, `eslint.config.*`, `vitest.config.*`, etc.).

Use `.env.example` only for variable names. Preserve unrelated dirty work — never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject ≤ 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Lockfile updates commit with the `package.json` change** that triggered them.
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
- Durable architecture, decisions, and short-lived focus notes belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.

## Context Maintenance

- Keep `AGENTS.md` compact. Push detail into these files.
- Update `Commands` when `package.json` scripts change.
- Update `.context/project-context.md` when architecture, integrations, or ownership shift.
- Record durable decisions (chosen state lib, chosen router, chosen test runner) in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
