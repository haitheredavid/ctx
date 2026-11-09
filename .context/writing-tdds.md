# Writing Technical Design Documents (TDDs)

Human reviews TDD; coding agent implements it.
TDD pins every decision crossing contract boundary, silent on rest.
Source: one row of DD work breakdown, or spec when you [skip the DD](writing-specs.md#skip-the-dd).
File name and lifecycle: [writing-specs.md#lifecycle](writing-specs.md#lifecycle).

## Gate 2: before you start

Source is a DD: start only when every item holds:

- [ ] The DD is accepted.
- [ ] The DD glossary covers every term this TDD uses.
- [ ] The work breakdown names this TDD, its scope, and its dependencies.
- [ ] This TDD passes the sizing gate.
- [ ] No open question in the DD `blocks` this TDD.

Source is a spec (DD skipped): start only when the spec is accepted and this TDD passes the sizing gate.

TDD needs to change DD decision -> stop, amend DD first.

## Sizing gate

One TDD = one independently shippable, revertable unit of work.
Scope too big or too low-level if any hold:

- The architecture diagram needs more than ~6 components.
- The doc needs more than 3 sequence diagrams.
- A diagram cannot be drawn in simple ASCII.

Then stop, propose split instead of one TDD.

## Structure

Sections, in order. Hard cap: ~250 lines.
Section holds nothing reviewer would reject PR over -> write `None.`

1. **Context** - 2-4 sentences: what exists, what's missing.
   Link source DD or spec, list goal IDs served.
   Copy glossary entries verbatim from the DD. DD skipped: write the glossary here.
2. **Non-goals and forbidden approaches** - scope this work will not address.
   Add forbidden approaches only to stop specific, plausible mistake.
3. **Requirements and invariants** - requirements `R1`, `R2`, ...; each has one reading and finite check.
   Invariants `I1`, `I2`, ... hold before and after ship.
4. **Architecture** - container-level ASCII diagram, one sentence per component.
   Then ASCII sequence diagrams for the flows that touch the most surface.
5. **Data model and interfaces** - entities, relationships, access patterns; interface names and purpose.
   Pin exact types only when different shape would fail review.
6. **Behavior rules** - each rule numbered `B1`, `B2`, ..., stated once in prose, then 1-3 worked examples (input -> outcome), incl. ugliest edge case.
   Examples normative: prose and example conflict -> example wins, fix doc.
7. **Acceptance criteria** - observable checks converting directly into tests.
   Each cites the `G`, `R`, `I`, or `B` IDs it verifies and does not restate them.
   Large work: group criteria into ordered milestones.
8. **Cross-cutting concerns** - only deviations from repo conventions.
9. **References** - patterns to imitate, one line each with file path.
   Alternatives considered, one line each.
10. **Halt conditions** - every unresolved item, as `If X, stop and ask.`
    No ambient open questions.

## Language

Single home of style rules for specs, DDs, TDDs.
Each rule has at most one bad example.

- One term per concept, defined in glossary, used identically every time.
  Bad: "page metadata" / "target page" / `PageMetadata` for one thing.
- Active voice, named actor as subject.
  Bad: "Output is accepted after validation." (accepted by what?)
- One fact per sentence, under ~20 words.
- Verbs, not zombie nouns.
  Bad: "the extraction of claims" / "claim extraction processing" (write "extract claims").
- Noun clusters max 3 words.
  Bad: "source-plan-bound extraction result contract".
- State behavior positively; never stack negations.
  Bad: "Do not publish unsupported claims as supported."
- No weak words. must = required; can = is able to; may = permitted and optional. No other modals.
  Bad: "Show the source span when available." (available when?)
- Parallel enumerations: every item same abstraction level.
- Cross-reference by ID; don't restate rule in another section.
- State decisions, not arguments. "Uses Postgres", not comparison.
- Bullets for enumerable facts; prose only for rationale.
- No pseudocode, snippets, signatures, except pinned contract types.
- Diagrams plain ASCII only. Doesn't fit ASCII -> too low-level.
- Write for engineer who knows stack. Don't explain framework.
- Self-contained. Link outside context; never summarize chat.

Editing pass: per sentence ask "if the implementer decided this differently, would the PR be rejected?"
No -> cut.
Coverage: every listed `G` and every `R`, `I`, and `B` has at least one acceptance criterion.

## Agents

- Read whole chain (spec, DD, TDD) before implementing.
- Never edit an accepted doc, except in a PR whose description states the change. Exceptions: setting a work-breakdown status and the deletes in the lifecycle.
- Create design docs only when asked.
