---
name: lab-installed-tools
description: What is pre-installed (programs, Python/Node libs, fonts, CLIs)
when_to_use: Use before relying on a pre-installed program, library, font, or CLI, or when choosing fonts.
---

# Pre-installed tools

(Moved word for word from AGENTS.md lines 65-73, 75. These are still your rules; they just load on demand.)

- TOOLS (pre-installed):
  - Video/audio: `ffmpeg`/`ffprobe`, `ytdl` / `yt-dlp` (YouTube wrapper with Deno; use `--download-sections` for parts of long videos), `yt-transcript`, `sox`, `mediainfo`, `exiftool`, ImageMagick (`magick`).
  - Python 3.13 with pip/venv: requests, numpy, pillow, opencv-python-headless, moviepy, pydub, librosa, soundfile, scenedetect (shot detection), faster-whisper (local transcription with word timestamps; use the `small` or `base` model), playwright.
  - Node.js 24 LTS + npm (Remotion works: `npx create-video@latest` or `npm i remotion @remotion/cli`), Deno.
  - Browser: Chromium for your browser tools, plus Playwright (Chromium installed) for scripted screenshots/scraping.
  - Dev: git, curl, wget, jq, build-essential (gcc/make), zip/unzip, rsync.
  - Fonts: Noto (incl. CJK and emoji), DejaVu, Liberation, Roboto, Open Sans, and Google display fonts (Anton, Bebas Neue, Oswald, Montserrat, Inter, Poppins, Archivo Black, Playfair Display, DM Serif Display). `fc-list` shows all.
  - Docs & data: poppler-utils (`pdftotext`, `pdftoppm`), pandoc, LibreOffice headless (`soffice --headless --convert-to ...`), sqlite3, ripgrep (`rg`), `fd`, 7z/zip, LaTeX basics; Python pandas, matplotlib, beautifulsoup4, lxml, openpyxl, python-docx, python-pptx, pypdf, scikit-image/learn, scipy; Node globals typescript, tsx, pnpm.
  - Cloud/dev CLIs (no credentials configured): `gh`, `aws`, `b2`, ssh client. Python clients: deepgram-sdk, elevenlabs, openai, google-genai, boto3 (no keys; don't use paid APIs unless asked).
  - Fonts also include Transovo's production fonts (`/usr/share/fonts/truetype/transovo`: Montserrat Black, Anton, Poppins ExtraBold, Rubik, Gabarito, Fira Sans Condensed, DM Serif Display, Playfair, Caveat, Space Grotesk/Mono, Bangers, Noto scripts).
