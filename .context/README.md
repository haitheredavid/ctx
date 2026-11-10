# .context Conventions

Folder holds agent-facing context. Two file kinds, different lifecycles. Don't mix.

## Guides (this folder's root)

Durable repo reference: tooling, commands, architecture, conventions, repo workflows.

- Guides never describe dev progress. No roadmaps, feature status, "current state" snapshots, deferred-work lists.
- Guide needs to mention in-flight work → put it in active doc instead.
- Durable decisions (the "why" behind architecture/tooling choice) live in `project-context.md`, not separate progress log.

Current guides:

- `project-context.md` - product purpose, architecture, ownership, durable decisions.
- `engineering-guide.md` - commands, code style, testing patterns, safety rules, integration caveats.
- `writing-specs.md` - how to write a spec (what and why) and the spec -> DD -> TDD flow.
- `writing-dds.md` - how to write a design document (DD) that splits work into TDDs.
- `writing-tdds.md` - how to write a Technical Design Document (TDD) for one shippable unit.

## Active docs (`active/`)

Ephemeral implementation docs: specs, design docs (DDs), TDDs, migration plans, findings.

- Naming + lifecycle: `writing-specs.md#lifecycle`.
- Old date = signal to delete or re-validate doc, never trust it.

## Not the same as root scratch

`active/` docs = committed, human-reviewed design docs. Distinct from transient root scratch files (`PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`) described under "Local Agent Scratch" in `engineering-guide.md` — those are one-session, gitignored, never durable. Don't conflate.

## Rule markers

Hard rules in root `AGENTS.md` and `.context/engineering-guide.md` use `MUST` / `MUST NOT` and end with a marker naming what enforces them:

- `[check: <repo path>, ...]` - test or config that fails when the rule breaks.
- `[check: manual]` - reviewer-enforced; candidate for a test.

Soft guidance stays plain prose, no level, no marker. `test/own-docs.test.ts` fails on a `MUST` bullet without a marker, or a marker path that does not exist.
