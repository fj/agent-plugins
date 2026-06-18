---
description: Organize outstanding work into logical commits on topic/* branches, then merge each into main
---

Organize all outstanding unstaged and untracked work into logical, complete commits on topic/* branches, then merge each into main.

## Process

1. Run `git status` and `git diff` to inventory all modified, staged, and untracked files.
2. Read file contents and diffs to understand what each change does.
3. Propose a set of topic branches, each with:
   - A branch name (`topic/<slug>`)
   - The files it includes
   - One or more commits with messages (the commit history should tell a logical story)
   - A short rationale for the grouping
4. Wait for the user to approve, adjust, or select a subset.
5. For each approved branch, in sequence:
   a. Create the branch from the current `main`.
   b. Stage and commit the relevant files (use multiple commits when it makes the history clearer).
   c. Merge the branch into `main` with `--no-ff`.
   d. Rebase the next branch onto the updated `main` to ensure no merge conflicts.
6. Report what was merged and what (if anything) remains outstanding.

## Grouping principles

- Each commit should be **logical and complete** — it makes sense on its own and doesn't leave broken intermediate state.
- Group files by *purpose*, not by proximity. A gitignore rule and a documentation file that serve the same goal belong together.
- Use multiple commits on a branch when the changes tell a multi-step story (e.g., add a feature, then add its tests).
- Never mix unrelated concerns in one commit.

## Constraints

- Do not push to any remote.
- Do not modify or rebase existing commits on `main`.
- Do not touch files that aren't part of the outstanding changes.
- Always end on `main` with a clean working tree (or report what remains).
