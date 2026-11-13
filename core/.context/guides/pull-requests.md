# Pull Requests

How to cut, title, describe, and size a PR in this repo.

## Branch

- `type/description` - no prefix, no ticket.
- Context PRs use `context/<topic>` (see [context-maintenance.md](context-maintenance.md)).

## Title

- `<type>(<scope>): <imperative summary>`, <= 72 characters.
- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `ci`, `chore`.
- Scope is a module, package, or area, for example `cli`, `infra`, `context`.
- A PR that lands one spec milestone ends with `(M<n>)`.
- No tracker key in the title; the body carries it.

## Body

- Fill the repo's PR template when one exists (`.github/pull_request_template.md` or `.github/pull_request_template/`). Agents write the body to a file and pass `gh pr create --body-file <file>`.
- Brief and plain: prose over formatting, backticks only for commands or names a reader would copy. Link to long output (plans, logs) instead of pasting it.
- **Summary**, **Changes** and **Verification** are required. **Deploy**, **Context impact** and **Why this size** appear only when they apply.
- **Footer:** the last line links the spec and tracker as [doc-lifecycle.md](doc-lifecycle.md#review-and-acceptance) says.
- **Verification:** one line per check, with scope (`mise run test`, one package only). Never claim a repo-wide pass.
- **Deploy:** applies, secrets, ordering, rollback.
- **Context impact:** one bullet per fact in `AGENTS.md` or `.context/` the PR makes stale. Never edit protected context in a feature PR; a context PR applies these ([context-maintenance.md](context-maintenance.md)).
- No AI footer or session link.

## Size

- Changed lines = additions + deletions over files not deleted, excluding lockfiles and generated files.
- Target <= 500, cap 1000. Above 1000, split the PR, or add a `## Why this size` section with the reason.

## Splitting seams

In preference order:

1. Preparatory refactor -> behavior change -> cleanup.
2. Library release -> consumer pin (release the library first).
3. One spec milestone per PR.

Tests ride with the code they cover.

## Linear vs. stacked

Default linear: one PR per concern, based on `main`, mergeable alone.

Stack only when PR N+1 needs unmerged code from PR N and one combined PR would break the cap.
Max stack depth 3.

- Branch the child from the parent: `git switch -c <child> <parent-branch>`, then
  `gh pr create --base <parent-branch>`.
- Note the stack position in Summary: `k/n after #X, before #Y`.
- Merge bottom-up with "Create a merge commit".
- After the parent merges, retarget the child: `gh pr edit <child> --base main`. If the parent was
  squashed, `git rebase --onto origin/main <parent-branch>` and `git push --force-with-lease`.

## Draft vs. ready

Open as draft until Verification is filled in.
