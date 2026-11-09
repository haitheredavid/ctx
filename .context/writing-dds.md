# Writing Design Documents (DDs)

DD takes one accepted spec (merged after passing Gate 1), decides direction, components, data movement; splits work into TDDs.
File name and lifecycle: [writing-specs.md#lifecycle](writing-specs.md#lifecycle).

## Language

Follow [writing-tdds.md#language](writing-tdds.md#language).
One deviation: short rationale paragraphs OK.

## Structure

Sections, in order. Hard cap: ~250 lines.

1. **Summary** - 2-4 sentences.
   Link spec, list goal IDs served.
   Never restate goals.
2. **Glossary** - one line per term.
   TDDs copy entries verbatim.
3. **Current state** - ASCII diagram, or `None.`
4. **Target state** - container-level ASCII diagram, one sentence per component.
5. **Data flow** - one short subsection per scenario: trigger, path, storage, refresh.
   Don't restate component responsibilities.
6. **Decisions** - per decision: options considered (one line each), choice, why in <= 2 sentences.
   Cross-cutting decisions go here.
   Decisions outliving project also go to `## Durable Decisions` of `.context/project-context.md`.
7. **Work breakdown** - one row per TDD:

   | TDD | Scope | Goal IDs | Depends on | Status |
   |---|---|---|---|---|

   Each row passes [TDD sizing gate](writing-tdds.md#sizing-gate).
   Status is `planned`, `active`, or `done`. The PR that completes a TDD sets its row to `done`; the row keeps the TDD title after the file is deleted.
8. **Risks and open questions** - one line each, with owner.
   Items blocking a TDD: mark `blocks <TDD>`.

## What a DD leaves out

- Function signatures.
- Full schemas.
- Per-unit acceptance criteria.
- File pointers.

These belong in TDDs.

## Editing pass

Cut any sentence TDD author wouldn't need to stay consistent with sibling TDDs.
Every non-optional `G` in the spec appears in at least one work-breakdown row.
