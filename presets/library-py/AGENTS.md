# AGENTS.md

Canonical agent entry for this repo. Compact and operational. Deeper durable context lives in `.context/`.

## Project Context

- [.context/project-context.md](.context/project-context.md) - what this library is, public surface, ownership map, integrations, durable decisions.
- [.context/guides/engineering.md](.context/guides/engineering.md) - commands, Python standards, build, tests, release flow, safety.
- [.context/guides/writing-briefs.md](.context/guides/writing-briefs.md) - the brief -> design -> spec flow and how to write a brief.
- [.context/guides/writing-designs.md](.context/guides/writing-designs.md) - how to write a design that splits a brief into specs.
- [.context/guides/writing-specs.md](.context/guides/writing-specs.md) - how to write a spec for one shippable unit; shared language rules.
- [.context/guides/doc-lifecycle.md](.context/guides/doc-lifecycle.md) - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- [.context/guides/pull-requests.md](.context/guides/pull-requests.md) - PR branch, title, body, size, linear vs. stacked.
- [.context/guides/context-maintenance.md](.context/guides/context-maintenance.md) - altitude rule, protected paths, context PR procedure.
- [.context/README.md](.context/README.md) - `.context/` layout: guides, reference, archive; other files in `guides/` come from the team profile.

## Stack

Published Python library. `uv` for environment and dependencies, `ruff` for lint/format, `ty` for strict static type checking, `pytest` for tests. `hatchling` as the build backend (PEP 517). `py.typed` marker shipped so consumers get types. Optional CLI surface via `[project.scripts]` (delete that section if not a CLI / dev tool).

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

```
mise run install                    # uv sync - install/update from uv.lock
mise run test                       # uv run pytest - tests
mise run lint                       # uv run ruff check . - lint
mise run format                     # uv run ruff format . - format
mise run typecheck                  # uv run ty check - static type check
mise run build                      # uv build - build sdist + wheel into dist/
mise run publish                    # uv publish - publish dist/* (or: uv run twine upload dist/*)
mise run check                      # lint + typecheck + test
uv run pytest -k <expr>             # filtered tests
```

Cite exact command scope. Do not claim a command runs every test unless `pyproject.toml` proves it.

## Standards

- Python TODO: minimum version (e.g., 3.11+). Pin in `pyproject.toml` `requires-python`.
- `from __future__ import annotations` at the top of every module. Type hints on every public function, method, and module-level value.
- `ty check` strict. No implicit `Any`. Annotate generics fully (`list[int]`, not `list`).
- **Public surface** is whatever the package `__init__.py` re-exports plus a module-level `__all__`. Anything not listed is private - submodule paths (`<pkg>._internal`) are not part of the contract.
- `py.typed` marker file present at `src/<pkg>/py.typed`. Wheel includes it so `ty`/`mypy` on the consumer side picks up your types.
- No `os.environ` reads, no I/O at import, no module-level mutable state. The host application owns env and lifecycle.
- No logger configuration. Modules use `logging.getLogger(__name__)`; never call `logging.basicConfig()` or attach handlers.
- Internal value objects: `@dataclass(frozen=True, slots=True)`. External boundaries (third-party JSON, user input, optional pydantic interop): isolate to one adapter module.

## Safety

Do not read `.env`, `.secrets`, certs, tokens, DSNs, cloud credentials. Do not commit `~/.pypirc` containing PyPI tokens. Full list in `.context/guides/engineering.md`. Use `.env.example` for variable names only (rare for libraries).

Search scope, "no settings" rule, and commit/changelog style live in [`.context/guides/engineering.md`](.context/guides/engineering.md).

## MCP Servers

- TODO: list MCP servers agents may use (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`).

## Skills

- TODO: list agent skills (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`).

## Where To Edit

| File | Owns |
|---|---|
| `pyproject.toml` | Package metadata, deps, `[build-system]` (hatchling), `[project.scripts]`, tool config (ruff, ty, pytest). |
| `mise.toml` | Toolchain pins and task entrypoints. Commands in this file map 1:1 to its tasks. |
| `uv.lock` | Resolved dev lockfile. Do not hand-edit. |
| `src/<pkg>/__init__.py` | Public surface. Re-exports + `__all__`. |
| `src/<pkg>/py.typed` | Empty marker file. Must be shipped in the wheel. |
| `src/<pkg>/*.py` | Internal modules. Importable inside the package; not contract. |
| `src/<pkg>/cli.py` | (Optional) CLI entry. Only module that may call `sys.exit`. |
| `tests/` | Pytest suite. Mirrors `src/<pkg>/`. |
| `CHANGELOG.md` | Hand-maintained, Keep-a-Changelog format. Entry per user-facing change. |
| `.context/` | Durable architecture, decisions, debt. |
| `AGENTS.md` | This file. Keep compact; push detail into `.context/`. |

## Maintenance

Update commands here when `pyproject.toml` scripts change. Update `.context/project-context.md` when the public surface changes shape. Record durable decisions (supported Python minors, async stance, optional extras, CLI choice) in `.context/project-context.md`. Every user-facing change ships a `CHANGELOG.md` entry under `## [Unreleased]`.
