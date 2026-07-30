---
description: Review every outstanding branch in parallel and resolve what the reviews find, one branch at a time
---

Review **all** outstanding branches, applying the same per-branch logic as `/jxf:coding:review` to each:

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

## Resolve each branch

Apply the **Resolve** steps from `/jxf:coding:review` to each branch's confirmed findings, on the branch they were found on. Resolution writes commits, so run it after the reviews return and work one branch at a time — never fan it out in parallel over a shared checkout.

A finding that needs a user decision does not stop a branch — `/jxf:coding:review`'s Resolve step records it as outstanding and carries on with that branch's remaining findings. If a branch's resolution genuinely cannot complete, finish what it can, record its remaining high-severity findings as outstanding and defer the rest with the failure as the reason, then continue with the other branches rather than aborting the whole run.

## Report

- List every branch reviewed with a per-branch verdict (looks good, or the count of confirmed findings by severity) and its resolution status in the form "N fixed, M deferred, K outstanding".
- Then list all confirmed findings ranked by severity across branches, each with the branch, `file:line`, what goes wrong, and a suggested fix.
- Keep the three resolution states distinct: mark each finding as fixed and re-verified, deferred with its one-line reason, or outstanding with what it is waiting on.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
- Name any branch whose review or resolution failed, and what it leaves outstanding.
