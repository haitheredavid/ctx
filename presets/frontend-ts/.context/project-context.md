# Project Context

Durable architecture and ownership. Update when the shape of the app changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What product surface this app delivers, who uses it, what backend it talks to.

Default assumption baked into this preset: a TypeScript single-page application built with React + Vite. Browser-only by default; if a server lives in this repo, it sits behind a thin API contract under `src/shared/`.

## Architecture (Data Flow)

```
user interaction
  → React component (local state)
  → store / hook (UI state, derived data)
  → API client (typed request to backend)
  → backend (TODO: own repo or src/server/)
  → typed response
  → render success / error UI
```

Source of truth for UI state lives in the client. Source of truth for domain data lives behind the API. Never duplicate domain state in the browser beyond what is needed to render the current view.

## Ownership Map

| Path | Owns |
|---|---|
| `src/client/components/` | Presentational + container React components. |
| `src/client/components/ui/` | shadcn / Radix primitives. Restyled but not reauthored. |
| `src/client/stores/` or `src/client/hooks/` | UI state. TODO: pick MobX / Zustand / Context+useReducer. |
| `src/client/api/` | Typed API client. Request/response shapes imported from `src/shared/`. |
| `src/client/lib/` | Pure helpers, formatters, `cn` classname utility. |
| `src/shared/` | Cross-boundary TypeScript types and Zod schemas. |
| `vite.config.ts` | Dev server, proxy, plugins, build. |
| `tailwind.config.ts` + `src/client/tailwind.css` | Theme tokens and Tailwind directives. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup and deployment. |

## External Integrations

TODO. Document each integration the browser touches directly:
- API base URL (env-driven)
- Auth provider (TODO: OIDC / session cookie / token)
- Third-party widgets (TODO: analytics, embeds, payment)

For each: where credentials are sourced, what is safe to expose in the bundle, what stays server-side.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No backend secrets in the browser bundle.
- No direct database access from the client.
- No arbitrary SQL/query editor unless explicitly approved.
- No global mutable state outside the chosen store.
- No unbounded data fetched on mount — paginate or scope by view.
