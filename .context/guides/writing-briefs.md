# Writing Briefs

A brief states what problem to solve, for whom, and how to tell it is solved.
It is the first document in the brief -> design -> spec flow and says nothing about how to build the solution.
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

The user and an agent build a brief in short rounds.
The agent drives the loop; the user answers and approves.

1. The user states the idea in any form.
2. The agent creates `brief.md` from the skeleton, in the draft folder [doc-lifecycle.md](doc-lifecycle.md#drafts) defines.
   It fills only what the user stated and writes `TODO` everywhere else.
3. The agent posts an agenda: one line per section that still holds a `TODO`, in section order.
4. Each round, the agent asks 1-3 questions about the first open agenda item.
   Each question carries the agent's recommended answer.
   The agent never asks what repo files already answer.
5. After each answer, the agent rewrites the affected bullets in the brief and shows the changed section.
   The agent then marks the agenda item closed, or names what it still misses.
6. When an answer raises a how-question, the agent adds it as an `F` under the goal it serves and leaves it unanswered.
7. The user can reopen any closed agenda item in any round.
8. The loop ends when the brief passes Gate 1.
   Before the user submits it for acceptance, the agent reports each Gate 1 item as pass or fail.

## Gate 1: brief to design

Start a design only when the brief is accepted, and accept it only when every item holds:

- [ ] Idea states the problem, the outcome, `Who:`, `Baseline:` with a baseline or `unknown`, and exactly one `Approver:`.
- [ ] Every goal has an ID and a finite check.
- [ ] Every follow-up has an ID, sits under one goal, and asks a question without answering it.
- [ ] Non-goals are listed.
- [ ] Constraints are filled in or `None.`
- [ ] No open question tagged `blocks gate 1` remains.
- [ ] No `TODO` remains.
- [ ] Every section body is bullets only, and the brief fits ~40 lines.
- [ ] The brief names no components, except fixed constraints.
