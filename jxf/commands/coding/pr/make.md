---
description: Make the next PR from work performed this session, or from the oldest unmerged branch
---

Create the next pull request:

$ARGUMENTS

## Preflight

1. Verify you are inside a git repository (`git rev-parse --is-inside-work-tree`); refuse to proceed otherwise.
2. Verify a remote exists and `gh` is authenticated (`git remote -v`, `gh auth status`). If either is missing, tell the user what's needed and stop.
3. Run `git status` — if there is uncommitted work that belongs in this PR, surface it and ask whether to commit it first rather than silently leaving it behind.

## Choose what to PR

Work down this list and use the first that applies:

1. **Specific instructions above** — if the user named a branch, commits, or a body of work, PR exactly that.
2. **Work performed this session** — if this conversation produced commits or a branch, PR that work. Identify it from the session's own history (branches created, commits made), not by guessing from `git log`.
3. **Oldest unmerged branch** — otherwise, find local branches not merged into the default branch (`git branch --no-merged <default>`), excluding the default branch itself. Pick the one whose first unmerged commit is oldest (`git log --reverse <default>..<branch>`). If there are none, report that there's nothing to PR and stop.

If the chosen work sits only on the default branch (e.g., merged topic branches or direct commits) and the remote default branch is behind, create a branch from the local default branch containing those commits and PR that — never PR by pushing the default branch itself.

## Make the PR

1. Ensure the branch is rebased on (or at least cleanly mergeable into) the latest remote default branch; rebase if needed and safe (never rewrite commits that are already on the remote).
2. Push the branch to the remote with an upstream (`git push -u origin <branch>`).
3. Review **all** commits the PR will contain (`git log` and `git diff <default>...<branch>`), not just the latest commit.
4. Create the PR with `gh pr create`:
   - Title: concise summary of the change (imperative mood).
   - Body: a short "## Summary" (what and why, 1-3 bullets) and a "## Test plan" describing how the change was or should be verified.
   - Target the repository's default branch unless instructed otherwise.
5. Do not enable auto-merge, request reviewers, or merge the PR unless asked.

## Report

- State which selection rule applied (instructions / session work / oldest unmerged branch) and why.
- Include the PR URL, the branch name, and the commits it contains.
- Note anything left out (uncommitted files, other unmerged branches still awaiting PRs).
