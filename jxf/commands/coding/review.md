---
description: Review the work on a branch before it's PR'd, or the branch most recently worked on, and resolve what the review finds
---

Review the following branch or body of work:

$ARGUMENTS

## Preflight

Verify you are inside a git repository (`git rev-parse --is-inside-work-tree`); refuse to proceed otherwise. Determine the default branch (usually `main`).

## Choose what to review

Work down this list and use the first that applies:

1. **Specific instructions above** — if the user named a branch, commit range, or files, review exactly that.
2. **Work from this session** — the branch or changes most recently produced in this conversation. Identify it from the session's own history, not by guessing from `git branch`.
3. **Most recent unmerged branch** — otherwise, the local branch not merged into the default branch with the newest commits, excluding the default branch and `agent/*` scratch. If there are none, report that there's nothing to review and stop.

## Review

1. Gather full context: `git log <default>..<branch>` and `git diff <default>...<branch>`.
2. Review the complete diff, not just the latest commit. Read the surrounding code in the repository as needed — hunk-local review misses broken callers, violated invariants, and missing updates elsewhere.
3. Cover the same dimensions as `/jxf:coding:pr:review` — correctness, design, tests, commit atomicity — fanning out parallel read-only subagents when the diff is large enough to warrant it.
4. Adversarially verify every candidate finding against the actual code before reporting it. Drop anything without a concrete failure scenario or clear, substantiated impact.

## Resolve

Resolution writes, so make the checkout safe first: note the branch you started on and return to it when you are done, and stage only the files your fixes touch. If the working tree carries changes that are not the work under review, surface them and ask before committing anything.

1. Fix every confirmed **high-severity** finding on the branch it was found on, and commit the fixes onto that same branch — never `main`. Where the reviewed work is uncommitted changes in the working tree or sits on an `agent/*` branch, fix it in place and leave it for `/jxf:coding:organize` to commit rather than committing it yourself. If the reviewed work is a bare commit range or sits on the default branch there is nowhere to put a fix: report the high-severity findings as outstanding and defer the rest, giving that as the reason.
2. Follow the repository's existing commit discipline: amend or fixup into the commit that introduced the problem when the branch has not been pushed and nothing is based on it; otherwise add a follow-up commit that stands on its own. If other branches are stacked on this one, prefer the follow-up commit — and if you do rewrite anyway, rebase every dependent branch onto the new tip and re-verify it.
3. A finding that lives in a base branch's commits belongs to that base branch, not to the branch stacked on it. Fix it once on the base and rebase the dependent onto the result; do not commit the same fix to both.
4. Re-review the changed code after fixing: confirm the finding is actually resolved and that the fix introduced nothing new. A finding is resolved only once it has been re-verified, not when the edit is written.
5. Fix **medium** and **low** findings when the fix is cheap, safe, and in scope; re-verify those the same way. Otherwise record each one explicitly as deferred with a one-line reason. Never drop one silently.
6. If a high-severity finding cannot be fixed here — it needs a user decision, falls outside the branch's scope, or the fix would change intended behavior — leave that finding unfixed and surface it as outstanding, then carry on resolving the branch's remaining findings. Outstanding is a terminal state for that finding, not a reason to abandon the branch.

When this command finishes, every confirmed finding is in exactly one of three states: fixed and re-verified, explicitly recorded as deferred with a reason, or surfaced as outstanding because it could not be resolved here. Only high-severity findings may end up outstanding; a deferred high-severity finding is not a legal outcome. Nothing is left silently outstanding.

## Report

- State which branch was reviewed and which selection rule applied.
- Rank confirmed findings by severity, each with `file:line`, what goes wrong, and a suggested fix.
- Give every finding its resolution status: fixed and re-verified (naming the commit that fixed it), deferred with its one-line reason, or outstanding with what it is waiting on.
- Close with a single summary line in the form "N fixed, M deferred, K outstanding", naming every outstanding finding when K is not zero.
- Write comments concisely — complete sentences, no filler; a sentence or two per finding.
- If nothing survives verification, say plainly that the branch looks good.
