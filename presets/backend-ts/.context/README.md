# .context Conventions

This folder holds agent-facing context. It contains two kinds of files with different lifecycles. Do not mix them.

## Guides (this folder's root)

Durable reference for working in the repo: tooling, commands, architecture, conventions, and repo workflows.

- Guides never describe development progress. No roadmaps, feature status, "current state" snapshots, or deferred-work lists.
- If a guide needs to mention in-flight work, that content belongs in an active doc instead.
- Durable decisions — the "why" behind an architecture or tooling choice — live in `project-context.md`, not in a separate progress log.

Current guides:

- `project-context.md` - product purpose, architecture, ownership, durable decisions.
- `engineering-guide.md` - commands, code style, testing patterns, safety rules, integration caveats.
- `writing-tdds.md` - how to write a Technical Design Document for this repo.

## Active docs (`active/`)

Ephemeral implementation documents: TDDs, design docs, migration plans, findings.

- File name format: `YYYYMMDD-<doc-title>.md`. The date is the day the doc was created.
- An active doc lives only as long as its implementation. The PR that completes the work deletes the doc. Never leave a finished doc behind.
- An old date is a signal to delete or re-validate the doc, never to trust it.

## Not the same as root scratch

`active/` docs are committed, human-reviewed design docs. They are distinct from the transient root scratch files (`PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`) described under "Local Agent Scratch" in `engineering-guide.md` — those are one-session, gitignored, and never durable. Do not conflate the two.
