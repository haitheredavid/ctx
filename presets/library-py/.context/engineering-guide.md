# Engineering Guide

Operational standards for working in this Python library. Read before changing code.

## Commands

Toolchain: Python 3.14 + uv, pinned in `mise.toml`. Run `mise install` once.

| Command | Scope |
|---|---|
| `mise run install` | Install/update from `uv.lock`. Creates `.venv/` if missing. (`uv sync`) |
| `mise run test` | Run full test suite. (`uv run pytest`) |
| `uv run pytest -k <expr>` | Filter by expression. |
| `uv run pytest tests/<file>` | Run one test file. |
| `mise run lint` | Lint. (`uv run ruff check .`) |
| `uv run ruff check --fix .` | Lint + autofix safe changes. |
| `mise run format` | Format. (`uv run ruff format .`) |
| `mise run typecheck` | Static type check. (`uv run ty check`) |
| `mise run check` | Lint + typecheck + test (depends on `lint`, `typecheck`, `test`). |
| `uv lock --upgrade` | Refresh `uv.lock` (intentional dep upgrade). |
| `mise run build` | Build sdist + wheel into `dist/`. (`uv build`) |
| `mise run publish` | Publish `dist/*` to PyPI (or use `uv run twine upload dist/*`). (`uv publish`) |
| `uv run twine upload --repository testpypi dist/*` | Rehearse release on TestPyPI. |

State command scope exactly. Do not say "tests pass" if `-k` filtered out coverage you needed.

## Python Standards

- `from __future__ import annotations` at the top of every module.
- Type hints on every public function, method, and module-level value. Internal helpers should be typed too unless trivially obvious.
- `ty check` strict. No implicit `Any`. Annotate generics fully (`list[int]`, not `list`).
- Prefer composition over inheritance. Inheritance is for type substitutability, not code reuse.
- No mutable default arguments. No mutable module-level state (constants are fine if truly immutable).
- Imports: stdlib, third-party, first-party - three groups, each sorted. `ruff` enforces.
- No `print()` in library code. No `logging.basicConfig()`. Modules use `logger = logging.getLogger(__name__)` and emit records - the host configures handlers and levels.
- No I/O at import time. Module top-level is type definitions, function definitions, and pure constants. Any work runs in functions the consumer calls.

## Public API & Typing

- The package `__init__.py` re-exports the contract. Every public name appears in `__all__`:

```python
from ._client import Client, ClientOptions
from ._errors import LibraryError, TimeoutError

__all__ = [
    "Client",
    "ClientOptions",
    "LibraryError",
    "TimeoutError",
]
```

- Submodules prefixed with `_` (`_client.py`, `_errors.py`) are private. Consumers who reach for them are on their own.
- `src/<pkg>/py.typed` is an empty marker file. Hatch includes it in the wheel (see Build below). Without it, `mypy`/`ty` consumers will ignore your type information.
- Breaking the public surface - removing a name, renaming, changing a signature, narrowing a return type - requires a `major` version bump and a `### Removed` / `### Changed` entry in `CHANGELOG.md`.
- Additive changes - new exports, new optional params with defaults, widened return types - require a `minor` bump and `### Added`.
- Bugfixes and internal refactors that leave the contract intact require a `patch` bump and `### Fixed`.
- Deprecations use `warnings.warn(..., DeprecationWarning, stacklevel=2)` and ship at least one `minor` release before removal. Record the removal target in `CHANGELOG.md`.

## Build (Hatchling)

Build backend: `hatchling`. Also set `requires-python` in `pyproject.toml`.

`pyproject.toml` shape:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "<pkg>"
version = "0.1.0"
description = "TODO"
requires-python = ">=3.11"
readme = "README.md"
license = { file = "LICENSE" }
dependencies = []

[project.optional-dependencies]
# TODO: optional feature extras, e.g. cli = ["click>=8"]

[project.scripts]
# TODO (optional): "<bin-name>" = "<pkg>.cli:main"

