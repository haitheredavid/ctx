# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this app is, architecture, ownership map, integrations, durable decisions.
- [.context/engineering-guide.md](.context/engineering-guide.md) - commands, Dart/Flutter standards, testing, safety.
- [.context/writing-specs.md](.context/writing-specs.md) - how to write a spec (what and why) and the spec -> DD -> TDD flow.
- [.context/writing-dds.md](.context/writing-dds.md) - how to write a design document (DD) that splits work into TDDs.
- [.context/writing-tdds.md](.context/writing-tdds.md) - how to write a Technical Design Document (TDD) for one shippable unit.
- [.context/README.md](.context/README.md) - `.context/` conventions: durable guides vs. ephemeral `active/` specs, DDs, and TDDs (naming and lifecycle in `.context/writing-specs.md#lifecycle`).

## Stack

Flutter + Dart app targeting iOS and Android (web optional). State: Riverpod with `riverpod_generator` (`@riverpod`). Routing: `go_router`. Models + JSON: `freezed` + `json_serializable` via `build_runner`. Lints: `flutter_lints` plus strict analyzer modes. Tests: `flutter test` + `mocktail`; `integration_test` for device flows. TODO: target platforms actually shipped (iOS / Android / web).

## Commands

Toolchain: Flutter 3.47 (bundles Dart), pinned in `mise.toml`. Run `mise install` once. Copy `env.example.json` to `env.json` before `mise run dev`.

```
mise run install           # flutter pub get
mise run codegen           # dart run build_runner build: freezed, json_serializable, riverpod_generator
mise run codegen:watch     # dart run build_runner watch: codegen in watch mode
mise run dev               # flutter run with hot reload (env from env.json)
mise run format            # dart format . (writes)
mise run format:check      # dart format, fail on diff
mise run analyze           # flutter analyze: static types + lints (runs codegen first)
mise run test              # flutter test: unit + widget tests (runs codegen first)
mise run test:integration  # flutter test integration_test: needs a device or emulator
mise run build:android     # flutter build appbundle to build/app/outputs/
mise run build:ios         # flutter build ipa to build/ios/ipa/ (macOS + Xcode only)
mise run build:web         # flutter build web to build/web/
mise run check             # format:check + analyze + test
```

`flutter analyze` is the type checker; there is no separate typecheck. Cite exact scope: `mise run test` does not run `integration_test/`.

## Standards

- Sound null safety. No `dynamic` except at JSON/platform-channel boundaries; isolate and comment. No `!` without a guarding comment.
- Layout: `lib/main.dart` (bootstrap, `ProviderScope`), `lib/app.dart` (`MaterialApp.router`), `lib/core/` (env, router, theme), `lib/features/<feature>/{data,domain,presentation}/`. **`presentation` never imports `data` directly** - it goes through providers.
- Every async surface renders loading / data / error via `AsyncValue.when`. Never swallow errors.
- Models are `@freezed` immutable classes; JSON via `json_serializable`. Never hand-edit `*.g.dart` / `*.freezed.dart`.
- Only `lib/core/env.dart` calls `String.fromEnvironment`. Values are compiled into the binary, so never secrets.
- `const` constructors wherever possible. Widgets small and composed; no business logic in `build()`.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials, signing keys, keystores, `google-services.json`, `GoogleService-Info.plist`, `env.json`. Full list in `.context/engineering-guide.md`. Use `env.example.json` for variable names only.

Search scope, settings discipline, and commit style live in [`.context/engineering-guide.md`](.context/engineering-guide.md).

## MCP Servers

- TODO: list MCP servers agents may use (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`).

## Skills

- TODO: list agent skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`).

## Where To Edit

| File | Owns |
|---|---|
| `lib/features/` | Feature code: `data/` (repositories), `domain/` (freezed models), `presentation/` (widgets, screens, notifiers). |
| `lib/core/` | Cross-feature code: env, router, theme, shared widgets. |
| `lib/main.dart` + `lib/app.dart` | Bootstrap, `ProviderScope`, `MaterialApp.router`. |
| `pubspec.yaml` | Dependencies, assets, app version (`x.y.z+build`). |
| `analysis_options.yaml` | Analyzer modes and lint rules. |
| `android/` + `ios/` + `web/` | Platform runners. Touch only for platform config (permissions, bundle ids, icons). |
| `test/` + `integration_test/` | Unit + widget tests; device integration flows. |
| `.context/` | Durable architecture, decisions, debt. Update when shape changes. |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `mise.toml` tasks or `pubspec.yaml` dependencies change. Update `.context/` when architecture, integrations, or durable decisions shift. Track in-flight work in a dated `.context/active/` doc; delete it when the work lands.
