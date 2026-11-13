# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this service is, architecture, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, TypeScript standards, framework patterns, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

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

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/guides/engineering.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/guides/engineering.md`](.context/guides/engineering.md).

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
