---
description: Review the specified PR, or the last one worked on this session
---

Review the following pull request:

$ARGUMENTS

## Preflight

1. Verify you are inside a git repository (`git rev-parse --is-inside-work-tree`); refuse to proceed otherwise.
2. Verify a remote exists and `gh` is authenticated (`git remote -v`, `gh auth status`). If either is missing, tell the user what's needed and stop.

## Choose the PR

Work down this list and use the first that applies:

1. **Specific instructions above** — if the user gave a PR number, URL, or branch name, review exactly that PR.
2. **Last PR from this session** — the PR most recently created or updated in this conversation. Identify it from the session's own history, not by guessing from `gh pr list`.
3. **Most recent PR** — otherwise, the most recently created open PR authored by the user (`gh pr list --author "@me" --state open`). If there are none, report that there's nothing to review and stop.

## Review

1. Gather full context: `gh pr view` (title, body, existing comments), `gh pr diff`, the commit list, and CI status (`gh pr checks`).
2. Review the complete diff, not just the latest commit. Read the surrounding code in the repository as needed — hunk-local review misses broken callers, violated invariants, and missing updates elsewhere.
3. Cover these dimensions, fanning out parallel read-only subagents when the diff is large enough to warrant it:
   - **Correctness** — bugs, edge cases, error handling, concurrency, security.
   - **Design** — cohesion, coupling, whether the change fits the surrounding architecture.
   - **Tests** — new behavior covered, assertions meaningful, edge cases exercised.
   - **Commit atomicity** — each commit one logical change.
4. Adversarially verify every candidate finding against the actual code before reporting it. Drop anything without a concrete failure scenario or clear, substantiated impact.

## Report

- State which PR was reviewed and which selection rule applied.
- Rank confirmed findings by severity, each with `file:line`, what goes wrong, and a suggested fix.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
- If nothing survives verification, say plainly that the PR looks good.
- Report findings in the conversation only — do not post comments or reviews on the PR itself unless the user asked for that.
