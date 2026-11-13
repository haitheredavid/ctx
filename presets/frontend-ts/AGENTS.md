# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this app is, architecture, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, TypeScript/React standards, testing, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

## Stack

React + Vite + TypeScript + TailwindCSS frontend. Forms via `react-hook-form` + Zod. TODO: state library (MobX / Zustand / Context+useReducer). TODO: router. TODO: test runner (Vitest + Playwright recommended).

## Commands

Toolchain: Node 26 + pnpm 12, pinned in `mise.toml`. Run `mise install` once.

```
mise run install      # pnpm install
mise run dev          # pnpm run dev: Vite dev server with HMR
mise run typecheck    # pnpm run typecheck: tsc --noEmit
mise run lint         # pnpm run lint: ESLint or Biome
mise run build        # pnpm run build: production build to dist/
mise run preview      # pnpm run preview: serve built bundle
mise run test         # pnpm run test: Vitest (component + unit)
mise run check        # typecheck + lint + test
```

Cite exact script scope. Do not claim a command runs every test unless `package.json` proves it.

## Standards

- Strict TypeScript. No `any` except at SDK boundaries; isolate and comment.
- `src/client/` (browser code), `src/shared/` (cross-boundary types). If a backend exists in this repo, it lives in `src/server/` and **`src/client/` must not import from it** - share types via `src/shared/` only.
- Every async surface renders four states: idle, loading, success, error. Do not hide failed responses.
- Forms: `react-hook-form` + Zod resolver. Validate on the user-input boundary.
- Tailwind + CSS variables for theming. shadcn/Radix UI for unstyled primitives.
- Environment variables exposed to Vite must be non-sensitive. Browser env never contains backend secrets.

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
| `src/client/` | React components, UI state, API client helpers, routing. |
| `src/shared/` | Cross-boundary TypeScript contracts (request/response, domain types). |
| `vite.config.ts` | Dev proxy, plugins, build output. |
| `tailwind.config.ts` | Theme tokens, content globs. |
| `.context/` | Durable architecture, decisions, debt. Update when shape changes. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `package.json` scripts change. Update `.context/` when architecture, integrations, or durable decisions shift. Track in-flight work per `.context/guides/doc-lifecycle.md`.
