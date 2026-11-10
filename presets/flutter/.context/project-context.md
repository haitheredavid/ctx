# Project Context

Durable architecture and ownership. Update when the shape of the app changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What product surface this app delivers, who uses it, what backend it talks to.

Default assumption baked into this preset: a Flutter app in Dart targeting iOS and Android (web optional), Riverpod for state, go_router for navigation, talking to a backend over HTTP.

## Architecture (Data Flow)

```
user interaction
  -> widget (ConsumerWidget)
  -> provider / notifier (riverpod)
  -> repository (data/)
  -> backend API (TODO)
  -> freezed model
  -> AsyncValue
  -> render loading / data / error
```

Source of truth for UI state lives in the client. Source of truth for domain data lives behind the API. Never duplicate domain state in the app beyond what is needed to render the current view.

## Ownership Map

| Path | Owns |
|---|---|
| `lib/main.dart` | Bootstrap: `WidgetsFlutterBinding`, `ProviderScope`, `runApp`. |
| `lib/app.dart` | `MaterialApp.router`: theme, router, localization wiring. |
| `lib/core/env.dart` | Compile-time env (`String.fromEnvironment`). Only file that reads it. |
| `lib/core/router.dart` | `go_router` route table and redirects. |
| `lib/core/theme.dart` | `ThemeData` + `ColorScheme.fromSeed`, light/dark. |
| `lib/features/<feature>/data/` | Repositories, HTTP calls, DTO parsing into domain models. |
| `lib/features/<feature>/domain/` | `@freezed` domain models. |
| `lib/features/<feature>/presentation/` | Widgets, screens, Riverpod notifiers. |
| `test/` | Unit + widget tests. |
| `integration_test/` | Device integration flows. |
| `android/`, `ios/`, `web/` | Platform runners: permissions, bundle ids, icons, signing config. |
| `pubspec.yaml` | Dependencies, assets, app version. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing setup, build, and release. |

## External Integrations

TODO. Document each integration the app touches directly:
- API base URL (`Env.apiBaseUrl`, from `env.json`)
- Auth provider (TODO: OIDC / session / token)
- Push, analytics, crash reporting (TODO: Firebase / Sentry)
- App store signing (TODO: where keys live; never in repo)

For each: where credentials are sourced, what is safe to compile into the app binary, what stays server-side.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions - not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No secrets in the app binary.
- No direct database access from the client.
- No global mutable state outside Riverpod.
- No unbounded data fetched on screen open - paginate or scope by view.
