#!/usr/bin/env bash
# Installs the Motion Studio engine library at pinned commits. No renders.
set -u
ROOT=/workspace/motion_engines; LOG=$ROOT/_install; RES=$LOG/results.tsv
export PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm_config_fund=false npm_config_audit=false
diskpct(){ df --output=pcent / | tail -1 | tr -dc 0-9; }
guard(){ local p; p=$(diskpct); if [ "$p" -gt 85 ]; then echo "DISK ${p}% > 85%, stopping before $1" | tee -a $LOG/STOPPED; exit 3; fi; }
rec(){ printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$(date '+%F %T %Z')" "$3" >> $RES; }
src(){ # src <dir> <owner/repo> <fullsha>
  local d=$1/src; rm -rf $d; mkdir -p $d && cd $d && git init -q && git remote add origin https://github.com/$2 \
  && git fetch -q --depth 1 origin $3 && git checkout -q FETCH_HEAD && [ "$(git rev-parse HEAD)" = "$3" ]; }
npmeng(){ # npmeng <name> <repo> <sha> pkgs...
  local n=$1 r=$2 s=$3; shift 3; guard $n; local d=$ROOT/$n; mkdir -p $d
  ( set -e; src $d $r $s; cd $d; [ -f package.json ] || npm init -y >/dev/null; npm pkg set type=module >/dev/null; npm install --no-audit --no-fund "$@" ) > $LOG/$n.log 2>&1 \
   && rec $n OK "$r@${s:0:7} npm: $*" || rec $n FAIL "see $LOG/$n.log"; }
step="${1:-all}"
P(){ grep "^$1 " /workspace/motion_engines/_install/pins.txt | awk '{print $2}'; }
if [[ $step == all || $step == js ]]; then
[ -d $ROOT/_capture/node_modules ] || guard capture; mkdir -p $ROOT/_capture && ( set -e; cd $ROOT/_capture; [ -f package.json ] || npm init -y >/dev/null; npm pkg set type=module >/dev/null; npm install --no-audit --no-fund puppeteer-core@25 serve-handler ) > $LOG/_capture.log 2>&1 && rec _capture OK "puppeteer-core@25 + serve-handler" || rec _capture FAIL "see log"
npmeng motion-canvas motion-canvas/motion-canvas $(P motion-canvas/motion-canvas) @motion-canvas/core @motion-canvas/2d @motion-canvas/vite-plugin @motion-canvas/ffmpeg @motion-canvas/ui vite@5 typescript puppeteer-core@25
npmeng revideo redotvideo/revideo $(P redotvideo/revideo) @revideo/core @revideo/2d @revideo/renderer @revideo/vite-plugin @revideo/ffmpeg vite@5 typescript
npmeng pixijs pixijs/pixijs $(P pixijs/pixijs) pixi.js pixi-filters
npmeng threejs-theatre mrdoob/three.js $(P mrdoob/three.js) three @theatre/core @theatre/studio postprocessing
( src $ROOT/threejs-theatre/theatre-src theatre-js/theatre $(P theatre-js/theatre) ) >> $LOG/threejs-theatre.log 2>&1 && rec threejs-theatre-src OK "theatre-js/theatre@$(P theatre-js/theatre | cut -c1-7)" || rec threejs-theatre-src FAIL "see log"
npmeng gsap-svg greensock/GSAP $(P greensock/GSAP) gsap
npmeng p5js processing/p5.js $(P processing/p5.js) p5
npmeng d3 d3/d3 $(P d3/d3) d3 gsap
npmeng maplibre-deckgl maplibre/maplibre-gl-js $(P maplibre/maplibre-gl-js) maplibre-gl deck.gl @deck.gl/mapbox
( src $ROOT/maplibre-deckgl/deckgl-src visgl/deck.gl $(P visgl/deck.gl) ) >> $LOG/maplibre-deckgl.log 2>&1 && rec maplibre-deckgl-src OK "visgl/deck.gl@$(P visgl/deck.gl | cut -c1-7)" || rec maplibre-deckgl-src FAIL "see log"
npmeng rive rive-app/rive-wasm $(P rive-app/rive-wasm) @rive-app/canvas @rive-app/canvas-advanced
npmeng lottie airbnb/lottie-web $(P airbnb/lottie-web) lottie-web @lottiefiles/dotlottie-web
( src $ROOT/lottie/dotlottie-src LottieFiles/dotlottie-web $(P LottieFiles/dotlottie-web) ) >> $LOG/lottie.log 2>&1 && rec lottie-dotlottie-src OK "dotlottie-web@$(P LottieFiles/dotlottie-web | cut -c1-7)" || rec lottie-dotlottie-src FAIL "see log"
# Skia: source tree is huge; install the CanvasKit build only (pin recorded = google/skia HEAD)
guard skia; mkdir -p $ROOT/skia-canvaskit && ( set -e; cd $ROOT/skia-canvaskit; [ -f package.json ] || npm init -y >/dev/null; npm pkg set type=module >/dev/null; npm install --no-audit --no-fund canvaskit-wasm ) > $LOG/skia-canvaskit.log 2>&1 && rec skia-canvaskit OK "canvaskit-wasm npm (google/skia@$(P google/skia | cut -c1-7) noted, no src clone)" || rec skia-canvaskit FAIL "see log"
fi
if [[ $step == all || $step == py ]]; then
# apt step: Debian mirror unreachable on 16 Nov 2026 (HTTP 500 via proxy); manim now uses conda-forge deps instead
guard apt; ( sudo apt-get update -q && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q libcairo2-dev libpango1.0-dev pkg-config python3-dev build-essential ) > $LOG/apt.log 2>&1 && rec apt OK "cairo/pango dev libs" || rec apt FAIL "see $LOG/apt.log"
guard manim; ( set -e; d=$ROOT/manim; mkdir -p $d/bin; src $d ManimCommunity/manim $(P ManimCommunity/manim); cd $d; [ -x bin/micromamba ] || curl -fsSL -o bin/micromamba https://github.com/mamba-org/micromamba-releases/releases/latest/download/micromamba-linux-64; chmod +x bin/micromamba; MAMBA_ROOT_PREFIX=$d/mamba bin/micromamba create -y -q -p $d/env -c conda-forge python=3.12 pycairo manimpango pip; env/bin/python -m pip install -q ./src; env/bin/manim --version ) > $LOG/manim.log 2>&1 && rec manim OK "ManimCommunity/manim@$(P ManimCommunity/manim | cut -c1-7) conda-forge deps env" || rec manim FAIL "see log"
guard rembg; ( set -e; d=$ROOT/rembg; mkdir -p $d; src $d danielgatis/rembg $(P danielgatis/rembg); cd $d; uv venv -q venv --python 3.12; VIRTUAL_ENV=$d/venv uv pip install "./src[cpu,cli]"; U2NET_HOME=$d/models $d/venv/bin/rembg d u2net u2net_human_seg isnet-general-use ) > $LOG/rembg.log 2>&1 && rec rembg OK "danielgatis/rembg@$(P danielgatis/rembg | cut -c1-7) venv + models" || rec rembg FAIL "see log"
guard mediapipe; ( set -e; d=$ROOT/mediapipe; mkdir -p $d/models; cd $d; uv venv -q venv --python 3.12; VIRTUAL_ENV=$d/venv uv pip install mediapipe opencv-contrib-python numpy; curl -fsSL -o models/selfie_segmenter.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite; curl -fsSL -o models/selfie_multiclass_256x256.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite ) > $LOG/mediapipe.log 2>&1 && rec mediapipe OK "pip wheel (google-ai-edge/mediapipe@$(P google-ai-edge/mediapipe | cut -c1-7) noted) + tflite models" || rec mediapipe FAIL "see log"
guard opencv; ( set -e; d=$ROOT/opencv; mkdir -p $d; cd $d; uv venv -q venv --python 3.12; VIRTUAL_ENV=$d/venv uv pip install opencv-contrib-python-headless numpy scipy ) > $LOG/opencv.log 2>&1 && rec opencv OK "opencv-contrib-python-headless wheel (opencv/opencv-python@$(P opencv/opencv-python | cut -c1-7) noted)" || rec opencv FAIL "see log"
guard sam2; ( set -e; d=$ROOT/sam2; mkdir -p $d/checkpoints; src $d facebookresearch/sam2 $(P facebookresearch/sam2); cd $d; uv venv -q venv --python 3.12; VIRTUAL_ENV=$d/venv uv pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu; SAM2_BUILD_CUDA=0 VIRTUAL_ENV=$d/venv uv pip install --no-build-isolation -e ./src; VIRTUAL_ENV=$d/venv uv pip install opencv-python-headless; curl -fsSL -o checkpoints/sam2.1_hiera_tiny.pt https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt ) > $LOG/sam2.log 2>&1 && rec sam2 OK "facebookresearch/sam2@$(P facebookresearch/sam2 | cut -c1-7) CPU torch + hiera_tiny" || rec sam2 FAIL "see log"
fi
if [[ $step == all || $step == natron ]]; then
guard natron; ( set -e; d=$ROOT/natron; mkdir -p $d; cd $d; curl -fsSL -o natron.tar.xz https://github.com/NatronGitHub/Natron/releases/download/v2.5.0/Natron-2.5.0-Linux-x86_64-no-installer.tar.xz; tar -xJf natron.tar.xz; rm natron.tar.xz; MAMBA_ROOT_PREFIX=$ROOT/manim/mamba $ROOT/manim/bin/micromamba create -y -q -p $d/deps -c conda-forge libglu; mkdir -p extra_lib; cp -L deps/lib/libGLU.so.1 extra_lib/ ) > $LOG/natron.log 2>&1 && rec natron OK "Natron v2.5.0 portable" || rec natron FAIL "see log"
fi
echo DONE $(diskpct)%
