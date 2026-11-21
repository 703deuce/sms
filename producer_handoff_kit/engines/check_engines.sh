#!/usr/bin/env bash
# Motion Studio engine check (Rick, Nov 18 2026).
#   check_engines.sh                 check mode (default): fast file/version checks, one OK/MISSING line per item,
#                                    exit 1 if anything is missing. No installs, no renders.
#   check_engines.sh --fix [--force] reinstall ONLY the missing items (same way as the 18 Nov reinstall:
#                                    lockfiles, pinned versions, rembg git-version workaround), then smoke-check
#                                    each fixed item (import / model load / single still; never a video).
#                                    Refuses with exit 3 if a job looks active, unless --force.
# Run at the start of every job (SKILL.md Stage 0 step 6a). Reinstall only after a restart/restore lost something.
# Never prints secrets.
set -u
E=/workspace/motion_engines; ENG=/workspace/engines; PENV=/workspace/motion_prod_env
CIN=/workspace/motion_kit/code_motion_cinematic/repo/skills/cinematic-film/scripts
LOGD=$E/_install/fix_logs; HF_WHISPER=$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-small.en
HYPERFRAMES_VER=0.9.52
export PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm_config_fund=false npm_config_audit=false

FIX=0; FORCE=0
for a in "$@"; do case $a in --fix) FIX=1;; --force) FORCE=1;; -h|--help) sed -n 2,11p "$0"; exit 0;; *) echo "unknown option $a"; exit 2;; esac; done

MISSING=(); FAILED=()
ok(){ printf 'OK       %-26s %s\n' "$1" "${2:-}"; }
miss(){ printf 'MISSING  %-26s %s\n' "$1" "${2:-}"; MISSING+=("$1"); }

