---
description: Review every PR worked on this session by applying /jxf:coding:pr:review to each
---

Review **all** pull requests worked on in this session, applying the exact same per-PR logic as `/jxf:coding:pr:review` to each:

$ARGUMENTS

## Preflight

Run `/jxf:coding:pr:review`'s Preflight once for the repository as a whole: confirm you are in a git repo, a remote exists, and `gh` is authenticated. Stop with a clear message if any fails.

## Enumerate the session's PRs

1. Identify the PRs from this session's own history: PRs created, pushed to, or otherwise worked on in this conversation. Do not guess from `gh pr list` — use what actually happened in the session.
2. If PR numbers, URLs, or branches were given as arguments, review those instead.
3. If there are no PRs to review, report that and stop.

Report the list before you start.

## Review each PR

Apply the **Review** steps from `/jxf:coding:pr:review` to each PR. Reviews are read-only, so when there is more than one PR, fan them out as parallel subagents — give each subagent its PR identifier and the full review instructions, and have it return its confirmed findings.

If one PR's review fails (e.g. `gh` errors), record the failure and continue with the remaining PRs rather than aborting the whole run.

## Report

- List every PR reviewed with a per-PR verdict (looks good, or the count of confirmed findings by severity).
- Then list all confirmed findings ranked by severity across PRs, each with the PR, `file:line`, what goes wrong, and a suggested fix.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
- Report findings in the conversation only — do not post comments or reviews on the PRs unless the user asked for that.
