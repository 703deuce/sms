#!/usr/bin/env bash
# bootstrap_producer_box.sh: set up (or catch up) a Motion Studio Producer box from 703deuce/sms producer_handoff_kit/ ONLY.
# Idempotent and safe to re-run. It never prints, overwrites or uploads secrets, and never touches production servers.
#
#   bash producer_handoff_kit/setup/bootstrap_producer_box.sh            # files, skill, kits, env templates, optional Modal venv, checks
#   INSTALL_ENGINES=1 bash .../bootstrap_producer_box.sh                 # also install the engine library (long, ~8 GB)
#   KIT=/path/to/producer_handoff_kit bash .../bootstrap_producer_box.sh # use an existing checkout of the kit
#
# Lays out the standard paths the skill and routine expect:
#   /home/box/agent-data/workflows/motion-studio-production/   the production skill (SKILL.md first)
#   /workspace/motion_kit/{modal,bg_delivery,first_right,code_motion_cinematic/repo}
#   /workspace/ms_producer_editable/   producer build (editable packages, publish scripts)
#   /workspace/motion_runner/          leased deterministic render launcher
#   /workspace/motion_engines/_install/{install_all.sh,pins.txt,check_engines.sh}; /workspace/engines/ (core five clones)
#   /workspace/motion_jobs/{STYLE_LEDGER.md,ENGINE_STATUS.md,_pending/}  (prefers kit/ledgers/ over kit/templates/)
#   /workspace/secrets/{motion_production.env,motion_runner.env}, /workspace/render_bench/.modal_env  (templates, mode 600)
set -euo pipefail; set +x
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP=/workspace/backups/producer_bootstrap_$STAMP
SMS_BRANCH="${SMS_BRANCH:-master}"
say(){ printf '\n== %s\n' "$*"; }
backup(){ [ -e "$1" ] || return 0; mkdir -p "$BACKUP$(dirname "$1")"; cp -a "$1" "$BACKUP$1"; }

