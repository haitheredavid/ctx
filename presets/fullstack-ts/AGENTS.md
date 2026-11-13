# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this app is, architecture, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, TypeScript standards, framework patterns, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

## Stack

Single-repo TypeScript fullstack. React + Vite + Tailwind in `src/client/`. Node + Hono in `src/server/`. Shared Zod schemas + types in `src/shared/`. Strict boundary: client cannot import from server. Cross-boundary contracts only via `src/shared/`.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

```
mise run install           # pnpm install
mise run dev               # pnpm run dev - concurrent vite + tsx watch on server
mise run typecheck         # pnpm run typecheck - tsc --noEmit across client/server/shared
mise run lint              # pnpm run lint - Biome or ESLint
mise run build             # pnpm run build - build client (dist/client) and server (dist/server)
mise run start             # pnpm run start - node dist/server/index.js (serves API + static client)
mise run test              # pnpm run test - Vitest
mise run db:generate       # pnpm run db:generate - drizzle-kit generate (if using Drizzle)
mise run db:migrate        # pnpm run db:migrate - apply migrations
mise run check             # typecheck + lint + test
```

Cite exact script scope. Do not claim a command runs every test unless `package.json` proves it.

## Standards

- Strict TypeScript everywhere. Same `tsconfig.base.json`, per-side overrides for `lib` and `jsx`.
- `src/client/` (browser) **cannot import from `src/server/`** under any circumstance. Cross-boundary types come from `src/shared/` only.
- `src/shared/` exports Zod schemas. Server validates inbound requests with them; client uses the inferred types and may re-validate responses for defense-in-depth.
- Every async surface in the client renders idle/loading/success/error.
- Backend secrets stay in `src/server/`. The Vite-exposed `VITE_*` env is for non-sensitive config only.

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
| `src/client/` | React components, UI state, API client, routing. |
| `src/server/` | Hono routes, services, DB access, env parsing. |
| `src/shared/` | Zod schemas + inferred types shared by both sides. |
| `vite.config.ts` | Client build, dev server, `/api` proxy to server port. |
| `tsconfig.base.json` + per-side configs | Strict settings, path aliases, JSX, lib targets. |
| `.context/` | Durable architecture, decisions, debt. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `package.json` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. When a shape changes in `src/shared/`, confirm both client and server compile against the new contract before merging.
