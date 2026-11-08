# Writing Technical Design Documents (TDDs)

Rules for any design doc in this repo.
Read whole file before writing TDD. Follow exactly.

You write Technical Design Document (TDD).
Human reviews TDD, then coding agent implements it.
TDD job: pin every decision crossing contract boundary. Stay silent on everything implementer can decide alone.

**Placement and lifecycle:**
Write TDD to `.context/active/YYYYMMDD-<doc-title>.md`, dated creation day.
TDD lives only as long as its implementation.
PR completing work deletes TDD.
See `.context/README.md` for active-doc lifecycle.

Use Simplified Technical English style:

- Active voice. Acting component = sentence subject.
  ("The worker writes claims," not "claims are written.")
- One instruction or fact per sentence. Sentences under ~20 words.
- State behavior positively. Say what system does before what it forbids.
- No gerund/participle chains as nouns.
  Prefer "extract claims" over "the extraction of claims" / "claim extraction processing."
- Noun clusters max 3 words. Break up "source-plan-bound extraction result contract."
- One term per concept, every time — see glossary below. Never vary defined term for style.

Avoid prose style — prose virtue = TDD defect.

**Sizing gate (apply BEFORE writing):**
One TDD = one independently shippable, revertable unit of work.
If architecture diagram needs >~6 components, or doc needs >3–4 sequence diagrams, or any diagram not drawable in simple ASCII — scope too big or too low-level.
Stop. Propose split into multiple TDDs instead.

**Structure (use these sections, in order):**

1. **Context & Problem** — 2–4 sentences: what exists today, what's broken or missing.

2. **Goals** — bulleted, measurable where possible.

3. **Non-Goals & Forbidden Approaches** — two explicit lists:
   - _Non-goals_: scope design won't address.
   - _Forbidden approaches_: solutions implementer must NOT use, even where natural (e.g. "do not add a new index", "do not introduce a new service", "do not denormalize this table").
     Include common/obvious approach if considered and rejected.

4. **Requirements** — constraints driving design.
   Each requirement unambiguous (one reading) and verifiable (finite check confirms it).

5. **Invariants** — statements true before AND after ship (backward compat guarantees, data integrity rules, idempotency properties).
   Constrain every implementation decision, including ones doc doesn't anticipate.

6. **Proposed Architecture** — prose plus C4 Container-level diagram in plain ASCII.
   One sentence per component stating responsibility.

7. **Key Interactions** — plain ASCII sequence diagrams for 2–4 flows exercising most architectural surface.

8. **Data Model** — entities, relationships, key access patterns.
   Schema sketches OK; full DDL not.

9. **APIs / Interfaces** — endpoint/interface names, methods, purpose.
   No request/response schemas or signatures UNLESS type itself is contract decision — i.e. different shape from implementer → PR rejected.
   Pin those types here exactly.

10. **Behavior & Domain Rules** — each business rule stated once in prose, then anchored with 1–3 concrete worked examples (inputs → expected outcome), always including ugliest edge case.
    Examples normative: if prose and example conflict, example wins and doc must be fixed.

11. **Acceptance Criteria** — observable, contract-level checks defining "done".
    Written to convert directly into tests.
    Large work: group criteria into ordered milestones; each milestone = verification gate implementation must pass before proceeding.

12. **Cross-Cutting Concerns** — auth, observability, error handling, etc.
    One short paragraph each, only where design deviates from or adds to repo conventions.
    Don't restate AGENTS.md.

13. **Reference Implementations** — pointers to existing repo files/modules whose patterns implementer should imitate, one line each (e.g. "error handling: follow src/handlers/x.ts").

14. **Alternatives Considered** — bulleted, one line each, with chosen option and half-sentence why.
    Link ADR if justification needs more.

15. **Halt Conditions** — anything unresolved goes here, phrased as explicit instruction: "If implementation touches X, stop and ask before proceeding."
    No ambient open questions; every item resolved before handoff or converted to halt condition.

**Style constraints:**

- Avoid `Elegant variation` antipattern:
  One token per concept, used identically every time.
  No many names for one concept, no one name for many concepts:
  "final placement" / "final pages" / "page metadata" / PageMetadata / "planned target page metadata" / "target page metadata" / "planned page metadata" / "planned target page."
  Each rename forces reviewer to ask: new thing or same thing?
- Follow `No undefined terms` rule:
  Define terms before use in glossary in **Context & Problem** section.
- Avoid `Stacked negation` antipattern: don't negate already-negative concepts:
  "Do not publish unsupported claims as supported."
  "Tests prove no output contains raw paths as authority."
- Stop `Specification by prohibition` abuse:
  "Halt Conditions", "Non-Goals & Forbidden Approaches" — use only when they stop agent from specific mistakes or valid-looking but inappropriate design choices from its TDD reading.
  TDD must be self-contained — not summary of chat conversation.
  Outside context → normative markdown link to doc.
  Be selective, targeted, precise.
- Avoid `Weak words and uncalibrated modals` antipattern:
  "Relevant contracts" (relevant by what test?).
  "source span when available" (available when? decided by whom?)
  "may show summarized gaps" (must|can|may|cannot used colloquially).
  Each needs interpretation; ban as "weak phrase" punting hidden decision to reader.
- Avoid `Nominalization and hidden actors` antipattern:
  No abstract nouns doing actions: "Extraction," "Projection," "synthesis," "placement," "ingestion" — unqualified, these are "zombie nouns", violating rule that characters = subjects, actions = verbs.
  Combined with agentless passive ("output must be accepted only through a schema-validated artifact" — accepted by what?), reviewer can't answer basic spec question: which component owns which behavior.
  Compound-noun pile-ups worsen it: "extraction target set," "schema-validated artifact scoped to source id."
- Avoid `Redundancy across sections` antipattern:
  Same rule restated in Goals, Requirements, Invariants, Behavior Rules, Acceptance Criteria.
  Restatements drift in wording → reviewer can't tell if §11 derives from §4 or adds constraints → must diff sections. Pure extraneous load.
- Avoid `non-parallel enumerations` antipattern:
  "Gap records missing evidence, unsupported hints, ambiguous variants, and out-of-scope material" — four items, four abstraction levels (absence, hint type, variant, material category).
  Reader hunts for organizing principle, finds none — small tax repeated across lists.
- All diagrams plain ASCII.
  Not expressible in simple ASCII diagram → too low-level for doc — omit or escalate via sizing gate.
- No pseudocode, no implementation snippets, no function signatures — except public contract types per section 9.
- State tech choices as decisions, not arguments.
  "Uses Postgres" — not three paragraphs comparing alternatives.
  Choice needs justification → one-line ADR pointer.
- Hard cap: ~300 lines.
  Section exceeding half page → ask whether to split into separate doc or ADR, not expand inline.
- Write for engineer who knows stack.
  Don't explain framework or database.
- Prose for design rationale; bullets for enumerable lists.
- Editing pass before finishing: delete any sentence describing HOW to build rather than WHAT must be true.
  Inclusion test: "if the implementer decided this differently, would the PR be rejected?"
  No → cut.