[tool.hatch.build.targets.wheel]
packages = ["src/<pkg>"]

[tool.hatch.build.targets.wheel.shared-data]
# py.typed travels with the package directory, no extra config needed.
```

- Version lives in `pyproject.toml` only. Do not duplicate it in `__init__.py` - read it with `importlib.metadata.version("<pkg>")` if a consumer needs it.
- Confirm the built wheel includes `py.typed`: `uv run python -m zipfile -l dist/<pkg>-X.Y.Z-py3-none-any.whl | grep py.typed`. Missing marker is a packaging bug.
- Confirm the sdist contains only what is needed: `tar tzf dist/<pkg>-X.Y.Z.tar.gz`. Anything else leaking in (`.venv/`, `tests/` if not desired, secrets) is a packaging bug.

## Tests

- Pytest under `tests/`, mirroring `src/<pkg>/` paths.
- Fixtures in `conftest.py`. No global state - every fixture is explicit per-test.
- `tmp_path` for filesystem. **No `monkeypatch.setenv` in library tests** - libraries do not read env, so tests should not need to set it. If a test wants it, you have built env-reading into a layer that should take options instead.
- **Do not `unittest.mock.patch` first-party modules.** If a test feels like it needs that, the code under test is missing a seam - pass the dependency in instead.
- Third-party SDKs may be patched at their import site, but prefer a thin adapter you can replace with a fake.
- Reset module-level singletons (if any) in fixture teardown. Better: do not have module-level singletons.

## CLI (Optional)

Delete this section if `[project.scripts]` is not set.

- `src/<pkg>/cli.py` is the entry. `[project.scripts] <bin-name> = "<pkg>.cli:main"` wires it.
- The CLI is a thin wrapper: parse argv -> call into the library -> print result -> set exit code. No business logic in the CLI itself.
- Argv parsing: TODO (`argparse` stdlib / `click` / `typer`). `argparse` is zero-dep and the default; `typer`/`click` are nicer for subcommands.
- `cli.py` is the only module that calls `sys.exit`. Internal functions return values or raise - they never exit.
- Exit codes: `0` success; non-zero on error. Document each non-zero code in `README.md`.
- Streams: results to **stdout**, diagnostics and errors to **stderr**. Use `print(..., file=sys.stderr)` or a stderr logger handler set up at CLI startup only.
- Tests: invoke the underlying library functions directly. Reserve subprocess tests for argv parsing and exit-code wiring.

## Releases

Workflow per release:

1. Confirm `## [Unreleased]` in `CHANGELOG.md` has the user-facing entries for everything since the last tag.
2. Bump `version` in `pyproject.toml` per semver (see "Public API & Typing").
3. Move the `## [Unreleased]` block under a new `## [X.Y.Z] - YYYY-MM-DD` heading in `CHANGELOG.md` and add a fresh empty `## [Unreleased]` on top.
4. Commit: `chore(release): vX.Y.Z`. Tag: `git tag vX.Y.Z`.
5. Clean `dist/`: `rm -rf dist/`.
6. Build: `uv build`.
7. Rehearse on TestPyPI: `uv run twine upload --repository testpypi dist/*`. Install from there into a scratch venv and import the package to confirm.
8. Publish: `uv publish` (or `uv run twine upload dist/*`).
9. Push tag: `git push origin main --tags`.

Rules:

