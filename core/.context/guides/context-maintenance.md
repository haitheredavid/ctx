# Context Maintenance

How durable agent context stays true. The context agent runs on demand, when a user asks to "run the context agent", and follows this file.

## Scope

Protected paths - change only in context PRs:

- `AGENTS.md` (repo root only)
- `.context/README.md`
- `.context/project-context.md`
- `.context/guides/*`
- `.context/reference/*`

`.context/archive/` is frozen: never edited, never added to. Nested `AGENTS.md` and `README.md` files are co-located docs, not protected context.

## Altitude rule

A sentence belongs in protected context only if it stays true when any single feature, module, job, table, schedule, or library API changes. Protected files hold conventions, invariants, decisions, and pointers to co-located docs or config files. They never hold:

- module, job, table, or schema names, except one illustrative example inside a convention;
- schedules;
- first adopters;
- status words (`today`, `currently`, `now`, `first`, `pilot`, `until`, `Phase <n>`, `M<n>`, `in flight`);
- dated evaluation pointers;
- enumerations a config file holds (lint excludes, test paths, workspace members, task lists other than the `AGENTS.md` Commands block).

## Placement

|Content|Home|
|---|---|
|module or library API and mechanics|that directory's `AGENTS.md` or `README.md`|
|area-specific conventions|nearest nested `AGENTS.md`|
|operator runbooks|nearest `README.md`|
|briefs, designs, specs, findings|[doc-lifecycle.md](doc-lifecycle.md)|
|progress/status|PR descriptions|

Co-located docs change in the same PR as their code.

## Run procedure

1. Branch from a fresh default branch: `git fetch origin && git switch -c context/<YYYYMMDD>-sync origin/main`.
2. Find the since-date: `gh pr list --state merged --label context --limit 1 --json mergedAt -q '.[0].mergedAt'`.
   If empty, use 30 days ago.
3. Harvest: `gh pr list --state merged --base main --search "merged:>=<date>" --limit 200 --json number,title,body`.
   Collect each `## Context impact` section that is not `None`.
4. Drift audit:
   - The `AGENTS.md` Commands block matches the task runner's task list (`mise tasks`).
   - Every backticked repo path and relative link in protected files exists.
   - Every `#anchor` link resolves.
   - The forbidden-word grep returns nothing (this file lists the words, so it is excluded):
     `git grep -nwEi '(today|currently|pilot|in flight|phase [0-9]|M[0-9])' -- AGENTS.md .context/README.md .context/project-context.md .context/guides .context/reference ':!.context/guides/context-maintenance.md'`
5. Edit only protected paths. When a fact belongs co-located and is missing there, list it under "Co-located follow-ups" in the PR body instead of editing.
6. Open the PR: title `docs(context): <summary>`, label `context`, body sections `Sources` (PR numbers), `Changes`, `Drift fixes`, `Co-located follow-ups`. The size rules in [pull-requests.md](pull-requests.md#size) apply.