# 0. the kit itself
if [ -z "${KIT:-}" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$HERE/../README.md" ] && [ -d "$HERE/../skills/motion-studio-production" ]; then KIT="$(cd "$HERE/.." && pwd)"
  else
    say "cloning 703deuce/sms ($SMS_BRANCH) producer_handoff_kit -> /workspace/sms_producer_kit"
    rm -rf /workspace/sms_producer_kit
    git clone -q --depth 1 --filter=blob:none --sparse -b "$SMS_BRANCH" https://github.com/703deuce/sms.git /workspace/sms_producer_kit
    git -C /workspace/sms_producer_kit sparse-checkout set producer_handoff_kit
    KIT=/workspace/sms_producer_kit/producer_handoff_kit
  fi
fi
[ -f "$KIT/skills/motion-studio-production/SKILL.md" ] || { echo "kit not found at $KIT" >&2; exit 2; }
say "kit: $KIT"

# 1. skill
SK=/home/box/agent-data/workflows/motion-studio-production
say "skill -> $SK"
backup "$SK"; mkdir -p "$SK"
( cd "$KIT/skills/motion-studio-production" && tar cf - . ) | ( cd "$SK" && tar xf - )

# 2. motion_kit
say "motion_kit -> /workspace/motion_kit"
mkdir -p /workspace/motion_kit
for d in modal bg_delivery; do
  backup /workspace/motion_kit/$d; mkdir -p /workspace/motion_kit/$d
  ( cd "$KIT/skills/motion-studio-production/scripts/$d" && tar cf - . ) | ( cd /workspace/motion_kit/$d && tar xf - )
done
rm -f /workspace/motion_kit/modal/.publish_remap_deployed   # old gate, no longer used (fixes are on master)
backup /workspace/motion_kit/first_right; mkdir -p /workspace/motion_kit/first_right
( cd "$KIT/motion_kit/first_right" && tar cf - . ) | ( cd /workspace/motion_kit/first_right && tar xf - )
M=/workspace/motion_kit/first_right/models/face_detection_yunet_2023mar.onnx
if [ ! -f "$M" ]; then
  curl -fsSL -o "$M" https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx || echo "WARN: YuNet model download failed (first_right/face_frame.py is optional)"
fi
[ -f "$M" ] && ( cd /workspace/motion_kit/first_right/models && sed 's#/workspace/motion_kit/first_right/models/##' SHA256SUMS | sha256sum -c --quiet - ) || true
chmod +x /workspace/motion_kit/modal/*.sh /workspace/motion_kit/modal/*.py /workspace/motion_kit/bg_delivery/*.sh 2>/dev/null || true
if [ ! -d /workspace/motion_kit/code_motion_cinematic/repo/.git ]; then
  mkdir -p /workspace/motion_kit/code_motion_cinematic
  git clone -q https://github.com/Moh4696/cinematic-skill /workspace/motion_kit/code_motion_cinematic/repo && git -C /workspace/motion_kit/code_motion_cinematic/repo checkout -q bf43556
fi

# worked examples (code only, no media): Keef map fly-through, GameStop terminal
( cd "$KIT/motion_kit/worked_examples" && tar cf - . ) | ( cd /workspace/motion_kit && tar xkf - 2>/dev/null ) || true

# 3. core five engine clones (pinned)
say "core engines -> /workspace/engines"
mkdir -p /workspace/engines
clone_pin(){ [ -d "/workspace/engines/$1/.git" ] || { git clone -q "https://github.com/$2" "/workspace/engines/$1" && git -C "/workspace/engines/$1" checkout -q "$3"; } || echo "WARN: clone $2 failed"; }
clone_pin dolly pvhuwung/dolly a78a821
clone_pin hyperframes heygen-com/hyperframes e426ce4
clone_pin open-3d-skills Moh4696/open-3d-skills 53beb89
clone_pin claude-remotion-skill haidrrrry/claude-remotion-skill 1dcbe5e
( cd /tmp && npx -y hyperframes@0.9.52 --version >/dev/null 2>&1 ) || echo "WARN: npx hyperframes@0.9.52 not cached yet (check_engines.sh --fix installs it)"

# 4. engine library scripts (+ optional install)
say "engine scripts -> /workspace/motion_engines/_install"
mkdir -p /workspace/motion_engines/_install
cp "$KIT/engines/install_all.sh" "$KIT/engines/pins.txt" "$KIT/engines/check_engines.sh" /workspace/motion_engines/_install/
chmod +x /workspace/motion_engines/_install/*.sh
[ "${INSTALL_ENGINES:-0}" = 1 ] && bash /workspace/motion_engines/_install/install_all.sh all || true

# 5. producer build
say "producer build -> /workspace/ms_producer_editable"
B=/workspace/ms_producer_editable
if [ ! -d "$B/fixtures" ]; then
  # fixtures + test assets (media) live only on the original kit branch; fetch them once
  T=$(mktemp -d); git clone -q --depth 1 --filter=blob:none --sparse -b grokbot/motion-studio-producer-kit-20261117 https://github.com/703deuce/sms.git "$T/k" \
    && git -C "$T/k" sparse-checkout set producer_handoff_kit/build/ms_producer_editable \
    && mkdir -p "$B" && ( cd "$T/k/producer_handoff_kit/build/ms_producer_editable" && tar cf - . ) | ( cd "$B" && tar xf - ) || echo "WARN: original build fixtures not fetched"
  rm -rf "$T"
fi
mkdir -p "$B"
( cd "$KIT/build/ms_producer_editable" && find . -type f ) | while read -r f; do backup "$B/${f#./}"; done
( cd "$KIT/build/ms_producer_editable" && tar cf - . ) | ( cd "$B" && tar xf - )
( cd "$B" && PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-audit --no-fund >/dev/null 2>&1 || PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-audit --no-fund >/dev/null ) || echo "WARN: npm install in $B failed"

# 6. motion_runner
say "motion_runner -> /workspace/motion_runner"
mkdir -p /workspace/motion_runner; cp "$KIT/motion_runner/"* /workspace/motion_runner/; chmod 700 /workspace/motion_runner/*

# 7. job folder + ledgers (prefer the live Nov 21 ledgers over the older templates)
say "motion_jobs"
mkdir -p /workspace/motion_jobs/_pending
for f in STYLE_LEDGER.md ENGINE_STATUS.md; do
  [ -f /workspace/motion_jobs/$f ] && continue
  if [ -f "$KIT/ledgers/$f" ]; then cp "$KIT/ledgers/$f" /workspace/motion_jobs/$f
  else cp "$KIT/templates/$f" /workspace/motion_jobs/$f
  fi
done

# 8. secrets templates (never overwritten, never printed)
say "secrets templates"
mkdir -p -m 700 /workspace/secrets /workspace/render_bench
inst(){ [ -f "$2" ] || { cp "$1" "$2"; echo "created template $2 (fill it in)"; }; chmod 600 "$2"; }
inst "$KIT/setup/env/motion_production.env.example" /workspace/secrets/motion_production.env
inst "$KIT/setup/env/motion_runner.env.example" /workspace/secrets/motion_runner.env
inst "$KIT/setup/env/modal_env.example" /workspace/render_bench/.modal_env
# Optional infra templates (created only if missing; never overwritten or printed)
[ -f "$KIT/setup/env/producer_webhook.env.example" ] && inst "$KIT/setup/env/producer_webhook.env.example" /workspace/secrets/producer_webhook.env
[ -f "$KIT/setup/env/render_worker.env.example" ] && inst "$KIT/setup/env/render_worker.env.example" /workspace/secrets/render_worker.env
[ -f "$KIT/setup/env/chief.env.example" ] && inst "$KIT/setup/env/chief.env.example" /workspace/secrets/chief.env
[ -f "$KIT/setup/env/b2.env.example" ] && inst "$KIT/setup/env/b2.env.example" /workspace/secrets/b2.env
[ -f "$KIT/setup/env/b2.full.env.example" ] && inst "$KIT/setup/env/b2.full.env.example" /workspace/secrets/b2.full.env

# 9. Optional Modal venv (fallback only; default render path is self-hosted and .modal_disabled should exist)
say "Modal setup (fallback only)"
bash /workspace/motion_kit/modal/setup.sh >/dev/null && echo "Modal venv + renderer checkout ready (fallback only; leave .modal_disabled in place)" || echo "WARN: modal/setup.sh failed (ok if staying self-hosted)"

# 10. checks (names only, never values)
say "credential check (names only)"
need(){ local f="$1"; shift; for k in "$@"; do if grep -Eq "^(export )?$k=.+" "$f" 2>/dev/null; then echo "OK      $k ($f)"; else echo "MISSING $k ($f)"; fi; done; }
need /workspace/secrets/motion_production.env ELEVENLABS_API_KEY OPENAI_API_KEY GEMINI_API_KEY PIXABAY_API_KEY KIE_API_KEY REPLICATE_API_TOKEN
need /workspace/secrets/motion_runner.env MOTION_STUDIO_WORKER_ID MOTION_STUDIO_WORKER_TOKEN MOTION_STUDIO_AGENT_PUBLIC_URL MOTION_STUDIO_PRODUCER_KIT
need /workspace/render_bench/.modal_env MODAL_TOKEN_ID MODAL_TOKEN_SECRET
command -v gh >/dev/null && (gh auth status >/dev/null 2>&1 && echo "OK      gh auth (GitHub)" || echo "MISSING gh auth (GitHub access to 703deuce/sms)")
say "engine check"
bash /workspace/motion_engines/_install/check_engines.sh || echo "(missing items above: run check_engines.sh --fix, or INSTALL_ENGINES=1 on a fresh box)"
[ -d "$BACKUP" ] && echo "previous versions backed up under $BACKUP"
say "done. Next: HANDOFF_2026-11-21.md (rebuild from zero, then routine / profile / memory / credentials)."
