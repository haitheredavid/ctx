# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this service is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) - commands, TypeScript standards, framework patterns, safety.
- [.context/writing-specs.md](.context/writing-specs.md) - how to write a spec (what and why) and the spec -> DD -> TDD flow.
- [.context/writing-dds.md](.context/writing-dds.md) - how to write a design document (DD) that splits work into TDDs.
- [.context/writing-tdds.md](.context/writing-tdds.md) - how to write a Technical Design Document (TDD) for one shippable unit.
- [.context/README.md](.context/README.md) - `.context/` conventions: durable guides vs. ephemeral `active/` specs, DDs, and TDDs (naming and lifecycle in `.context/writing-specs.md#lifecycle`).

## Stack

Node + TypeScript backend. Hono for HTTP (with `@hono/node-server`), Zod for request/response validation, Drizzle ORM + Postgres for persistence, Vitest + PGlite for tests, Pino for structured logging. Optional async worker seam: SQS or BullMQ consumer with Redis hot state.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

```
mise run install      # pnpm install
mise run dev          # pnpm run dev (tsx watch on src/index.ts (or equivalent))
mise run typecheck    # pnpm run typecheck (tsc --noEmit)
mise run lint         # pnpm run lint (Biome or ESLint)
mise run build        # pnpm run build (tsc to dist/)
mise run start        # pnpm run start (node dist/index.js)
mise run test         # pnpm run test (Vitest (fast suite))
mise run db:generate  # pnpm run db:generate (drizzle-kit generate)
mise run db:migrate   # pnpm run db:migrate (apply migrations)
mise run check        # typecheck + lint + test
```

Cite exact script scope. Do not claim a command runs every test unless `package.json` proves it.

## Standards

- Strict TypeScript, ESM (`"type": "module"`). Explicit `.ts` extensions on relative imports if tsc rewrites them.
- Route handlers validate inputs with Zod before touching the database or external services.
- Database access lives behind a service module. Routes call services, never the ORM directly.
- Credentials and connection config are parsed once at startup, not re-read per request.
- Use parameter binding for user-controlled values. Identifier-shaped inputs (table/column names) must be allow-listed.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/engineering-guide.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## MCP Servers

- TODO: list MCP servers agents may use (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`).

## Skills

- TODO: list agent skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`).

## Where To Edit

| File | Owns |
|---|---|
| `src/routes/` | Hono route handlers. Validate, delegate, respond. |
| `src/services/` | Business logic, DB queries via Drizzle, provider SDK calls. |
| `src/db/schema.ts` | Drizzle schema. Source of truth for tables. |
| `src/db/migrations/` | Generated migration SQL. Do not hand-edit. |
| `src/config.ts` | Env parsing and typed config object. |
| `src/lib/logger.ts` | Pino logger factory. |
| `drizzle.config.ts` | Migration generation config. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `package.json` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Record pipeline/contract changes in `.context/project-context.md` so they survive turnover.
