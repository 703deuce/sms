# Transovo Agent Lab sandbox: OpenHands agent-server + a full video/dev toolkit.
FROM ghcr.io/openhands/agent-server:1.63.1-python
USER root
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    DENO_INSTALL=/usr/local \
    PIP_BREAK_SYSTEM_PACKAGES=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg imagemagick sox libsox-fmt-all jq git curl wget unzip zip xz-utils build-essential pkg-config \
      python3-venv mediainfo exiftool rsync less nano htop \
      fonts-noto-core fonts-noto-extra fonts-noto-cjk fonts-noto-color-emoji fonts-dejavu fonts-liberation fonts-roboto fonts-open-sans \
 && rm -rf /var/lib/apt/lists/*
# Deno (yt-dlp uses it to solve YouTube's JS challenges)
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y && deno --version
# Python libs
RUN pip install --no-cache-dir -U "yt-dlp[default]" requests numpy pillow opencv-python-headless moviepy pydub \
      faster-whisper scenedetect librosa soundfile playwright \
 && playwright install --with-deps chromium \
 && chmod -R a+rX /opt/ms-playwright
# Google Chrome stable for the desktop and job browsers (chrome-keeper prefers it; sites block Chromium/--test-type less with Chrome)
RUN curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/gc.deb \
 && apt-get update && apt-get install -y --no-install-recommends /tmp/gc.deb && rm -f /tmp/gc.deb && rm -rf /var/lib/apt/lists/*
# A few Google display fonts
RUN mkdir -p /usr/share/fonts/truetype/google && cd /usr/share/fonts/truetype/google && \
    for f in anton/Anton-Regular bebasneue/BebasNeue-Regular oswald/Oswald%5Bwght%5D montserrat/Montserrat%5Bwght%5D \
             inter/Inter%5Bopsz,wght%5D poppins/Poppins-Bold poppins/Poppins-Regular archivoblack/ArchivoBlack-Regular \
             playfairdisplay/PlayfairDisplay%5Bwght%5D dmserifdisplay/DMSerifDisplay-Regular; do \
      curl -fsSLO "https://github.com/google/fonts/raw/main/ofl/$f.ttf" || echo "font missing: $f"; done; \
    fc-cache -f >/dev/null
RUN pip install --no-cache-dir audioop-lts && cd /usr/share/fonts/truetype/google && for f in *%5B*; do mv "$f" "$(echo $f | sed 's/%5B/[/; s/%5D/]/')"; done && fc-cache -f >/dev/null
# ---- Everyday tools for a general agent ----
RUN apt-get update && apt-get install -y --no-install-recommends \
      poppler-utils pandoc libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui \
      sqlite3 ripgrep fd-find p7zip-full openssh-client gh \
      libcairo2-dev libpango1.0-dev libgl1 libegl1 libgles2 libegl-mesa0 libgl1-mesa-dri libglib2.0-0 libsm6 libxext6 \
      texlive-latex-base texlive-fonts-recommended dvisvgm \
 && ln -sf /usr/bin/fdfind /usr/local/bin/fd && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pandas matplotlib beautifulsoup4 lxml openpyxl python-docx python-pptx pypdf reportlab pymupdf pdfplumber \
      scikit-image scikit-learn scipy trafilatura readability-lxml markdownify awscli b2 deepgram-sdk elevenlabs openai google-genai boto3 \
 && npm i -g typescript tsx pnpm && npm cache clean --force
# ---- Motion Studio producer engines (same as the producer box; pins from producer_handoff_kit/engines) ----
# Python engines: Cinematic Skill renderer deps (skia-python, moderngl), manim, rembg, OpenCV contrib, MediaPipe, scenedetect
RUN pip install --no-cache-dir "skia-python==144.1" "moderngl==5.13.0" "scenedetect==0.7.2" opencv-contrib-python-headless onnxruntime \
 && (pip install --no-cache-dir manim || echo "WARN manim failed") \
 && (pip install --no-cache-dir "rembg[cpu,cli]" || echo "WARN rembg failed") \
 && (pip install --no-cache-dir mediapipe || echo "WARN mediapipe failed")
# JS engines in one shared npm project: /opt/engines/js (import from there or copy into a job folder)
RUN mkdir -p /opt/engines/js && cd /opt/engines/js && npm init -y >/dev/null && npm pkg set type=module >/dev/null \
 && PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-audit --no-fund \
      remotion@4.0.528 @remotion/cli@4.0.528 @remotion/renderer@4.0.528 @remotion/bundler@4.0.528 react@19 react-dom@19 \
      @motion-canvas/core@^3.17.2 @motion-canvas/2d@^3.17.2 @motion-canvas/vite-plugin@^3.17.2 @motion-canvas/ffmpeg@^3.17.2 @motion-canvas/ui@^3.17.2 \
      @revideo/core@^0.11.0 @revideo/2d@^0.11.0 @revideo/renderer@^0.11.0 @revideo/vite-plugin@^0.11.0 @revideo/ffmpeg@^0.11.0 \
      vite@^5.4.21 pixi.js@^8.23.0 pixi-filters@^6.1.5 three@^0.187.0 @theatre/core@^0.7.2 @theatre/studio@^0.7.2 postprocessing@^6.39.6 \
      gsap@^3.15.1 p5@^2.4.0 d3@^7.9.2 maplibre-gl@^6.18.0 deck.gl@^9.4.1 @deck.gl/mapbox@^9.4.1 \
      @rive-app/canvas@^2.50.0 @rive-app/canvas-advanced@^2.50.0 lottie-web@^5.13.0 @lottiefiles/dotlottie-web@^0.83.2 \
      canvaskit-wasm@^0.42.0 puppeteer-core@^25.18.1 serve-handler@^6.1.8 \
 || (echo "WARN some JS engines failed; retrying core set" && npm install --no-audit --no-fund remotion@4.0.528 @remotion/cli@4.0.528 @remotion/renderer@4.0.528 react@19 react-dom@19 three gsap d3 pixi.js puppeteer-core serve-handler) ; \
    npm cache clean --force
# Skill / engine source repos at the producer's pinned commits (no node_modules; run npm i in a copy when needed)
RUN mkdir -p /opt/engines/repos && cd /opt/engines/repos && \
    clone(){ mkdir -p "$1" && cd "$1" && git init -q && git remote add origin "$2" && git fetch -q --depth 1 origin "$3" && git checkout -q FETCH_HEAD && cd ..; } && \
    clone cinematic-skill https://github.com/Moh4696/cinematic-skill bf435561c6203f90f971300efe952b68b5ec3417 && \
    clone claude-remotion-skill https://github.com/haidrrrry/claude-remotion-skill.git 1dcbe5e3fc6cf970bd10d3cc05f0a8a5d19d0383 && \
    clone dolly https://github.com/pvhuwung/dolly.git a78a82164ba4f09f1f917a9b2f0ad7c8e11ff7cc && \
    clone hyperframes https://github.com/heygen-com/hyperframes.git e426ce4eb44517db3f65105f1e05cb7b762cd950 && \
    clone open-3d-skills https://github.com/Moh4696/open-3d-skills.git 53beb899e77f65d50160a3765f36f5ddb8b3c19b && \
    rm -f claude-remotion-skill/demo.mp4 claude-remotion-skill/demo.gif && du -sh /opt/engines/repos/*
# Added 2026-11-22: free scratch voices for Cinematic Skill timing (espeak-ng, edge-tts) and the HyperFrames CLI
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir edge-tts==7.3.1 \
 && cd /opt/engines/js && PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-audit --no-fund hyperframes@0.9.84 && npm cache clean --force
# Transovo's production fonts (same set as the clips worker)
COPY fonts /usr/share/fonts/truetype/transovo
RUN fc-cache -f >/dev/null && pip install --no-cache-dir "pillow>=11,<12" pysocks
# The agent installs more at runtime with pip --user, npm in its job folder, or passwordless sudo.
COPY look browser-shot search readpage /usr/local/bin/
RUN cd /usr/local/bin && chmod 755 look browser-shot search readpage
USER openhands
# 2026-11-24: YouTube n-challenge needs yt-dlp >= 2026.11.23. The live wrapper
# uses the bind-mounted venv at /workspace/usage/ytdlp-venv (survives rebuilds). This
# layer is the image fallback for `python -m yt_dlp` after a future rebuild.
RUN pip install --no-cache-dir -U "yt-dlp[default]>=2026.11.23" yt-dlp-ejs youtube-transcript-api

# 2026-11-25 hard5 fixes: faster-runtime libraries (PyPy lives in /workspace/runtimes, installed with uv)
RUN pip install --no-cache-dir Cython python-sat z3-solver
