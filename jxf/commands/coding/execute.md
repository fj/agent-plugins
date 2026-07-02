---
description: Execute directions or a list of tasks by fanning out subagents, isolating parallel work in git worktrees
---

Execute the following directions or task list by decomposing the work and fanning out subagents as appropriate:

$ARGUMENTS

## Preflight

1. Verify you are inside a git repository: run `git rev-parse --is-inside-work-tree`. If this fails, **refuse to proceed** — tell the user this command requires a git repository and stop.
2. Note the current branch and whether the working tree is clean (`git status`). Report any pre-existing uncommitted changes so they aren't attributed to this run.
3. If no directions or tasks were provided above, ask the user what to execute and stop.

## Plan the fan-out

1. Parse the input into discrete tasks. A bulleted/numbered list maps one item per task; free-form directions should be decomposed into logical units of work.
2. For each task, determine what files or areas of the codebase it will likely touch. Do a quick inline scan if needed — don't guess.
3. Group tasks by dependency and overlap:
   - **Independent tasks** (disjoint files, no ordering requirement) run as parallel subagents.
   - **Overlapping or dependent tasks** run sequentially, or are merged into a single subagent when they're really one unit of work.
   - **Read-only tasks** (research, analysis, review) never need isolation and can always run in parallel.
4. Choose isolation per subagent:
   - Use a separate git worktree (`isolation: "worktree"`) for any subagent that mutates files while other mutating subagents run concurrently.
   - Skip worktree isolation when only one subagent writes at a time, or the task is read-only — the overhead isn't justified.
5. Briefly state the plan (tasks, grouping, isolation choices) before launching. For a single trivial task, skip the ceremony and just do it inline.

## Execute

1. Launch parallel subagents in a single batch so they run concurrently. Give each a self-contained prompt: the task, relevant file paths or context discovered during planning, and clear completion criteria.
2. Instruct each mutating subagent to report exactly what it changed (files, tests run, results). Worktree-isolated agents should commit their work in the worktree so it can be merged back.
3. Include the following commit rules verbatim in every worktree-isolated subagent's prompt, filling in the placeholders:

   > You are working in your own git worktree at `<path>`. Rules for committing:
   > 1. First create and switch to your own branch: `git switch -c agent/<task-name>`. Never commit while on `main` or any shared branch.
   > 2. Commit only with plain `git add` / `git commit` in your own worktree.
   > 3. Do **not** push, merge, rebase, cherry-pick onto shared branches, or run `git branch -f` / `git update-ref` / `git gc`.
   > 4. When done, report your branch name. Do not integrate your work yourself.

4. As results come in, verify them: check that claimed changes exist, run tests or builds where applicable.
5. Integrate worktree results back into the main working tree by merging each reported `agent/*` branch one at a time, resolving conflicts if any arose. Surface conflicts to the user rather than silently picking a side. Delete merged `agent/*` branches after their worktrees are removed.

## Report

- Summarize per task: what was done, by which agent, and verification status.
- List any tasks that failed, were skipped, or need user decisions, with enough detail to act on.
- Do not push to any remote and do not commit to the main working tree unless the user asked for that.
