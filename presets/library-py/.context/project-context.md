# Project Context

Durable architecture and ownership. Update when the public surface or build/distribution model changes, not on every commit.

## What This Repo Is

TODO: one-paragraph description. What this library does, who imports it, what surface it exposes (functions, classes, type aliases, CLI binary).

Default assumption baked into this preset: a published Python library. Importable as `import <pkg>` or `from <pkg> import <name>`. No service entry point, no runtime process, no env reads. Consumers compose this library into their own runtime.

If `[project.scripts]` is set in `pyproject.toml`, this repo also ships a developer CLI built from `src/<pkg>/cli.py`. The CLI section in `.context/engineering-guide.md` covers the rules; delete it if not applicable.

## Architecture (Data Flow)

```
src/<pkg>/<feature>.py (internals)
  → src/<pkg>/__init__.py  (re-exports + __all__ = public surface)
  → uv build               → dist/<pkg>-X.Y.Z.tar.gz + .whl  (includes py.typed)
  → PyPI                   → consumer `from <pkg> import ...`
```

Optional CLI flow (delete if not a CLI):

```
argv
  → console_script entry → src/<pkg>/cli.py:main
  → cli.py owns argv parsing and is the only module that calls sys.exit
  → calls into the same internals as the library API
  → exit code (0 success, non-zero on error); stderr for errors, stdout for output
```

Source of truth for the consumer contract: the package `__init__.py` plus each module's `__all__`. Anything reachable only through submodule paths (`<pkg>._internal`) is private and may change without a major bump.

## Ownership Map

| Path | Owns |
|---|---|
| `pyproject.toml` | Package metadata, deps, `[build-system]`, `[project.scripts]`, tool config. |
| `uv.lock` | Resolved dev lockfile. |
| `src/<pkg>/__init__.py` | Public surface. Re-exports + `__all__`. |
| `src/<pkg>/py.typed` | Empty marker; tells consumer type checkers we ship types. |
| `src/<pkg>/<domain>.py` or `src/<pkg>/<domain>/` | Internal modules implementing the library. |
| `src/<pkg>/cli.py` | (Optional) CLI entry. Only module allowed to call `sys.exit`. |
| `tests/` | Pytest suite. Mirrors `src/<pkg>/`. |
| `tests/conftest.py` | Shared fixtures. No global mutable state. |
| `dist/` | Generated `uv build` output. Gitignored. |
| `CHANGELOG.md` | Hand-maintained Keep-a-Changelog. Public contract history. |
| `.context/` | Agent-readable durable context. |
| `README.md` | Human-facing install, supported Python versions, example usage. |

## External Integrations

Most libraries have none. Keep this section only if you wrap a third-party SDK or hit a specific runtime API.

- TODO: third-party SDK wrapped (auth scope, version constraint, retry posture).
- TODO: optional extras declared (`pyproject.toml [project.optional-dependencies]`) and what they enable.

For each: where the dependency comes from, what surface area is exposed, and what changes when the underlying API breaks.

## Durable Decisions

Architecture and tooling choices worth keeping, stated as decisions — not status or progress. In-flight work and known gaps live in `.context/active/` docs, issues, or PRs, never here.

- TODO: A decision this repo has committed to, and the one-line reason it holds.

## Non-Goals

- No `os.environ` reads in library code.
- No `logging.basicConfig` calls or attached handlers. Modules get a logger via `logging.getLogger(__name__)` and let the host configure.
- No module-level I/O. Reading files / opening sockets at import time is forbidden.
- No mutable module-level state shared across calls (constants and truly immutable singletons are fine).
- No `Any` in public function signatures or return types. Internal `Any` only at one adapter boundary with a comment.
- No `unittest.mock.patch` against first-party modules — fix the seam instead.
- No global database / HTTP clients constructed at import. Consumers build, pass in.
