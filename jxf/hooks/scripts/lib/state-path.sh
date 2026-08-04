# Shared derivation of the per-session timestamp state file, sourced by the
# MessageDisplay stamper and the SessionEnd cleaner so the two cannot disagree
# about where the state lives.

state_file_for_session() {
  local session_id="${1:-unknown}"
  printf '%s/jxf-plugin-ts-state-%s' "${TMPDIR:-/tmp}" "${session_id//[^A-Za-z0-9_-]/_}"
}
