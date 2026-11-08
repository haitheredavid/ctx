# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) — what this app is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) — commands, TypeScript standards, framework patterns, safety.
- [.context/writing-tdds.md](.context/writing-tdds.md) — how to write a Technical Design Document for this repo.
- [.context/README.md](.context/README.md) — `.context/` conventions: durable guides vs. ephemeral `active/` design docs (`YYYYMMDD-<title>.md`, deleted when the work lands).

## Stack

Single-repo TypeScript fullstack. React + Vite + Tailwind in `src/client/`. Node + Hono in `src/server/`. Shared Zod schemas + types in `src/shared/`. Strict boundary: client cannot import from server. Cross-boundary contracts only via `src/shared/`.

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

```
mise run install           # pnpm install
mise run dev               # pnpm run dev — concurrent vite + tsx watch on server
mise run typecheck         # pnpm run typecheck — tsc --noEmit across client/server/shared
mise run lint              # pnpm run lint — Biome or ESLint
mise run build             # pnpm run build — build client (dist/client) and server (dist/server)
mise run start             # pnpm run start — node dist/server/index.js (serves API + static client)
mise run test              # pnpm run test — Vitest
mise run db:generate       # pnpm run db:generate — drizzle-kit generate (if using Drizzle)
mise run db:migrate        # pnpm run db:migrate — apply migrations
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

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Full list in `.context/engineering-guide.md`. Use `.env.example` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

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
