# .context Conventions

This folder holds agent-facing context. Durable docs never describe development progress - no roadmaps, feature status, "current state" snapshots, or deferred-work lists.

## Entrypoint

- `project-context.md` - what this repo is, architecture, durable decisions, non-goals. Start here; it links out to the docs below.

## Guides (`guides/`)

Prescriptive standards and workflows - "how to work here". Change when a convention or process changes.

- `guides/engineering.md` - commands, code style, testing patterns, safety rules.
- `guides/writing-briefs.md` - the brief -> design -> spec flow and how to write a brief.
- `guides/writing-designs.md` - how to write a design that splits a brief into specs.
- `guides/writing-specs.md` - how to write a spec for one shippable unit; shared language rules.
- `guides/doc-lifecycle.md` - where briefs, designs, specs, and other in-flight docs are drafted, reviewed, and closed.
- `guides/pull-requests.md` - PR branch, title, body, size, linear vs. stacked.
- `guides/context-maintenance.md` - altitude rule, protected paths, context PR procedure.

Any other file in `guides/` comes from the team profile; its first heading says what it covers.

## Repo reference (`reference/`)

Descriptive facts about this codebase - "what exists". Create it when `project-context.md` outgrows a table (ownership map, libraries, integrations). Change it when the shape of the repo changes.

## Archive (`archive/`)

Frozen point-in-time docs. Agents never read them unless the user names a file. Nothing is added or edited.

## In-flight docs

Briefs, designs, specs, plans, and findings never live in guides or reference. Where they live and when they go away: `guides/doc-lifecycle.md`.

## Changing these files

Protected paths (`AGENTS.md`, this file, `project-context.md`, `guides/`, `reference/`) change per `guides/context-maintenance.md`.
