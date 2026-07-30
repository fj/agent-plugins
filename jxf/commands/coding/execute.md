---
description: Execute a task list end-to-end — develop on parallel worktrees, organize into topic branches, review, and make PRs
---

Execute the following directions or task list end-to-end:

```
$ARGUMENTS
```

This command is a workflow: run the four commands below in order, applying each one's full logic. Their global rules hold throughout — never commit or merge to `main`, and never push an `agent/*` branch.

## Phases

1. **Develop** — run `/jxf:coding:develop` on the task list: decompose it and fan out subagents on parallel git worktrees, leaving completed work on `agent/*` branches and/or in the working tree.
2. **Organize** — run `/jxf:coding:organize`: gather that work into logical commits on `topic/*` branches, leaving them unmerged.
3. **Review** — run `/jxf:coding:review:all` on the `topic/*` branches phase 2 produced, passing them as arguments so pre-existing unrelated branches aren't swept in: adversarially review each with parallel subagents, then resolve each branch's confirmed findings through `/jxf:coding:review`'s **Resolve** step.
4. **Make PRs** — run `/jxf:coding:pr:make:all` on those same branches: create a PR for each. If its preflight finds no remote or no `gh` authentication, treat this phase as skipped (and say so) rather than stopping the workflow.

Run the phases strictly in order — don't start one until the previous one has completed. If a phase fails or needs a user decision, stop and ask rather than improvising around it.

A finding that phase 3 records as outstanding is not a phase failure and does not stop the workflow: phase 4's gate blocks that branch's PR while the others proceed, and the report names it. Stop and ask only if a phase itself cannot complete.

## Report

- Per task: what was done and its verification status.
- Per `topic/*` branch: its review outcome, phase 3's resolution summary line (how many findings were fixed, how many deferred and why, how many outstanding), and its PR URL (or why there is no PR).
- Confirm explicitly that nothing is left outstanding, or name what is.
- Anything that failed or is awaiting a user decision.
