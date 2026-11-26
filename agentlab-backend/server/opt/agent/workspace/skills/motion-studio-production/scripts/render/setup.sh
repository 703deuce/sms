#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VENV="${MODAL_VENV:-$HERE/venv}"
[ -x "$VENV/bin/modal" ] || { [ -x /tmp/modal-venv/bin/modal ] && VENV=/tmp/modal-venv; }
if [ ! -x "$VENV/bin/modal" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q "modal==1.6.4" "requests>=2.31,<3"
fi
SMS="${SMS_DIR:-$HERE/sms}"
[ -f "$SMS/new-app/scripts/motion-studio/modal_submit.mjs" ] ||
  { [ -f /tmp/sms_modal/new-app/scripts/motion-studio/modal_submit.mjs ] && SMS=/tmp/sms_modal; }
if [ ! -f "$SMS/new-app/scripts/motion-studio/modal_submit.mjs" ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/703deuce/sms.git "$SMS"
  git -C "$SMS" sparse-checkout set new-app/scripts/motion-studio worker/modal_motion
fi
echo "VENV=$VENV";echo "SMS=$SMS"
