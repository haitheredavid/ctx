# Project Context

Durable architecture and ownership. Update when the shape of the app changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What product surface this app delivers, who uses it, what the API talks to behind itself.

Default assumption baked into this preset: a TypeScript single-page app (`web/`) served by a FastAPI backend (`api/`). The API is the contract authority. Generated TypeScript types in the web bundle come from the API's OpenAPI schema.

## Architecture (Data Flow)

```
user interaction
  → React component (web/, local state)
  → typed API client (web/src/api-client/, generated types)
  → HTTP /api/* (Vite proxy in dev, direct in prod)
  → FastAPI route (api/, pydantic validation)
  → service module (api/)
  → persistence / external SDK
  → typed response (BaseModel)
  → React render

# contract regeneration
api/<pkg>/scripts/emit_openapi.py
  → shared/openapi.json (committed)
  → web/src/api-client/types.ts (generated, committed)
```

Source of truth for UI state: web client. Source of truth for domain data: API. Source of truth for the contract between them: pydantic models in `api/`. Web only consumes the schema; it never authors it.

## Ownership Map

| Path | Owns |
|---|---|
| `web/` | All browser code: components, UI state, typed API client. |
| `web/src/api-client/types.ts` | **Generated** from `shared/openapi.json`. Do not hand-edit. |
| `web/src/api-client/index.ts` | Hand-written `fetch` wrapper using generated types. |
| `web/vite.config.ts` | Dev server, `/api` proxy, build. |
| `web/tailwind.config.ts` | Theme tokens. |
| `api/` | All Python code: app factory, routes, services, settings. |
| `api/src/<pkg>/main.py` | FastAPI app factory + composition root. |
| `api/src/<pkg>/settings.py` | `Settings(BaseSettings)`. Only env reader. |
| `api/src/<pkg>/routes/` | Route modules. Validate via pydantic, delegate to services. |
| `api/src/<pkg>/services/` | Business logic. Only layer that calls persistence / SDKs. |
| `api/src/<pkg>/models/` | Pydantic request/response models. Source of truth for contracts. |
| `api/src/<pkg>/scripts/emit_openapi.py` | Dumps OpenAPI to stdout / file. |
| `shared/openapi.json` | Committed contract artifact. Updated together with model changes. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, env vars, deployment. |

## External Integrations

TODO. Document each external system the API talks to:
- TODO: database (driver, connection source, migration story).
- TODO: auth provider (where session lives, how the web client knows it is logged in).
- TODO: object storage, third-party APIs.

The web client integrates only with this repo's API. If it ever needs to talk to a third party directly, document it explicitly and confirm no secrets reach the bundle.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No backend secrets in the web bundle.
- No hand-edited generated types. Always regenerate from `shared/openapi.json`.
- No direct DB or external-SDK access from the web client.
- No pydantic model lives in `web/`. Web consumes generated TS types only.
- No `os.environ.get(...)` outside `Settings` in `api/`.
- No business logic in FastAPI route functions — they validate and delegate.
