---
description: Accept (merge) the specified PR if it's fully passing, or the last one worked on this session
---

Accept the following pull request:

$ARGUMENTS

## Preflight

1. Verify you are inside a git repository (`git rev-parse --is-inside-work-tree`); refuse to proceed otherwise.
2. Verify a remote exists and `gh` is authenticated (`git remote -v`, `gh auth status`). If either is missing, tell the user what's needed and stop.

## Choose the PR

Work down this list and use the first that applies:

1. **Specific instructions above** — if the user gave a PR number, URL, or branch name, accept exactly that PR.
2. **Last PR from this session** — the PR most recently created or updated in this conversation. Identify it from the session's own history, not by guessing from `gh pr list`.
3. **Most recent PR** — otherwise, the most recently created open PR authored by the user (`gh pr list --author "@me" --state open`). If there are none, report that there's nothing to accept and stop.

## Check readiness

Verify all of the following:

1. **Checks pass** — every CI check succeeded (`gh pr checks`); none failing or still pending.
2. **Mergeable** — no conflicts with the base branch (`gh pr view --json mergeable,mergeStateStatus`).
3. **No unresolved feedback** — no reviews requesting changes and no unresolved review threads (`gh pr view --json reviews` and the review-threads GraphQL via `gh api`).

If any of these fail, show the user exactly what is failing or unresolved and ask whether they're sure they want to accept anyway. Proceed only on an explicit yes; otherwise report and stop.

## Accept

1. Merge with `gh pr merge --merge --delete-branch`, falling back to the repository's allowed merge method if merge commits are disallowed, or using another method if the user asked for one.
2. Update the local checkout: `git fetch`, fast-forward the default branch (`git pull --ff-only`), and delete the local branch for the merged PR if it is fully merged.
3. Never force it: if the fast-forward fails or the local branch isn't fully merged, leave it alone and report.

## Report

- State which PR was accepted, which selection rule applied, and the merge result.
- If acceptance was declined or stopped, state exactly why (failing checks, conflicts, unresolved feedback, user said no).
- Note local cleanup performed or skipped.