- Pre-1.0 (`0.x.y`): minor = breaking. Treat minor bumps as the breaking-change channel until you cut 1.0.
- Yanking is forbidden - release a patch that fixes or reverts instead. (PyPI's "yank" is for emergency only.)
- A release never edits code beyond the version bump and CHANGELOG header reshuffle. Everything else lands in normal PRs.

## Search Scope

When grepping, finding, or reading within the repo, exclude dependency, cache, and build output. They pollute results, slow `find`, and hold no source-of-truth content.

- `.venv/`, `venv/`
- `__pycache__/`
- `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.tox/`
- `dist/`, `build/`
- `*.egg-info/`
- `.coverage`, `htmlcov/`

Examples (the `rg -g` globs are only needed when running outside the repo's `.gitignore` scope, e.g. with `--no-ignore`):

```bash
rg --hidden -g '!{.venv,venv,__pycache__,.pytest_cache,.ruff_cache,.mypy_cache,dist,build,*.egg-info}/**' '<pattern>'
find . -type d \( -name .venv -o -name venv -o -name __pycache__ -o -name .pytest_cache -o -name dist -o -name build \) -prune -o -type f -print
```

Metadata reads inside excluded dirs are fine when the file itself is the source of truth (e.g. `uv.lock`).

## Settings (Libraries Do Not Read Env)

Libraries do not read `os.environ` or any other ambient configuration source. The host application owns env.

If your library needs configuration, accept it explicitly:

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class ClientOptions:
    api_url: str
    timeout_s: float = 30.0

def create_client(options: ClientOptions) -> Client: ...
```

Rules:

- No `os.environ.get(...)` in `src/<pkg>/`. CLI (`src/<pkg>/cli.py`) is the documented exception - but it parses env once, hands typed values to the library, and never lets ambient env reach internal modules.
- Tests construct option objects directly. They do not `monkeypatch.setenv`.
- Document defaults at the call site (in the option type's docstring and in `README.md`), not via runtime env lookups.

## Safety: Do Not Read

- `.env`, `.env.*` (except `.env.example`)
- `.secrets/`, `secrets.toml`, `.envrc`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- Cloud credential files (`~/.aws/credentials`, service account JSON)
- `~/.pypirc` containing PyPI tokens
- Local DSNs, connection strings, bearer headers checked in by accident
- Tokens, API keys, session cookies pasted into commits
- Provider response payloads that contain user data

Metadata reads are fine: `pyproject.toml`, `uv.lock`, `pytest.ini`, `tox.ini`, `ruff.toml`, and public config files.

Use `.env.example` only for variable names (rare for libraries). Preserve unrelated dirty work - never revert files you did not intentionally change.

## Commits

- **One concern per commit.** Do not bundle a refactor with a feature with a dep bump.
- **Subject <= 72 chars, imperative mood.** Conventional prefix when useful (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- **Body explains *why*, not *what*.** The diff shows what.
- **Every user-facing change updates `## [Unreleased]` in `CHANGELOG.md` in the same commit.** PR review checks for it.
- **Lockfile updates commit with the source change that triggered them.** `uv.lock` rides with the `pyproject.toml` edit.
- **Never commit secrets.** Real tokens, DSNs, bearer headers, PyPI tokens. `.env.example` is for variable names only.
- **Preserve unrelated dirty work.** Never restage or revert files you did not intentionally touch.

## Local Agent Scratch

Agents drop transient working files at repo root while in the middle of a task: `PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`. These reflect one session's in-flight reasoning. They are not durable design docs and should not enter git.

Add to `.gitignore`:

```
PLAN.md
TODO.md
NOTES.md
SCRATCH.md
```

- `AGENTS.md` is **durable** and stays committed. It is the canonical entrypoint, not scratch - do not add it to `.gitignore`.
- Durable architecture, decisions, and short-lived focus notes belong in `.context/` (committed). Scratch belongs at root (ignored).
- A plan worth keeping graduates into a dated design doc under `.context/active/` (see `.context/README.md`) or into the PR description before the scratch file is discarded. Do not park it in a root scratch file.

## Context Maintenance

- Keep `AGENTS.md` compact. Push detail into these files.
- Update `Commands` when `pyproject.toml` scripts change.
- Update `.context/project-context.md` when the public surface or build shape shifts.
- Record durable decisions (supported Python minors, async stance, optional extras, CLI choice) in `.context/project-context.md`.
- In-flight specs, DDs, and TDDs live in `.context/active/`; see `.context/writing-specs.md#lifecycle` for naming and lifecycle.
