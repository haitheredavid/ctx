# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) — what this API is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) — commands, TypeScript standards, Hono/Zod patterns, safety.
- [.context/writing-tdds.md](.context/writing-tdds.md) — how to write a Technical Design Document for this repo.
- [.context/README.md](.context/README.md) — `.context/` conventions: durable guides vs. ephemeral `active/` design docs (`YYYYMMDD-<title>.md`, deleted when the work lands).

## Stack

Node + TypeScript HTTP API. Hono with `@hono/node-server`, Zod for request/response validation, `@hono/zod-validator` (or `zod-openapi`) so validation and OpenAPI share one source. Vitest + supertest (or `app.request()`) for tests. Pino for structured logging. Storage is external — this preset does not assume an in-process database; persistence sits behind outbound adapters or other services.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

```
mise run install        # pnpm install
mise run dev            # pnpm run dev; tsx watch on src/index.ts (or equivalent)
mise run typecheck      # pnpm run typecheck; tsc --noEmit
mise run lint           # pnpm run lint; Biome or ESLint
mise run build          # pnpm run build; tsc to dist/
mise run start          # pnpm run start; node dist/index.js
mise run test           # pnpm run test; Vitest (fast suite)
mise run openapi:export # pnpm run openapi:export; TODO: emit openapi.json from Zod schemas
mise run check          # typecheck + lint + test
```

Cite exact script scope. Do not claim a command runs every test unless `package.json` proves it.

## Standards

- Strict TypeScript, ESM (`"type": "module"`). Explicit `.ts` extensions on relative imports if tsc rewrites them.
- Zod is the single source of truth for HTTP contracts. Internal types derive from `z.infer<...>`. No hand-maintained parallel types.
- Route handlers stay thin: validate input → call service → return typed response. Validation happens at the HTTP boundary, never deeper.
- Auth runs as middleware mounted before protected routes. TODO: provider (JWT / session / mTLS). Auth context attaches to `c.var`.
- Errors flow through one centralized middleware that emits `application/problem+json` (RFC 7807) by default. Never leak provider errors or stack traces. TODO: confirm or override envelope.
- Credentials and connection config are parsed once at startup, not re-read per request. No `process.env` outside `src/config.ts`.
- Outbound HTTP goes through a typed client wrapper with explicit timeouts; responses are Zod-validated before use.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/engineering-guide.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## MCP Servers

- TODO: list MCP servers agents may use (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`). Run `ctx scaffold --preset <name>` to detect them.

## Skills

- TODO: list agent skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`). Run `ctx scaffold --preset <name>` to detect them.

## Where To Edit

| File | Owns |
|---|---|
| `src/index.ts` | HTTP server entry. Wires config, logger, middleware, routes, error handlers. |
| `src/routes/` | Hono route handlers. Validate, delegate, respond. |
| `src/services/` | Business logic. The only layer that calls outbound clients or external SDKs. |
| `src/middleware/auth.ts` | Auth middleware (TODO: provider). Attaches identity to `c.var`. |
| `src/middleware/errors.ts` | Error middleware. Maps thrown errors to safe HTTP responses. |
| `src/lib/http-client.ts` | Outbound HTTP wrapper (TODO: undici / native `fetch`). Timeouts, retry posture. |
| `src/lib/logger.ts` | Pino factory; loggers carry request context. |
| `src/config.ts` | Env parsing (Zod-validated) into typed config. |
| `src/schemas/` | Shared Zod schemas (optional — colocated per route is also fine). |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `package.json` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Record contract/auth/deployment changes in `.context/project-context.md` so they survive turnover.
