---
description: Accept every passing open PR by applying /jxf:coding:pr:accept to each in turn
---

Accept **all** open pull requests, applying the same per-PR logic as `/jxf:coding:pr:accept` to each:

$ARGUMENTS

## Preflight

Run `/jxf:coding:pr:accept`'s Preflight once: confirm you are in a git repo, a remote exists, and `gh` is authenticated. Stop with a clear message if any fails.

## Enumerate PRs

1. If PR numbers, URLs, or branches were given as arguments, accept those.
2. Otherwise, take every open PR authored by the user (`gh pr list --author "@me" --state open`), oldest-first so stacked or dependent PRs land in order.
3. If there are none, report that there is nothing to accept and stop.

Report the list before you start.

## Accept each PR

Apply the **Check readiness** and **Accept** steps from `/jxf:coding:pr:accept` to each PR in order, one at a time — never merge in parallel, and re-check readiness after earlier merges since they can change a later PR's base state.

- When a PR fails readiness, handle it as you reach it per `/jxf:coding:pr:accept`'s Check readiness rule; record a declined PR and move on.
- If a merge fails, record the failure and continue with the remaining PRs.

## Report

- List every PR processed with its outcome: merged, declined, or failed (with the reason).
- Note local cleanup (default branch fast-forwarded, merged branches deleted) and anything outstanding.
