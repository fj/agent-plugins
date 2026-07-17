---
description: Review every outstanding branch by applying /jxf:coding:review to each in parallel
---

Review **all** outstanding branches, applying the exact same per-branch logic as `/jxf:coding:review` to each:

$ARGUMENTS

## Preflight

Run `/jxf:coding:review`'s Preflight once: confirm you are in a git repo and determine the default branch.

## Enumerate outstanding branches

1. If branches were given as arguments, review those.
2. Otherwise, find every local branch not merged into the default branch (`git branch --no-merged <default>`), excluding the default branch itself and `agent/*` scratch.
3. If there are none, report that there is nothing to review and stop.

Report the list before you start.

## Review each branch

Apply the **Review** steps from `/jxf:coding:review` to each branch, including the adversarial verification of every candidate finding. Reviews are read-only, so when there is more than one branch, fan them out as parallel subagents — give each subagent its branch name and the full review instructions, and have it return its confirmed findings.

If one branch's review fails, record the failure and continue with the remaining branches rather than aborting the whole run.

## Report

- List every branch reviewed with a per-branch verdict (looks good, or the count of confirmed findings by severity).
- Then list all confirmed findings ranked by severity across branches, each with the branch, `file:line`, what goes wrong, and a suggested fix.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
