# Engineering Guide

Operational standards for working in this fullstack repo. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install deps from lockfile. Runs `pnpm install`. |
| `mise run dev` | Vite + `tsx watch` on server, concurrently. Vite proxies `/api`. Runs `pnpm run dev`. |
| `mise run typecheck` | `tsc --noEmit` across client/server/shared (project references or per-side). Runs `pnpm run typecheck`. |
| `mise run lint` | Biome or ESLint. Runs `pnpm run lint`. |
| `mise run build` | Build client to `dist/client`, server to `dist/server`. Runs `pnpm run build`. |
| `mise run start` | `node dist/server/index.js`. Serves API + static client from one process. Runs `pnpm run start`. |
| `mise run test` | Vitest. Run both client (jsdom) and server (node) suites. Runs `pnpm run test`. |
| `mise run db:generate` | `drizzle-kit generate` if using Drizzle. Runs `pnpm run db:generate`. |
| `mise run db:migrate` | Apply migrations against `DATABASE_URL`. Runs `pnpm run db:migrate`. |
| `mise run check` | typecheck + lint + test. |

State command scope exactly. Do not say "all tests pass" unless the script you ran covers every suite.

## Source Layout (Hard Rule)

```
src/
  client/   # browser-only code
  server/   # node-only code
  shared/   # cross-boundary types & Zod schemas - pure, no runtime imports of client/server
```

- **`src/client/` must not import from `src/server/`.** Lint rule recommended (`no-restricted-imports`).
- **`src/shared/` must not import from client or server.** It is leaf-level.
- Static assets and CSS live under `src/client/`.

## TypeScript

- `strict: true`. No implicit `any`. `noUncheckedIndexedAccess` recommended.
- One `tsconfig.base.json` with strict settings; per-side configs override `lib`, `jsx`, `moduleResolution`.
- Server: ESM, `moduleResolution: "NodeNext"` or `"Bundler"` with tsx.
- Client: `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, lib includes `DOM`.
- Shared: no DOM, no Node - keep it portable.

## Contracts: src/shared/

- Each API surface gets a Zod schema pair: request and response.
- Server uses the schema to validate request bodies/query/params at the route boundary.
- Client uses the inferred types directly; can optionally re-parse responses for defense-in-depth.
- Versioning: if a contract changes shape, change it in `src/shared/` first; both sides will fail to typecheck until updated.

## Client Patterns

- Strict TypeScript; same rules as `frontend-ts` preset.
- React + Vite + Tailwind. shadcn/Radix primitives for accessible UI.
- Forms: `react-hook-form` + Zod resolver. Reuse schemas from `src/shared/` when the form maps directly to an API payload.
- Every async surface renders idle/loading/success/error explicitly.
- API client lives in `src/client/api/`. Thin wrapper around `fetch` that knows the base URL and adds correlation/auth headers.
- TODO: state management choice (MobX / Zustand / Context+useReducer).
- TODO: server-data caching choice (TanStack Query / SWR / hand-rolled).

## Server Patterns

- Hono + `@hono/node-server` + Zod validation. Same rules as `backend-ts` preset.
- Route handlers: validate -> service -> respond. No business logic.
- Services own all DB and provider-SDK access.
- Drizzle schema in `src/server/db/schema.ts` is the source of truth.
- Pino logger; child logger per request with a correlation id that the client can also send.
- TODO: auth (session cookie / bearer). Whichever, expose a `/api/auth/session` (or equivalent) the client can call to derive logged-in state - do not duplicate auth state in client storage.

## Dev Server

- `vite.config.ts` proxies `/api` -> server port (default `localhost:3000` or whatever your server listens on).
- HMR for client. tsx watch restarts the server on `src/server/` and `src/shared/` changes.
- One terminal command (`mise run dev`) brings up both - keep it that way.

## Build & Deploy

- Default: single Node process serves API and static client. `dist/server/index.js` mounts the Hono app and serves `dist/client/` as static files.
- Alternative split: deploy client to a CDN and server separately. Document the choice in `.context/project-context.md`.
- Build is deterministic from `package.json` scripts. No hand steps.

## Testing

- Vitest, two configs: `vitest.client.config.ts` (jsdom or happy-dom) and `vitest.server.config.ts` (node). Or one config with environment routing.
- Client: component tests; mock the network at the fetch boundary (MSW recommended).
- Server: API tests instantiate `createApp()` and call `app.request(...)`. DB tests use PGlite.
- Shared: pure schema tests if logic is non-trivial.
- Reset env vars, singletons, and mocks in `afterEach`.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `node_modules/`
- `dist/`, `dist/client/`, `dist/server/`
- `.vite/`
- `coverage/`
- `.turbo/`, `.cache/`
- `.tsbuildinfo`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{node_modules,dist,.vite,coverage,.turbo,.cache}/**' '<pattern>'
find . -type d \( -name node_modules -o -name dist -o -name .vite -o -name coverage \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (lockfiles, generated `src/server/db/migrations/` SQL).

## Settings

Each side has its own typed settings seam. They never share - server env stays on the server, browser env stays in the bundle.

**Server** - `src/server/config.ts` is the only module that reads `process.env`:

```ts
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof Env>;
export const loadConfig = () => Env.parse(process.env);
```

Add auth-related vars (e.g. `SESSION_SECRET`) when the auth lib is chosen.

**Client** - `src/client/env.ts` is the only module that reads `import.meta.env`:

```ts
import { z } from "zod";

const Env = z.object({
  VITE_API_BASE_URL: z.string().url().optional(),
  MODE: z.string(),
});

export const env = Env.parse(import.meta.env);
```

`MODE` is a free string because Vite supports custom modes via `vite --mode <name>`.

Rules:

- `src/server/` never reads `import.meta.env`. `src/client/` never reads `process.env`.
- Backend secrets never get a `VITE_*` prefix - Vite would ship them to the browser.
- `src/shared/` has no settings module. Shared code takes typed values in as arguments.
- Tests build the config from overrides; do not mutate `process.env` or `import.meta.env` globally.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `package.json`, `tsconfig*.json`, lock files, public config files (`vite.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, etc.).

Use `.env.example` only for variable names. Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Generated artifacts and contract changes ride with their source.** Drizzle migration SQL commits with the `schema.ts` edit. A `src/shared/` contract change commits with the consuming-side edits so client + server stay in lockstep. Lockfile updates commit with the `package.json` change that triggered them.
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

- `AGENTS.md` is **durable** and stays committed. It is the canonical entrypoint, not scratch - do not add it to `.gitignore`.
- Durable architecture, decisions, and short-lived focus notes belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.

## Context Maintenance

- Keep `AGENTS.md` compact. Push detail into these files.
- Update `Commands` when `package.json` scripts change.
- Update `.context/project-context.md` when architecture, integrations, or ownership shift.
- Record durable decisions (state lib, server-data cache, deploy topology, auth model) in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
