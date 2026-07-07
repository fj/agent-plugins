---
description: Execute directions or a list of tasks by fanning out subagents, then make and review PRs for the results
---

Execute the following directions or task list by decomposing the work and fanning out subagents as appropriate, then make PRs for the results and review them.

**This command never commits or merges to `main`.** It produces changes, PRs them, and leaves them ready for review; organizing them into `topic/*` branches is `/jxf:coding:commit`'s job, and landing them on `main` is the user's. Only override this if the user explicitly asks.

**Never push an `agent/*` branch to a remote.** `agent/*` branches are local, throwaway scratch created by the fan-out below; anything that needs to reach a remote (a PR) goes on a `topic/*` branch instead. A global `pre-push` hook enforces this, but don't rely on it — don't try to push `agent/*` in the first place.

$ARGUMENTS

## Preflight

1. Verify you are inside a git repository: run `git rev-parse --is-inside-work-tree`. If this fails, **refuse to proceed** — tell the user this command requires a git repository and stop.
2. Note the current branch and whether the working tree is clean (`git status`). Report any pre-existing uncommitted changes so they aren't attributed to this run.
3. If no directions or tasks were provided above, ask the user what to execute and stop.
4. Check whether a remote exists and `gh` is authenticated (`git remote -v`, `gh auth status`). If not, warn the user up front that the PR step will be skipped, and continue with execution only.
5. Start from the latest: `git fetch` the remote, then fast-forward the default branch to its remote counterpart (`git pull --ff-only`, or `git merge --ff-only <remote>/<default>`) and base new worktrees and branches on that updated tip. Skip if there's no remote; if the working tree is dirty or the default branch can't fast-forward, don't force it — surface the situation and ask how to proceed.

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
   > 3. Do **not** push (your `agent/*` branch is local-only and a global `pre-push` hook rejects it), merge, rebase, cherry-pick onto shared branches, or run `git branch -f` / `git update-ref` / `git gc`.
   > 4. When done, report your branch name. Do not integrate your work yourself.

4. As results come in, verify them: check that claimed changes exist, run tests or builds where applicable.
5. Leave results where `/jxf:coding:commit` can pick them up: worktree agents keep their committed `agent/*` branches; non-isolated agents leave plain uncommitted changes in the working tree (no `git add`/`git commit`). If the current branch is not `main`/shared you may merge `agent/*` branches onto it for convenience, but never onto `main`, never delete `agent/*` branches at this stage (the PR step consumes them later), and surface any conflicts to the user instead of picking a side.

## Make and review PRs

Skip this section entirely (and say so) if the preflight found no remote or no `gh` authentication.

1. Make a PR for each logical unit of completed work by following `/jxf:coding:pr:make` — typically one PR per unit, or one PR when the tasks form a single coherent change. **Never push an `agent/*` branch.** For a unit whose work lives on an `agent/*` branch, first move it onto a `topic/*` branch (`git switch -c topic/<slug> agent/<name>`) and PR that; for a unit still uncommitted in the working tree, commit it onto its own `topic/*` PR branch. Once a unit is PR'd on its `topic/*` branch, its `agent/*` branch is consumed — delete it so `/jxf:coding:commit` doesn't re-process the same work onto a second branch; leave only un-PR'd `agent/*` branches and uncommitted changes for `commit`. When there are several, apply the per-PR logic to each in turn as `/jxf:coding:pr:make:all` does. `main` stays untouched either way. Do not PR work that failed verification — report it instead.
2. Review the resulting PRs by following `/jxf:coding:pr:review:all`, which covers every PR made this session.
3. Fix any high-severity confirmed findings, push the fixes to the affected PR branches, and re-review the amended PRs. Carry lower-severity findings into the report rather than churning on them.

## Report

- Summarize per task: what was done, by which agent, and verification status.
- List each PR made, with its URL, the tasks it covers, and its review outcome (confirmed findings and what was fixed).
- List any tasks that failed, were skipped, or need user decisions, with enough detail to act on.
- State where each task's output lives (PR URL, `agent/*` branch names, and/or working-tree changes), and remind the user that `/jxf:coding:commit` organizes any work not already PR'd (leftover `agent/*` branches and uncommitted changes) into `topic/*` branches ready to merge.
