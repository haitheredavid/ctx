# Writing Designs

A design takes one accepted brief (accepted after passing [Gate 1](writing-briefs.md#gate-1-brief-to-design)), decides direction, components, and data movement, and splits the work into specs.
A brief has 1-3 designs; see [Splitting a brief](#splitting-a-brief).
For drafts, review, and closure, see [doc-lifecycle.md](doc-lifecycle.md).

## Language

Follow [writing-specs.md#language](writing-specs.md#language).
One deviation: short rationale paragraphs are allowed.

## Splitting a brief

- Write one design unless the work splits into parts whose decisions do not affect each other.
- Give a part its own design only when its boundary to the other parts is a small interface.
- If a decision in one part would change a decision in another, keep both parts in one design.
- More than 3 designs means the brief is too big; split the brief instead.
- Competing approaches are options under Decisions, never separate designs.
- Each shared interface or term has exactly one owning design.
  The owner defines it in its Decisions and Glossary; other designs link to the owner and copy glossary entries verbatim.
- Every non-optional `G` and every `F` in the brief belongs to exactly one design.
- The brief's approver checks this coverage when accepting the last design; no spec starts before then.

## Structure

Use these sections, in order. Hard cap: ~250 lines.

1. **Summary** - 2-4 sentences.
   Link the brief and list the goal and follow-up IDs this design owns.
   Never restate goals.
2. **Glossary** - one line per term.
   Specs copy entries verbatim.
   For a term owned by another design, copy its entry verbatim and link the owner.
3. **Current state** - ASCII diagram, or `None.`
4. **Target state** - container-level ASCII diagram, one sentence per component.
5. **Data flow** - one short subsection per scenario: trigger, path, storage, refresh.
   Do not restate component responsibilities.
6. **Decisions** - per decision: options considered (one line each), the choice, and why in <= 2 sentences.
   Include cross-cutting decisions here.
   Answer each owned follow-up affecting a spec here, citing its `F` ID, before that spec is accepted or implemented.
   Answer all remaining follow-ups before the brief closes.
   Decisions that outlive the project also go to the durable-decision home named in [doc-lifecycle.md](doc-lifecycle.md#lifecycle) before the brief closes.
7. **Work breakdown** - one row per spec:

   | Spec | Scope | Goal IDs | Depends on |
   |---|---|---|---|

   Each row passes the [spec sizing gate](writing-specs.md#sizing-gate).
   Name each row `<n>.<row>: <title>`, where `<n>` is this design's number; the spec draft is `spec-<n>.<row>-<slug>.md`.
   `Depends on` can name specs of other designs under the same brief, as `<n>.<row>`.
   The table has no status column; [doc-lifecycle.md](doc-lifecycle.md#lifecycle) defines how progress shows.
   Splits and cancellations are amendments ([doc-lifecycle.md](doc-lifecycle.md#review-and-acceptance)); never reuse a row ID.
8. **Risks and open questions** - one line each, with owner.
   Mark items that block a spec `blocks <n>.<row>`.
   During drafting, list each unanswered owned follow-up here, cited by `F` ID.
   At design acceptance, list unresolved brief `can wait` questions here.
   Resolve them before affected implementation, or transfer remaining non-blocking questions to owned linked issues before the brief closes.

## What a design leaves out

- Function signatures.
- Full schemas.
- Per-unit acceptance criteria.
- File pointers.

These belong in the specs.

## Editing pass

Cut any sentence a spec author would not need to stay consistent with sibling specs.
Every non-optional `G` this design owns appears in at least one work-breakdown row.
Every `F` this design owns appears in Decisions or in Risks and open questions.
