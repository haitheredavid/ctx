# Writing Briefs

A brief states what problem to solve, for whom, and how to tell it is solved.
It is the default first document in the brief -> design -> spec flow and says nothing about how to build the solution.
Its goals carry follow-ups: the questions a design must answer.

## The flow

```text
brief --gate 1--> design (1-3) --gate 2--> spec (n per design) --ship--> durable decisions
```

| Stage | Answers | Written for | Guide |
|---|---|---|---|
| Brief | What and why | Stakeholders, approver | this file |
| Design | Direction, components, split into specs | Spec authors | [writing-designs.md](writing-designs.md) |
| Spec | Contracts for one shippable unit | Reviewer, coding agent | [writing-specs.md](writing-specs.md) |

Draft files, review, and closure: [doc-lifecycle.md](doc-lifecycle.md).

## Choose an entry point

The brief is the default entry point.
Write one when the problem, the outcome, or the scope is unclear.
When the author already knows the scope, the author can start lower:

| Start at | When | Goals live in |
|---|---|---|
| Brief | Scope unclear | The brief |
| Design | Scope known; the work needs 2+ specs | The design's [Intent block](#intent-block) |
| Spec | Scope known; the work passes the [spec sizing gate](writing-specs.md#sizing-gate) | The spec's [Intent block](#intent-block) |

- The author picks the entry point.
- The approver can send a design or spec back to a brief when its scope is unclear.
- A design that starts the work is the only design for that work. If the work needs a second design, stop and write a brief.

## Intent block

A design or spec that starts the work opens with this section, before its first section.
Hard cap: ~10 lines, bullets only.

```
## Intent
- <problem>
- <outcome>
- Approver: <one person>
- G1: <outcome with a finite check>
- Non-goals: <scope left out, or `None.`>
```

- Goals follow the brief rules: ID, finite check, `(optional)` mark.
- An Intent block has no follow-ups; the doc answers its own questions in Decisions or Requirements.
- The approver accepts the doc only when the Intent block holds a problem, an outcome, exactly one approver, at least one goal with a finite check, and non-goals or `None.`

## Skip the design

Small work goes brief -> one spec, with no design.
Skip the design only if the work passes the [spec sizing gate](writing-specs.md#sizing-gate).
The spec is `spec-0.1-<slug>.md`.
Resolve brief `can wait` questions and answer every follow-up in the spec's Requirements before implementation.
If you find a second spec, stop and write a design.

## Scope

A brief states the problem and the outcome only.
It names no components, tools, or data layouts, except fixed constraints.
Follow-ups name what a design must decide, never the answer.

## Language

Follow [writing-specs.md#language](writing-specs.md#language).
One deviation: a brief is bullets only, with no prose paragraphs.

## Structure

Use these sections, in order. Hard cap: ~40 lines.

1. **Idea** - the problem and the outcome in 1-2 bullets, then three fields:
   `Who:` the people who need this.
   `Baseline:` how they work, what fails, and the baseline as a number or `unknown`.
   `Approver:` exactly one person.
   Link notes; never paste them.
2. **Goals** - numbered `G1`, `G2`, ...
   Each goal has a finite check.
   Mark optional goals `(optional)`.
   The outcome is verified when every non-optional check passes.
   - Bad: `G1: Reports are faster.`
   - Good: `G1: The weekly report renders in < 5 s for the largest project (baseline: 40 s).`

   Nest follow-ups under the goal they serve, as `F1 (design): <question>`.
   Number follow-ups across the whole brief.
   Each follow-up is one question a design must answer; a goal can have none.
3. **Non-goals** - scope this work will not address.
4. **Constraints** - each applicable item, for example source systems, access, deadlines, data freshness, sensitivity.
   Write `None.` if nothing applies.
5. **Open questions** - unknowns about the what or the why, one line each, with owner and tag `blocks gate 1` or `can wait`.
   Close every `can wait` question before the last design is accepted, or list it under a design's risks.

Skeleton:

```
# <Title>

## Idea
- <problem>
- <outcome>
- Who: <people who need this>
- Baseline: <current workflow, what fails, baseline or `unknown`>
- Approver: <one person>

## Goals
- G1: <outcome with a finite check>
  - F1 (design): <question a design must answer>
- G2 (optional): <outcome with a finite check>

## Non-goals
- <scope left out>

## Constraints
- <fixed constraint>

## Open questions
- <question> - owner: <name> - blocks gate 1
```

## Authoring loop

The user and an agent build a brief, design, or spec in short rounds.
This loop applies to all three doc kinds; [writing-designs.md](writing-designs.md) and [writing-specs.md](writing-specs.md) link here.
The foreground agent owns every question, user answer, and approval.
A writer agent, when one is used, does one bounded create or revise pass per round.
The writer never interviews the user and never starts the next doc stage.

1. The user states the idea in any form, or selects an existing draft to revise or resume.
2. The agent reads repo context first and never asks what repo files already answer.
3. For new work, the agent creates the doc from its skeleton, in the draft folder [doc-lifecycle.md](doc-lifecycle.md#drafts) defines.
   It fills only grounded facts: what the user stated and what repo files show.
   Everything else stays `TODO`, or `unknown` where the guide allows it.
   A missing approver stays `TODO`; the agent never names itself or the caller.
4. The agent posts an agenda: one line per section that still holds a `TODO` or fails a gate item, in section order.
   The agenda lives in the conversation only: no progress fields, front matter, sidecar files, or session state.
5. Each round, the agent asks 1-3 questions about the first open agenda item.
   Each question carries one recommended answer and its main tradeoff.
   A recommendation enters the doc only after the user confirms it.
   The agent asks for missing people, numbers, baselines, and goals; it never invents them.
6. After each answer, the agent revises the doc in place and shows only the changed bullets or sections.
   The agent then marks the agenda item closed, or names what it still misses.
   An answer that settles an item closes it, even in words other than the question's; the agent never asks it again.
7. When an answer raises a how-question in a brief, the agent adds it as an `F` under the goal it serves and leaves it unanswered.
8. The user can reopen any closed agenda item in any round.
   A changed answer updates every dependent bullet, rule, and example in the same doc.
9. To resume, the agent rereads the selected doc and its sources, then rebuilds the agenda from remaining `TODO`s and failing gate items.
10. The loop ends when the doc passes its completed-doc check: [Gate 1](#gate-1-brief-to-design) for a brief; the [Intent block](#intent-block) check when present, and the [editing pass](writing-designs.md#editing-pass) for a design; [Gate 2](writing-specs.md#gate-2-drafting-and-acceptance) for a spec.
    The agent reports each item as pass or fail.
    A passing check means ready for review, not accepted.
    The agent stops there: it never publishes, merges, labels, implements, or starts the next stage.

Partial and existing drafts:

- A partial draft keeps its `TODO`s and fails its completed-doc check; the agent never reports it ready.
- Source acceptance and the [spec sizing gate](writing-specs.md#sizing-gate) apply before a downstream draft starts.
  Known oversize work gets a proposed split, never a spec.
- The agent changes an existing file only when the user selected it for revision and it is unaccepted.
  At a new-work path that already exists, the agent stops; it never overwrites.
- Acceptance follows [doc-lifecycle.md](doc-lifecycle.md#review-and-acceptance).
  Without that evidence, acceptance is unknown: the agent asks the user and leaves the file unchanged meanwhile.
- A change to an accepted decision stops at the amendment rules in doc-lifecycle.md.
  The agent never edits an accepted source as a side effect of another draft.
  Approval in chat ("looks good") is not acceptance.

## Gate 1: brief to design

When the work starts with a brief, start a design or spec only when the brief is accepted.
Accept the brief only when every item holds:

- [ ] Idea states the problem, the outcome, `Who:`, `Baseline:` with a baseline or `unknown`, and exactly one `Approver:`.
- [ ] Every goal has an ID and a finite check.
- [ ] Every follow-up has an ID, sits under one goal, and asks a question without answering it.
- [ ] Non-goals are listed.
- [ ] Constraints are filled in or `None.`
- [ ] No open question tagged `blocks gate 1` remains.
- [ ] No `TODO` remains.
- [ ] Every section body is bullets only, and the brief fits ~40 lines.
- [ ] The brief names no components, except fixed constraints.
