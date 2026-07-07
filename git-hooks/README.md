# git-hooks

Global git hooks, kept in source control so they can't silently drift.

## `pre-push`

Refuses to push `agent/*` branches to any remote. `agent/*` branches are the
local, throwaway scratch created by the `/jxf:coding:execute` fan-out; anything
that needs to reach a remote belongs on a `topic/*` branch. Branch *deletions*
are still allowed, so an accidentally pushed `agent/*` branch can be cleaned up.

## Install (global, all repos)

Point git's global `core.hooksPath` at this directory:

```sh
REPO="$(git -C <path-to-agent-plugins> rev-parse --show-toplevel)"
git config --global core.hooksPath "$REPO/git-hooks"
chmod +x "$REPO/git-hooks/pre-push"
```

Run the tests with `sh "$REPO/git-hooks/pre-push.test.sh"` — they assert the two
non-obvious behaviors (deletions stay allowed; `agent/*` on either the local or
remote side is blocked) so a future edit can't silently regress them.

Note: `core.hooksPath` replaces the per-repo `.git/hooks` lookup for every repo
on the machine, so any hooks you rely on should live here too. Because the path
is absolute, moving or renaming this checkout means re-running the config above.
