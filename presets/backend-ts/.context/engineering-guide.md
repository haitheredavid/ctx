# Engineering Guide

Operational standards for working in this service. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run check` | typecheck + lint + test. |
| `mise run install` | Install deps from lockfile. `pnpm install`. |
| `mise run dev` | `tsx watch src/index.ts` (or equivalent). `pnpm run dev`. |
| `mise run typecheck` | `tsc --noEmit`. Run before claiming type safety. `pnpm run typecheck`. |
| `mise run lint` | Biome or ESLint. `pnpm run lint`. |
| `mise run build` | `tsc` to `dist/`. Run before claiming production-ready. `pnpm run build`. |
| `mise run start` | `node dist/index.js`. `pnpm run start`. |
| `mise run test` | Vitest fast suite (state precise scope). `pnpm run test`. |
| `mise run db:generate` | `drizzle-kit generate` - produces migration SQL from `schema.ts`. `pnpm run db:generate`. |
| `mise run db:migrate` | Apply migrations against `DATABASE_URL`. `pnpm run db:migrate`. |

State command scope exactly. Do not say "all tests pass" unless the script you ran covers every suite.

## TypeScript

- `strict: true`. No implicit `any`. `noUncheckedIndexedAccess` recommended.
- ESM-first (`"type": "module"`). Use `.ts` on relative imports when tsc rewrites them; alternatively configure Node subpath imports (`"imports": { "#src/*": "./src/*.ts" }`) for extension-free internal paths.
- Validate **everything** entering from outside the process - HTTP bodies, queue messages, provider responses, env vars - with Zod before use.
- Avoid `any`. If unavoidable, isolate it at one SDK call site and comment.

## Hono Patterns

- Define request and response schemas with Zod. Use `@hono/zod-validator` (or `zod-openapi`) so validation and OpenAPI generation share one source.
- Handlers are thin: validate -> call service -> return typed response.
- Errors map to safe HTTP responses via a centralized error middleware. Never leak provider errors or stack traces.
- Logger is attached to the request context; downstream services log with that child logger.

## Database (Drizzle + Postgres)

- `src/db/schema.ts` is the only source of truth for tables. Run `mise run db:generate` after every change; commit both the schema edit and the generated SQL.
- Services own queries. Compose them with Drizzle's query builder - do not write services that hand back raw `db` references.
- Use parameter binding for values; allow-list identifiers (table/column names) if any are user-controlled.
- Transactions live inside service methods, not route handlers.
- Connection lifecycle: one pool created in `src/db/client.ts`, imported by services. Do not open ad-hoc connections.

## Worker (Optional)

If this service runs async jobs, keep these rules. Otherwise delete this section.

- Worker payloads are Zod-validated on consume. Treat them as untrusted input even though you produced them.
- Worker has its own entry (`src/workers/<name>.ts`) and its own log scope.
- Queue transports state; database persists results. Neither owns business logic - services do.
- Idempotency: design jobs so duplicate delivery is safe (dedupe key, conditional write).
- Terminal outcomes: success and failure both clear in-flight state; never leave a job "stuck."

## Logging & Observability

- Pino structured JSON. Child logger per request/job with correlation id.
- Log decisions and outcomes, not raw payloads. Never log secrets, tokens, or full provider responses.
- TODO: error tracking (Sentry / none). If Sentry, initialize before any other module that may throw (`--import` flag).

## Testing

- Vitest under `src/__tests__/` or `src/**/__tests__/`.
- API: instantiate `createApp()` and call `app.request(...)` - do not boot a real listener.
- DB: PGlite for in-process Postgres in tests. Migrate on setup, truncate between tests.
- Mock at the boundary (HTTP / queue / provider SDK), not inside service methods. If you find yourself mocking a service, restructure for dependency injection.
- Reset env vars, singletons, and mocks in `afterEach`.

## Boundaries

- Route handlers do not import from `src/db/`. They go through services.
- Services do not parse env vars or read process.env. They take typed config in via constructor or factory.
- Workers do not call routes. They share services with the API.
- `src/lib/` holds pure helpers - no I/O, no provider SDKs.

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

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (lockfiles, generated `src/db/migrations/` SQL).

## Settings

`src/config.ts` is the only place `process.env` is read. It exports a Zod-parsed `Config` constructed once at startup. Route handlers, services, workers, and the DB client take the typed value in - they never reach for `process.env` themselves.

```ts
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof Env>;
export const loadConfig = () => Env.parse(process.env);
```

Rules:

- One `loadConfig()` call per process, in `src/index.ts` (or the app factory). Pass `Config` (or specific fields) explicitly downstream.
- **Never** `process.env.X` outside `src/config.ts`. Lint rule recommended.
- Tests build a `Config` literal directly - they do not mutate `process.env` globally.
- New env vars: extend the Zod schema, update `.env.example`, regenerate types if any consumer relies on them.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `package.json`, `tsconfig*.json`, lock files, public config files (`drizzle.config.ts`, `vitest.config.ts`, `biome.json`, etc.).

Use `.env.example` only for variable names. Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Generated artifacts ride with their source change.** Drizzle migration SQL commits with the `schema.ts` edit that produced it. Lockfile updates commit with the `package.json` change that triggered them.
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
- Record durable decisions (auth model, queue choice, deployment target) in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
