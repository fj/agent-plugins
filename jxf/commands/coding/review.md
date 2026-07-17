---
description: Review the work on a branch before it's PR'd, or the branch most recently worked on
---

Review the following branch or body of work:

$ARGUMENTS

## Preflight

Verify you are inside a git repository (`git rev-parse --is-inside-work-tree`); refuse to proceed otherwise. Determine the default branch (usually `main`).

## Choose what to review

Work down this list and use the first that applies:

1. **Specific instructions above** — if the user named a branch, commit range, or files, review exactly that.
2. **Work from this session** — the branch or changes most recently produced in this conversation. Identify it from the session's own history, not by guessing from `git branch`.
3. **Most recent unmerged branch** — otherwise, the local branch not merged into the default branch with the newest commits, excluding the default branch and `agent/*` scratch. If there are none, report that there's nothing to review and stop.

## Review

1. Gather full context: `git log <default>..<branch>` and `git diff <default>...<branch>`.
2. Review the complete diff, not just the latest commit. Read the surrounding code in the repository as needed — hunk-local review misses broken callers, violated invariants, and missing updates elsewhere.
3. Cover the same dimensions as `/jxf:coding:pr:review` — correctness, design, tests, commit atomicity — fanning out parallel read-only subagents when the diff is large enough to warrant it.
4. Adversarially verify every candidate finding against the actual code before reporting it. Drop anything without a concrete failure scenario or clear, substantiated impact.

## Report

- State which branch was reviewed and which selection rule applied.
- Rank confirmed findings by severity, each with `file:line`, what goes wrong, and a suggested fix.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
- If nothing survives verification, say plainly that the branch looks good.
