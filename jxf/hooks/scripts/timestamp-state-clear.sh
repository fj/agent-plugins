#!/usr/bin/env bash
# SessionEnd hook — discards the session's timestamp state so the files written
# by timestamp-display.sh do not accumulate.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

source "$(dirname "${BASH_SOURCE[0]}")/lib/state-path.sh"

rm -f "$(state_file_for_session "$(jq -r '.session_id // empty')")"
