# Engineering Guide

Operational standards for working in this API. Read before changing code.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install deps from lockfile. `pnpm install`. |
| `mise run dev` | `tsx watch src/index.ts` (or equivalent). `pnpm run dev`. |
| `mise run typecheck` | `tsc --noEmit`. Run before claiming type safety. `pnpm run typecheck`. |
| `mise run lint` | Biome or ESLint. `pnpm run lint`. |
| `mise run build` | `tsc` to `dist/`. Run before claiming production-ready. `pnpm run build`. |
| `mise run start` | `node dist/index.js`. `pnpm run start`. |
| `mise run test` | Vitest fast suite (state precise scope). `pnpm run test`. |
| `mise run openapi:export` | TODO: emit `openapi.json` from Zod schemas for downstream consumers. `pnpm run openapi:export`. |
| `mise run check` | typecheck + lint + test. |

State command scope exactly. Do not say "all tests pass" unless the script you ran covers every suite.

## TypeScript

- `strict: true`. No implicit `any`. `noUncheckedIndexedAccess` recommended.
- ESM-first (`"type": "module"`). Use `.ts` on relative imports when tsc rewrites them; alternatively configure Node subpath imports (`"imports": { "#src/*": "./src/*.ts" }`) for extension-free internal paths.
- Validate **everything** entering from outside the process — HTTP bodies, query params, headers, outbound responses, env vars — with Zod before use.
- Avoid `any`. If unavoidable, isolate it at one SDK call site and comment.

## Hono Patterns

- Define request and response schemas with Zod. Use `@hono/zod-validator` (or `zod-openapi`) so validation and OpenAPI generation share one source.
- Handlers are thin: validate → call service → return typed response. No business logic, no outbound calls.
- Middleware chain order: request id → logger → auth → route. Errors are caught by a centralized error middleware mounted last.
- Logger is attached to the request context; downstream services log with that child logger.
- One Zod schema per endpoint (request and response). Colocate schemas with their route or pull them into `src/schemas/` if shared across routes.

## Validation & Contracts

Zod is the single source of truth for HTTP shape.

- Internal types derive from `z.infer<typeof Schema>`. Do **not** hand-maintain a TS interface and a Zod schema for the same payload — they will drift.
- Treat the validated value as the canonical input; pass it down. Do not re-parse the same payload twice.
- Outbound HTTP responses are also Zod-validated before being returned to callers. Network responses are untrusted input.
- OpenAPI is generated from the Zod schemas (`@hono/zod-openapi` or equivalent). If consumers import the spec from this repo, commit the generated file alongside the schema edit that produced it.

## Auth

- Auth runs as Hono middleware mounted before protected routes. TODO: provider (JWT / session cookie / mTLS / API key).
- Token verification happens once per request. Attach the verified identity to `c.var` (`c.set("user", ...)`); downstream code reads it from there, never re-verifies.
- Auth errors map to `401 Unauthorized` or `403 Forbidden` through the centralized error middleware. Do not throw raw library errors.
- Tests build a fake auth context by mounting a stub middleware that calls `c.set("user", ...)` directly — do not generate real tokens in tests.

## Errors

- One centralized error middleware. Catches both thrown errors and validation failures.
- Default envelope: `application/problem+json` (RFC 7807) — `{ "type", "title", "status", "detail", "instance" }`. TODO: confirm or override per house style.
- Never leak provider errors, stack traces, or raw exception messages to clients. Log internally with the full context; respond with a safe envelope.
- Map Zod validation failures to `400 Bad Request` with field-level detail under a stable key (e.g. `errors`).
- Each error response carries the request id (from middleware) so logs and client reports correlate.

## Outbound HTTP

- One typed client wrapper in `src/lib/http-client.ts` over undici or native `fetch`. Services call this, never `fetch` directly.
- Explicit timeouts on every call. No silent infinite waits.
- Retry posture stated per call site (idempotent GETs may retry; POSTs require explicit caller opt-in with an idempotency key).
- Responses are Zod-validated before being returned. A schema mismatch is a programming error, not a user error — it raises a 502 via the error middleware.
- Outbound credentials come from `Config`, not `process.env`.

## Logging & Observability

- Pino structured JSON. Child logger per request with correlation id.
- Log decisions and outcomes, not raw payloads. Never log secrets, tokens, or full provider responses.
- TODO: error tracking (Sentry / none). If Sentry, initialize before any other module that may throw (`--import` flag).
- TODO: metrics + tracing exporter.

## Testing

- Vitest under `src/__tests__/` or `src/**/__tests__/`.
- API: instantiate `createApp()` and call `app.request(...)` — do not boot a real listener. Supertest is fine when you need wire-format quirks; otherwise `app.request` is enough.
- Mock at the boundary (outbound HTTP client / queue SDK / provider SDK), not inside service methods. If you find yourself mocking a service, restructure for dependency injection.
- Reset env vars, singletons, and mocks in `afterEach`.
- Auth: mount a stub auth middleware that sets `c.var.user`. Do not generate real tokens.

## Boundaries

- Route handlers do not call `src/lib/http-client.ts` directly. They go through services.
- Services do not parse env vars or read `process.env`. They take typed config in via constructor or factory.
- `src/lib/` holds pure helpers and adapter shells — no business logic.
- No in-process persistence. If the API ever needs durable state, add an external adapter rather than embedding a DB.

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

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (lockfiles, generated `openapi.json`).

## Settings

`src/config.ts` is the only place `process.env` is read. It exports a Zod-parsed `Config` constructed once at startup. Route handlers, services, middleware, and outbound clients take the typed value in — they never reach for `process.env` themselves.

```ts
import { z } from "zod";

const Env = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
  // TODO: auth issuer / audience, upstream API base URLs and keys.
});

export type Config = z.infer<typeof Env>;
export const loadConfig = () => Env.parse(process.env);
```

Rules:

- One `loadConfig()` call per process, in `src/index.ts` (or the app factory). Pass `Config` (or specific fields) explicitly downstream.
- **Never** `process.env.X` outside `src/config.ts`. Lint rule recommended.
- Tests build a `Config` literal directly — they do not mutate `process.env` globally.
- New env vars: extend the Zod schema, update `.env.example`, regenerate types if any consumer relies on them.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `package.json`, `tsconfig*.json`, lock files, public config files (`vitest.config.ts`, `biome.json`, etc.).

Use `.env.example` only for variable names. Preserve unrelated dirty work — never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject ≤ 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Generated artifacts ride with their source change.** Generated `openapi.json` commits with the Zod schema edit that produced it. Lockfile updates commit with the `package.json` change that triggered them.
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
- Record durable decisions (auth model, error envelope, deployment target) in `.context/project-context.md`.
- In-flight design docs live in `.context/active/` as `YYYYMMDD-<title>.md`; the PR that lands the work deletes the doc.
