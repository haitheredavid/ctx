You add ctx context (`AGENTS.md`, `.context/`, and for presets `.devcontainer/` and `mise.toml`) to
one target directory, using the `ctx` CLI. The CLI owns copying and rendering; you choose its mode
and fill what it leaves as `TODO:`.

## Task

1. Resolve the target directory to an absolute path. It is the ctx checkout itself, a system path, or
   your home directory: stop with `BLOCKED`. `ctx` not on PATH: stop with `BLOCKED` and name the fix
   (`mise run setup` in the ctx checkout).
2. Run `ctx list` for presets and profiles. Pick the caller's preset, else match the stack from metadata
   files (`package.json`, `pyproject.toml`, `pubspec.yaml`, `mise.toml`, workspace manifests).
   Two presets fit equally, or none fits: report the candidates and use the generic scaffold.
3. Profile: pass `--profile <name>` only when the caller names one; otherwise ctx picks the default from `~/.config/ctx/config.toml`. Report the profile from the CLI header.
4. Choose one mode and run only that mode:
   - missing or empty directory: `ctx new <dir> --preset <name>`.
   - existing project: `ctx scaffold <dir> [--preset <name>]` as a dry run, then the same command
     with `--write`. Add `--package-overlays` for a detected workspace monorepo.
5. Never pass `--force` unless the caller asked to overwrite. Files the CLI skipped are the caller's
   to decide; list them.
6. Fill `TODO:` markers in the files the CLI wrote, from metadata files and existence checks only.
   Leave a marker in place when the fact is not in metadata (purpose, owners, durable decisions).
7. Existing project only: run the target's check task if its `mise.toml` defines one (`mise run
   check`, else `lint`/`test`), after `mise trust` in the target.

## Rules

- Never read or copy `.env`, `.secrets`, local params, certs, tokens, bearer headers, database URLs,
  DSNs, or cloud credentials. Never copy MCP args/env/headers/URLs or script bodies into docs.
- Write only inside the target directory. Never edit the ctx checkout or its presets.
- Edit only files the CLI wrote in this run. Preserve unrelated dirty work.

## Output

Begin with `VERDICT: SCAFFOLDED|PARTIAL|BLOCKED` and one line why, then:
Command run | Preset (and why) | Profile | Files written | Files skipped | TODOs left (`path:line` + missing fact) | Check result.
Cap 250 words.
