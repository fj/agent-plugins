---
description: Organize outstanding work into logical commits on topic/* branches
---

Organize all outstanding work — uncommitted changes in the working tree and any `agent/*` branches left by `/jxf:coding:execute` — into logical, complete commits on `topic/*` branches. Leave the branches unmerged; merging into `main` is a separate, deliberate step for the user.

## Process

1. Start from the latest: `git fetch` the remote and fast-forward `main` to its remote counterpart (`git pull --ff-only`) so topic branches are created from the current tip. Skip if there's no remote; if the working tree changes block a fast-forward or `main` has diverged, don't force it — surface the situation and ask how to proceed. Then run `git status` and `git diff` to inventory all modified, staged, and untracked files. Also run `git branch --list 'agent/*'` to find any branches left behind by `/jxf:coding:execute`; include their commits in the inventory (`git log --oneline main..agent/<name>` and `git diff main...agent/<name>`).
2. Read file contents and diffs to understand what each change does, across both the working tree and any `agent/*` branches.
3. Propose a set of topic branches, each with:
   - A branch name (`topic/<slug>`)
   - The files it includes
   - One or more commits with messages (the commit history should tell a logical story)
   - A short rationale for the grouping
4. Wait for the user to approve, adjust, or select a subset.
5. For each approved branch, in sequence:
   a. Create the branch from the current `main`.
   b. Populate it with the relevant work: stage and commit files from the working tree, and/or cherry-pick or merge the relevant commits from an `agent/*` branch. Use multiple commits when it makes the history clearer.
   c. Do **not** merge the branch into `main` — leave it for the user to review and land.
   d. If a later branch depends on an earlier one's changes, base it on that branch (a stack) and note the dependency; otherwise create it from `main` as usual.
6. After all approved work has been committed onto `topic/*` branches, delete the consumed `agent/*` branches (and remove any leftover worktrees) so they don't get double-committed on a later run — their work now lives on the topic branches.
7. Report the `topic/*` branches created (with any stacking order), and what (if anything) remains outstanding.

## Grouping principles

- Each commit should be **logical and complete** — it makes sense on its own and doesn't leave broken intermediate state.
- Group files by *purpose*, not by proximity. A gitignore rule and a documentation file that serve the same goal belong together.
- Use multiple commits on a branch when the changes tell a multi-step story (e.g., add a feature, then add its tests).
- Never mix unrelated concerns in one commit.

## Constraints

- Do not push to any remote.
- Do not merge anything into `main` or commit directly on it.
- Do not modify or rebase existing commits on `main`.
- Do not touch files that aren't part of the outstanding changes.
- Always end on `main` with a clean working tree (or report what remains).
