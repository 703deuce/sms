#!/usr/bin/env bash
# Fail if diagnostic Live baseline reintroduces Realtime/delegation events.
set -euo pipefail
FILE="${1:-src/lib/voice/telnyx/openai-realtime-bridge/live-minimal-bridge.ts}"
PATTERNS=(
  'response\.create'
  'session\.commentary\.append'
  'session\.thinking\.append'
  'session\.instructions\.append'
  'input_audio_buffer\.append'
  'response\.output_audio\.delta'
)
for p in "${PATTERNS[@]}"; do
  if rg -n "$p" "$FILE" 2>/dev/null; then
    echo "FORBIDDEN pattern $p found in $FILE" >&2
    exit 1
  fi
done
echo "OK — no forbidden Live-baseline patterns in $FILE"
