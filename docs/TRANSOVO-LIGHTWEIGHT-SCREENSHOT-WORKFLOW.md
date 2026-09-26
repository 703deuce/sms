# Transovo — lightweight screenshot / visual review

**UI iteration:** dev server + targeted Playwright. **Release:** separate production build certification.

## Rules

1. **Never** `next build` just to take screenshots.
2. Use an **already running** dev server when possible (`GET /api/health`).
3. **Concurrency = 1** — sequential routes, no parallel workers.
4. Capture **only** the route or group you are working on (Level 1–2).
5. Viewport screenshots only (`fullPage: false`); 1440×900 desktop, 390×844 mobile.
6. Do **not** regenerate baseline/before libraries or HTML index on every tweak.

## Commands

App must run with `DEV_AUTH_BYPASS=1` and a valid `DEV_AUTH_BYPASS_EMAIL`.

**Level 1 — one route, desktop only (default during UI work):**

```bash
npx tsx scripts/capture-pass-3-visual-proof.ts --route /voice/receptionist --desktop-only
```

**Level 2 — page certification (desktop + mobile):**

```bash
npx tsx scripts/capture-pass-3-visual-proof.ts --route /voice/receptionist
```

**Small batch (3–5 routes), new browser per batch:**

```bash
npx tsx scripts/capture-pass-3-visual-proof.ts --group voice-config --batch-size 3
```

**Groups:** `voice-config`, `voice-operational`, `mctb-setup`, `mctb-operational`, `voice`, `mctb`

**Output:** `CAPTURE_OUT_ROOT` (default `/opt/cursor/artifacts/screenshots/transovo-ui/after/`)

**HTML index (checkpoints only):**

```bash
npx tsx scripts/capture-pass-3-visual-proof.ts --group mctb-setup --write-index
```

## Manifest

All canonical routes live in `ROUTE_MANIFEST` inside `scripts/capture-pass-3-visual-proof.ts`. Full product capture is **Level 3** — run in multiple `--group` batches, not one giant process.
