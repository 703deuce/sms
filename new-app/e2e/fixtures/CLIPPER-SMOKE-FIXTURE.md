# Clipper E2E smoke fixture

`e2e/clipper-smoke.spec.ts` does **not** commit a video file. Provide a short talking-head or interview clip (20–60s) via env:

```bash
export CLIPPER_E2E_ENABLED=1
export CLIPPER_E2E_FIXTURE_PATH=/path/to/your-30s.mp4
export CLIPPER_E2E_EMAIL=...   # or E2E_ROOMS_EMAIL
export CLIPPER_E2E_PASSWORD=...
export PLAYWRIGHT_BASE_URL=https://transovo.ai
# optional: E2E_STORAGE_STATE=/path/to/storage.json

pnpm exec playwright test e2e/clipper-smoke.spec.ts -c playwright.prod.config.ts
```

Generate a local test pattern (requires `ffmpeg`):

```bash
bash scripts/generate-clipper-e2e-fixture.sh
export CLIPPER_E2E_FIXTURE_PATH="$PWD/e2e/fixtures/clipper-smoke-30s.mp4"
```
