# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this app is, architecture, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, language standards, cross-language contract rules, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

## Stack

Split repo: `web/` (React + Vite + TypeScript frontend) and `api/` (FastAPI + uv Python backend). The API is the source of truth for contracts; FastAPI emits `openapi.json` which generates a typed TypeScript client in `web/`. One direction.

## Commands

Toolchain: Node 26 + pnpm 12 and Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

```
mise run install         # api:install + web:install
mise run api:install     # cd api && uv sync
mise run api:dev         # uv run uvicorn <pkg>.main:app --reload --port 8000
mise run api:test        # uv run pytest
mise run api:lint        # uv run ruff check .
mise run api:typecheck   # uv run ty check
mise run api:openapi     # uv run python -m <pkg>.scripts.emit_openapi > ../shared/openapi.json
mise run web:install     # cd web && pnpm install
mise run web:dev         # vite, proxies /api -> http://localhost:8000
mise run web:gen-api     # runs api:openapi, then openapi-typescript ../shared/openapi.json -> src/api-client/types.ts
mise run web:typecheck   # pnpm run typecheck
mise run web:lint        # pnpm run lint
mise run web:build       # pnpm run build
mise run web:test        # pnpm run test
mise run check           # api:lint + api:typecheck + api:test + web:typecheck + web:lint + web:test
```

Cite exact script scope. Do not claim a command runs every test unless the relevant manifest proves it.

## Standards

- API is the contract authority. FastAPI `pydantic.BaseModel` request/response models -> `openapi.json` -> generated TS types in `web/src/api-client/`. Web never edits the generated file by hand.
- Strict TypeScript in `web/`. Same `frontend-ts` rules: idle/loading/success/error on every async surface, controlled forms, no backend secrets in the bundle.
- Strict Python in `api/`. Same `python` rules: `Settings(BaseSettings)` is the only env path, `@dataclass` internal, `BaseModel` at boundaries.
- Dev: Vite proxies `/api` to the FastAPI port. In production: choose between same-origin (FastAPI serves the built bundle) or split-origin (web on CDN, API behind a separate host) - document in `.context/project-context.md`.

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
| `web/src/` | React app, UI state, typed API client. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `web/src/api-client/types.ts` | **Generated.** Do not hand-edit. Re-run `mise run web:gen-api`. |
| `web/src/api-client/index.ts` | Hand-written wrapper around `fetch` that uses generated types. |
| `api/src/<pkg>/` | FastAPI routes, services, models, settings. |
| `api/src/<pkg>/main.py` | App factory + composition root. |
| `api/src/<pkg>/settings.py` | `Settings(BaseSettings)`. |
| `shared/openapi.json` | API contract artifact, emitted from FastAPI. Committed. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

After any API model change: emit `openapi.json`, regenerate web types, commit both. Update `Commands` here when scripts change in either side. Record cross-language contract decisions (auth scheme, error envelope, pagination model) in `.context/project-context.md`.