# ---------------------------------------------------------------- checks (fast, file/version only)
NPM_ENGINES="d3:d3 gsap-svg:gsap pixijs:pixi.js threejs-theatre:three p5js:p5 lottie:lottie-web rive:@rive-app/canvas-advanced maplibre-deckgl:maplibre-gl motion-canvas:@motion-canvas/core revideo:@revideo/renderer skia-canvaskit:canvaskit-wasm"
chk_npm(){ local n=${1%%:*} p=${1#*:}; [ -f $E/$n/node_modules/$p/package.json ] && ok "$n" "$(node -p "require('$E/$n/node_modules/$p/package.json').version" 2>/dev/null)" || miss "$n" "node_modules/$p"; }
chk_capture(){ [ -f $E/_capture/node_modules/puppeteer-core/package.json ] && [ -f $E/_capture/node_modules/serve-handler/package.json ] && ok _capture || miss _capture "puppeteer-core/serve-handler"; }
chk_hyperframes(){ ls -d $HOME/.npm/_npx/*/node_modules/hyperframes 2>/dev/null | while read d; do node -p "require('$d/package.json').version" 2>/dev/null; done | grep -qx "$HYPERFRAMES_VER" && ok hyperframes "$HYPERFRAMES_VER (npx cache)" || miss hyperframes "npx cache hyperframes@$HYPERFRAMES_VER"; }
chk_remotion_examples(){ [ -f $ENG/claude-remotion-skill/examples/node_modules/remotion/package.json ] && ok remotion-examples "$(node -p "require('$ENG/claude-remotion-skill/examples/node_modules/remotion/package.json').version")" || miss remotion-examples "claude-remotion-skill/examples/node_modules"; }
chk_dolly(){ local s=$ENG/dolly/starter; [ -f $s/package.json ] && [ -f $s/package-lock.json ] && [ -x $ENG/dolly/new.sh ] && [ -n "$(ls $s/public/sfx/*.wav 2>/dev/null)" ] && ok dolly-starter || miss dolly-starter "starter files / public/sfx"; }
chk_playwright(){ local c w; c=$(ls -d $HOME/.cache/ms-playwright/chromium-* 2>/dev/null | head -1); w=$(ls -d $HOME/.cache/ms-playwright/webkit-* 2>/dev/null | head -1)
  [ -n "$c" ] && [ -x $PENV/bin/python ] && $PENV/bin/python -c "import playwright" 2>/dev/null && ok playwright-chromium "$(basename $c)" || miss playwright-chromium
  [ -n "$w" ] && ok playwright-webkit "$(basename $w)" || miss playwright-webkit; }
chk_venv(){ # name module
  [ -x $E/$1/venv/bin/python ] && (cd /tmp && $E/$1/venv/bin/python -c "import importlib.util,sys; sys.exit(importlib.util.find_spec('$2') is None)" 2>/dev/null) && ok "$1" venv || miss "$1" "venv/$2"; }
chk_file(){ [ -s "$2" ] && ok "$1" "$(du -h "$2" | cut -f1)" || miss "$1" "$2"; }
chk_whisper(){ [ -n "$(ls $HF_WHISPER/snapshots/*/model.bin 2>/dev/null)" ] && $PENV/bin/python -c "import faster_whisper" 2>/dev/null && ok faster-whisper "small.en" || miss faster-whisper "small.en model or package"; }
chk_cmd(){ local v; v=$($2 2>/dev/null | head -1) && [ -n "$v" ] && ok "$1" "$v" || miss "$1"; }
chk_manim(){ [ -x $E/manim/env/bin/manim ] && [ -n "$(ls -d $E/manim/env/lib/python3*/site-packages/manim 2>/dev/null)" ] && ok manim env || miss manim "env (reinstall manually: install_all.sh py step)"; }
chk_cinematic(){ [ -x $PENV/bin/python ] && (cd /tmp && timeout 60 $PENV/bin/python $CIN/check_setup.py 2>/dev/null | tail -1 | grep -q ready) && ok cinematic "check_setup ready" || miss cinematic "check_setup.py not ready (motion_prod_env / skia)"; }
chk_natron(){ local n=$E/natron/Natron-2.5.0-Linux-x86_64-no-installer; [ -x $n/bin/NatronRenderer ] && [ -s $E/natron/extra_lib/libGLU.so.1 ] && ok natron "files only" || miss natron "portable binary / libGLU (reinstall manually: install_all.sh natron)"; }

run_checks(){
  MISSING=()
  for x in $NPM_ENGINES; do chk_npm $x; done
  chk_capture; chk_hyperframes; chk_remotion_examples; chk_dolly; chk_playwright
  chk_venv sam2 sam2; chk_file sam2-weights $E/sam2/checkpoints/sam2.1_hiera_tiny.pt
  chk_venv rembg rembg
  for m in u2net u2net_human_seg isnet-general-use; do chk_file rembg-$m $E/rembg/models/models/$m/$m.onnx; done
  chk_venv mediapipe mediapipe
  for m in selfie_segmenter.tflite selfie_multiclass_256x256.tflite face_landmarker.task blaze_face_short_range.tflite blaze_face_full_range.tflite; do chk_file mediapipe-${m%%.*} $E/mediapipe/models/$m; done
  chk_venv opencv cv2
  chk_whisper
  chk_cmd chrome "/usr/bin/google-chrome --version"; chk_cmd ffmpeg "ffmpeg -version"
  chk_manim; chk_cinematic; chk_natron
}

# ---------------------------------------------------------------- active-job guard
job_active(){
  local f
  for f in /workspace/motion_jobs/*/log/job.md; do
    [ -f "$f" ] || continue
    if [ -n "$(find "$f" -mmin -180 2>/dev/null)" ] && ! tail -n 5 "$f" | grep -qiE 'complete|failed|cancel'; then echo "active job log: $f"; return 0; fi
  done
  if pgrep -f 'capture\.mjs|render\.py|remotion (render|still)|hyperframes render|record\.py|build-editable-project|publish-editable|ffmpeg ' >/dev/null 2>&1; then echo "render/capture/ffmpeg process running"; return 0; fi
  return 1
}

# ---------------------------------------------------------------- fixes (only for missing items)
lg(){ mkdir -p $LOGD; echo "$LOGD/$1.log"; }
fix_npm(){ local n=$1; ( cd $E/$n && { npm ci --no-audit --no-fund || npm install --no-audit --no-fund; } ) > "$(lg $n)" 2>&1; }
fix_one(){
  local it=$1 L; L=$(lg "$it")
  case $it in
    d3|gsap-svg|pixijs|threejs-theatre|p5js|lottie|rive|maplibre-deckgl|motion-canvas|revideo|skia-canvaskit) fix_npm $it ;;
    _capture) ( cd $E/_capture && { [ -f package-lock.json ] && npm ci || npm install puppeteer-core@25 serve-handler; } ) > $L 2>&1 ;;
    hyperframes) ( cd /tmp && npx -y hyperframes@$HYPERFRAMES_VER --version ) > $L 2>&1 ;;
    remotion-examples) ( cd $ENG/claude-remotion-skill/examples && { [ -f package-lock.json ] && npm ci || npm install --no-audit --no-fund; } ) > $L 2>&1 ;;
    playwright-chromium|playwright-webkit) $PENV/bin/python -m playwright install chromium webkit > $L 2>&1 ;;
    sam2) ( set -e; cd $E/sam2; uv venv -q venv --python 3.12; export VIRTUAL_ENV=$E/sam2/venv
            uv pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu; uv pip install -q setuptools wheel
            SAM2_BUILD_CUDA=0 uv pip install -q --no-build-isolation -e ./src; uv pip install -q opencv-python-headless ) > $L 2>&1 ;;
    sam2-weights) mkdir -p $E/sam2/checkpoints && curl -fsSL -o $E/sam2/checkpoints/sam2.1_hiera_tiny.pt.tmp https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt && mv $E/sam2/checkpoints/sam2.1_hiera_tiny.pt.tmp $E/sam2/checkpoints/sam2.1_hiera_tiny.pt ;;
    rembg) ( set -e; cd $E/rembg; uv venv -q venv --python 3.12
             # src/.git is not usable after a restore, so poetry-dynamic-versioning needs a bypass (placeholder version; source stays at the pin)
             POETRY_DYNAMIC_VERSIONING_BYPASS=2.0.67 VIRTUAL_ENV=$E/rembg/venv uv pip install -q "./src[cpu,cli]" ) > $L 2>&1 ;;
    rembg-*) U2NET_HOME=$E/rembg/models $E/rembg/venv/bin/rembg d ${it#rembg-} > $L 2>&1 ;;
    mediapipe) ( set -e; cd $E/mediapipe; uv venv -q venv --python 3.12; VIRTUAL_ENV=$E/mediapipe/venv uv pip install -q mediapipe==1.2.3 opencv-contrib-python numpy ) > $L 2>&1 ;;
    mediapipe-*) local m=${it#mediapipe-} u
      case $m in
        selfie_segmenter) u=https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite; f=selfie_segmenter.tflite ;;
        selfie_multiclass_256x256) u=https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite; f=selfie_multiclass_256x256.tflite ;;
        face_landmarker) u=https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task; f=face_landmarker.task ;;
        blaze_face_short_range) u=https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite; f=blaze_face_short_range.tflite ;;
        blaze_face_full_range) u=https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite; f=blaze_face_full_range.tflite ;;
      esac
      mkdir -p $E/mediapipe/models && curl -fsSL -o $E/mediapipe/models/$f.tmp "$u" > $L 2>&1 && mv $E/mediapipe/models/$f.tmp $E/mediapipe/models/$f ;;
    opencv) ( set -e; mkdir -p $E/opencv; cd $E/opencv; uv venv -q venv --python 3.12; VIRTUAL_ENV=$E/opencv/venv uv pip install -q opencv-contrib-python-headless numpy scipy ) > $L 2>&1 ;;
    faster-whisper) ( cd /tmp && $PENV/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')" ) > $L 2>&1 ;;
    *) echo "no automatic fix for $it (see ENGINE_STATUS.md / install_all.sh)" > $L; return 1 ;;
  esac
}

# ---------------------------------------------------------------- smoke checks (no video)
smoke(){
  local it=$1
  case $it in
    d3) (cd $E/d3 && node --input-type=module -e "import * as d3 from 'd3'; if(typeof d3.scaleLinear!=='function') process.exit(1)") ;;
    gsap-svg) (cd $E/gsap-svg && node --input-type=module -e "import {gsap} from 'gsap'; import 'gsap/MorphSVGPlugin'; if(!gsap.version) process.exit(1)") ;;
    pixijs) (cd $E/pixijs && node --input-type=module -e "await import('pixi.js')") ;;
    threejs-theatre) (cd $E/threejs-theatre && node --input-type=module -e "import * as T from 'three'; await import('@theatre/core'); await import('postprocessing'); if(!T.REVISION) process.exit(1)") ;;
    revideo) (cd $E/revideo && node --input-type=module -e "const m=await import('@revideo/renderer'); if(typeof m.renderVideo!=='function') process.exit(1)") ;;
    skia-canvaskit) (cd $E/skia-canvaskit && node --input-type=module -e "import CK from 'canvaskit-wasm'; const c=await CK(); if(!c.MakeSurface(8,8)) process.exit(1)") ;;
    p5js|lottie|rive|maplibre-deckgl|motion-canvas|_capture|remotion-examples) run_checks_one $it ;;
    hyperframes) (cd /tmp && npx --no-install hyperframes@$HYPERFRAMES_VER --version >/dev/null) ;;
    playwright-*) $PENV/bin/python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.set_content('<p>x</p>'); pg.screenshot(path='/dev/null'); b.close()" ;;
    sam2|sam2-weights) (cd $E/sam2/src && $E/sam2/venv/bin/python -c "
from sam2.build_sam import build_sam2_video_predictor
build_sam2_video_predictor('configs/sam2.1/sam2.1_hiera_t.yaml','$E/sam2/checkpoints/sam2.1_hiera_tiny.pt',device='cpu')") ;;
    rembg|rembg-*) U2NET_HOME=$E/rembg/models $E/rembg/venv/bin/python -c "from rembg import new_session; new_session('u2net_human_seg')" ;;
    mediapipe|mediapipe-*) $E/mediapipe/venv/bin/python -c "
import mediapipe as mp, numpy as np
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions
s=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path='$E/mediapipe/models/selfie_segmenter.tflite'),output_confidence_masks=True))
s.segment(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.zeros((64,64,3),np.uint8))); s.close()" ;;
    opencv) $E/opencv/venv/bin/python -c "import cv2; cv2.TrackerCSRT.create()" ;;
    faster-whisper) (cd /tmp && $PENV/bin/python -c "
from faster_whisper import WhisperModel; import numpy as np
m=WhisperModel('small.en',device='cpu',compute_type='int8'); list(m.transcribe(np.zeros(16000,np.float32))[0])") ;;
    *) run_checks_one $it ;;
  esac >/dev/null 2>&1
}
run_checks_one(){ # re-run the matching check silently; succeed if not missing
  local before=${#MISSING[@]}
  case $1 in
    _capture) chk_capture ;; remotion-examples) chk_remotion_examples ;;
    *) for x in $NPM_ENGINES; do [ "${x%%:*}" = "$1" ] && chk_npm $x; done ;;
  esac >/dev/null
  [ ${#MISSING[@]} -eq $before ]
}

# ---------------------------------------------------------------- main
run_checks
if [ $FIX -eq 0 ]; then
  [ ${#MISSING[@]} -eq 0 ] && { echo "ALL OK"; exit 0; } || { echo "MISSING: ${MISSING[*]}  (fix: $0 --fix [--force])"; exit 1; }
fi
[ ${#MISSING[@]} -eq 0 ] && { echo "ALL OK, nothing to fix"; exit 0; }
if [ $FORCE -eq 0 ] && reason=$(job_active); then echo "REFUSED: a job looks active ($reason). Re-run with --force to fix anyway."; exit 3; fi
TODO=("${MISSING[@]}")
for it in "${TODO[@]}"; do
  printf 'FIXING   %s ... ' "$it"
  if fix_one "$it" && smoke "$it"; then echo "fixed + smoke OK"; else echo "FAILED (log: $LOGD/$it.log)"; FAILED+=("$it"); fi
done
echo "--- re-check"; run_checks
if [ ${#FAILED[@]} -eq 0 ] && [ ${#MISSING[@]} -eq 0 ]; then echo "ALL OK after fix"; exit 0; fi
echo "STILL MISSING/FAILED: ${MISSING[*]} ${FAILED[*]}"; exit 1
