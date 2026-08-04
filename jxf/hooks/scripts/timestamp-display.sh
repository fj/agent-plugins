#!/usr/bin/env bash
# MessageDisplay hook — prefixes each assistant message with its local arrival
# time and the gap since the previous stamped message in the same session:
#
#   {ts:2026-08-04 23:34:56}                first message of a session
#   {ts:2026-08-04 23:35:03 Δ 7s}           7 seconds later
#   {ts:2026-08-04 23:36:08 Δ 1m 12s}       72 seconds later
#   {ts:2026-08-05 01:10:41 Δ 1h 34m 33s}   an hour and a half later
#
# Display-only: MessageDisplay replaces the on-screen delta without touching the
# transcript or what the model sees, so the marker cannot confuse Claude.
#
# The event fires once per streamed batch of a message, carrying a zero-based
# `index`. Stamping only index 0 yields one marker per message rather than one
# per chunk.
#
# Time comes from `date` in the machine's local zone. jq's `now|strftime`
# renders in UTC and is deliberately not used.
set -euo pipefail

# Fail safe: with no jq, emit nothing and exit clean. Claude Code then displays
# the original message unchanged rather than swallowing assistant output.
command -v jq >/dev/null 2>&1 || exit 0

source "$(dirname "${BASH_SOURCE[0]}")/lib/state-path.sh"

readonly SECONDS_PER_MINUTE=60
readonly SECONDS_PER_HOUR=3600

format_gap() {
  local total="$1"
  local hours=$(( total / SECONDS_PER_HOUR ))
  local minutes=$(( total % SECONDS_PER_HOUR / SECONDS_PER_MINUTE ))
  local seconds=$(( total % SECONDS_PER_MINUTE ))

  if (( hours > 0 )); then
    printf 'Δ %dh %dm %ds' "$hours" "$minutes" "$seconds"
  elif (( minutes > 0 )); then
    printf 'Δ %dm %ds' "$minutes" "$seconds"
  else
    printf 'Δ %ds' "$seconds"
  fi
}

payload="$(cat)"

if [[ "$(jq -r '.index' <<<"$payload")" != "0" ]]; then
  jq '{hookSpecificOutput: {hookEventName: "MessageDisplay", displayContent: .delta}}' <<<"$payload"
  exit 0
fi

state_file="$(state_file_for_session "$(jq -r '.session_id // empty' <<<"$payload")")"

# One `date` call so the displayed stamp and the recorded epoch cannot straddle
# a second boundary.
read -r now_epoch stamp_date stamp_time < <(date '+%s %Y-%m-%d %H:%M:%S')

gap=""
if [[ -f "$state_file" ]]; then
  previous="$(<"$state_file")"
  if [[ "$previous" =~ ^[0-9]+$ ]] && (( now_epoch >= previous )); then
    gap=" $(format_gap $(( now_epoch - previous )))"
  fi
fi

# An unwritable state directory costs the next gap, not the message.
printf '%s\n' "$now_epoch" >"$state_file" 2>/dev/null || true

jq --arg marker "{ts:${stamp_date} ${stamp_time}${gap}} " '
  {hookSpecificOutput: {hookEventName: "MessageDisplay", displayContent: ($marker + .delta)}}
' <<<"$payload"
