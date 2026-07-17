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
3. **Review** — run `/jxf:coding:review:all` on the `topic/*` branches phase 2 produced, passing them as arguments so pre-existing unrelated branches aren't swept in: adversarially review each with parallel subagents. Fix high-severity confirmed findings on the affected branches and re-review them; carry lower-severity findings into the report.
4. **Make PRs** — run `/jxf:coding:pr:make:all` on those same branches: create a PR for each. If its preflight finds no remote or no `gh` authentication, treat this phase as skipped (and say so) rather than stopping the workflow.

Run the phases strictly in order — don't start one until the previous one has completed. If a phase fails or needs a user decision, stop and ask rather than improvising around it.

## Report

- Per task: what was done and its verification status.
- Per `topic/*` branch: its review outcome and PR URL (or why there is no PR).
- Anything outstanding, failed, or awaiting a user decision.
