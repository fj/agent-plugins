---
description: Organize work into logical commits on topic/* branches
---

Organize all outstanding work — uncommitted changes in the working tree and any `agent/*` branches left by `/jxf:coding:develop` — into logical, complete commits on `topic/*` branches. Leave branches unmerged.

## Process

1. Start from the latest:
   - If there is a remote, `git fetch` it, then fast-forward `main` to its remote counterpart (`git pull --ff-only`) so topic branches are created from the current tip.
   - If worktree changes block the fast-forward or `main` has diverged, don't force it — surface the situation and ask how to proceed.
2. Inventory the outstanding work: `git status` and `git diff` for modified, staged, and untracked files, plus `git branch --list 'agent/*'` for branches left behind by `/jxf:coding:develop` (with `git log --oneline main..agent/<name>` and `git diff main...agent/<name>` for their commits). Read the file contents and diffs to understand what each change does.
3. Propose a set of topic branches, each with:
   - A branch name (`topic/<slug>`)
   - The files it includes
   - One or more commits with messages (the commit history should tell a logical story)
   - A short rationale for the grouping
4. Wait for the user to approve, adjust, or select a subset.
5. For each approved branch, in sequence:
   - Create the branch from the current `main`.
   - Populate it with the relevant work: stage and commit files from the working tree, and/or cherry-pick or merge the relevant commits from an `agent/*` branch. Use multiple commits when it makes the history clearer.
   - Do **not** merge the branch into `main` — leave it for the user to review and land.
   - If a later branch depends on an earlier one's changes, base it on that branch (a stack) and note the dependency; otherwise create it from `main` as usual.
6. After all approved work has been committed onto `topic/*` branches, delete the consumed `agent/*` branches (and remove any leftover worktrees) so they don't get double-committed on a later run — their work now lives on the topic branches.
7. Report the `topic/*` branches created (with any stacking order), and what (if anything) remains outstanding.

## Grouping principles

- Each commit should be **logical and complete**: it makes sense on its own and doesn't leave broken intermediate state.
- Group files by *purpose*, not by proximity.
- Use multiple commits on a branch when the changes tell a multi-step story (e.g. a feature developed over several iterations, each of which is complete).
- Don't mix unrelated concerns in one commit.

## Constraints

- Do not push to any remote.
- Do not merge anything into `main` or commit directly on it.
- Do not modify or rebase existing commits on `main`.
- Do not touch files that aren't part of the outstanding changes.
- Always end on `main` with a clean working tree (or report what remains).