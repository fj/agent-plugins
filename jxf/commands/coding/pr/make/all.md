---
description: Make PRs for every outstanding unmerged branch by applying /jxf:coding:pr:make to each in turn
---

Create pull requests for **all** outstanding work, applying the exact same per-PR logic as `/jxf:coding:pr:make` to each unmerged branch in turn:

$ARGUMENTS

## Preflight

Run `/jxf:coding:pr:make`'s Preflight once for the repository as a whole: confirm you are in a git repo, a remote exists, and `gh` is authenticated, and `git fetch` the latest so every PR is built against the current default-branch tip. Stop with a clear message if any fails.

## Enumerate outstanding branches

1. Find every local branch not merged into the default branch (`git branch --no-merged <default>`), excluding the default branch itself. These are the outstanding branches — one PR each. **Exclude `agent/*` branches** — those are local scratch that must never be pushed; note any that hold un-PR'd work as needing `/jxf:coding:organize` to organize them into `topic/*` branches first.
2. Order them oldest-first by their first unmerged commit (`git log --reverse <default>..<branch>`), so dependent branches are PR'd after the work they build on.
3. Skip any branch that already has an open PR (`gh pr list --head <branch>`); note it as already-PR'd rather than duplicating.
4. If there are no outstanding branches, report that there is nothing to PR and stop.

Report the ordered list before you start.

## Make each PR

For each branch in order, apply the **Make the PR** steps from `/jxf:coding:pr:make` verbatim (rebase if needed and safe, push with upstream, review all commits in `<default>...<branch>`, `gh pr create` with a "## Summary" and "## Test plan", target the default branch, no auto-merge/reviewers/merge unless asked).

- Do the branches one at a time; do not run `gh pr create` in parallel.
- If a branch fails (conflict, push rejection, etc.), record the failure and continue with the remaining branches rather than aborting the whole run.

## Report

- List every branch processed with its outcome: PR URL, skipped (already open), or failed (with the reason).
- Note anything left outstanding (uncommitted working-tree changes, branches that failed and need attention).
