# Doc Lifecycle

Where briefs, designs, specs, and other in-flight docs live in this repo, and when they go away.
Profile: `local` - docs are committed files under `.context/active/`, reviewed in PRs, deleted when the work lands.

## Drafts

| Stage | File | Guide |
|---|---|---|
| Brief | `.context/active/YYYYMMDD-<slug>/brief.md` | [writing-briefs.md](writing-briefs.md) |
| Design | `.context/active/YYYYMMDD-<slug>/design-<n>-<slug>.md` | [writing-designs.md](writing-designs.md) |
| Spec | `.context/active/YYYYMMDD-<slug>/spec-<n>.<row>-<slug>.md` | [writing-specs.md](writing-specs.md) |

- Each brief gets one folder, `.context/active/YYYYMMDD-<slug>/`, dated the day the brief is created.
- The folder holds `brief.md` and every design and spec that serves it.
- Designs are numbered 1, 2, 3 in creation order; numbers are never reused.
- `<row>` is the spec's row in its design's work breakdown. A spec written without a design is `spec-0.1-<slug>.md`.
- Slugs are lowercase words joined by hyphens.

## Review and acceptance

- A doc is accepted when the PR that adds it merges after review by the brief's approver.
- The approver accepts a brief only when it passes [Gate 1](writing-briefs.md#gate-1-brief-to-design).
- After acceptance, change a doc only in a PR whose description starts with `Amendment:`. The amendment takes effect when the approver approves that PR.
- A material amendment repeats the affected gates before dependent implementation continues.
- Implementation PR footer: `**Spec:** .context/active/<folder>/spec-<id>-<slug>.md`, plus the tracker issue when one exists.

## Lifecycle

- The PR that completes a spec deletes that spec file. A work-breakdown row whose spec file is gone is done.
- The PR that completes the last spec under a brief also deletes the brief, its designs, and the folder.
- That PR description records the result of each goal check (`G1: pass (4.2 s)`); write `pending: <how and when measured>` for checks that need production data.
- The durable-decision home is the `## Durable Decisions` section of `.context/project-context.md`. Before any delete, move still-current decisions there.
- To cancel work, record the rationale in the PR description and delete the folder.
- To split a spec, amend the design: mark the original row `cancelled`, add rows with new unused row IDs, and update dependencies. Designless work needing a split first adds a design.
- Never leave a finished doc behind.

## Other docs

- Migration plans and findings: `.context/active/YYYYMMDD-<slug>.md`. The PR that lands the work deletes them.
- An old date is a signal to delete or re-validate a doc, never to trust it.
- Progress and status live in PR descriptions, never in docs.
- Root scratch files (`PLAN.md`, `TODO.md`, `NOTES.md`, `SCRATCH.md`) are one-session and gitignored. A plan worth keeping graduates into an active doc or a PR description.

## Retrieval

- An accepted doc in `.context/active/` is authoritative while it exists.
- Deleted docs are history in git log, not current instructions. Never restore one to follow it.

## Agents

- Read the open chain before implementing: brief, design when present, and spec.
- Create drafts only when asked.
- Never edit an accepted doc outside an amendment PR.
