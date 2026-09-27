# MCTB production UI test — 2026-09-27

**Site:** production web app (Coolify FQDN / transovo.ai) <!-- pragma: allowlist secret -->
**Commit (health):** `7c97075f`  
**Auth:** `/api/auth/dev-bypass` (production allows redirect to `/mctb`)

## Verdict

**PASS for core MCTB Opus surfaces** — pages load, real workspace data (571/703/866 numbers, not 555-0188), filters/composer/setup controls usable.

**One moderate defect:** opening a missed call from the list sometimes shows **“Missed call not found.”** (detail API 404 or missing `event` in JSON). Investigate production API/errors for `/api/mctb/missed-calls/:id`.

## Routes exercised (browser)

| Route | Result |
|-------|--------|
| `/mctb` | PASS — KPIs, recent calls/conversations |
| `/mctb/missed-calls` | PASS list; detail click FAIL (not found) |
| `/mctb/conversations` | PASS — threads, composer (no send) |
| `/mctb/ai-recovery` | PASS |
| `/mctb/voicemail` | PASS — empty state |
| `/mctb/analytics` | PASS |
| `/mctb/setup` + phone, consent, text-back, recovery, voicemail, notifications, exclusions, links, test | PASS |
| `/mctb/compliance/consent` | PASS — consent log rows |

## Evidence (agent VM artifacts)

- Full report: `/opt/cursor/artifacts/TEST_REPORT.md`
- Summary: `/opt/cursor/artifacts/EXECUTIVE_SUMMARY.txt`, `00-READ-ME-FIRST.txt`
- Screenshots: `01-mctb-overview.webp` … `11-console-errors.webp`
- Short video: `/opt/cursor/artifacts/mctb-production-ui-walkthrough.webm`

## Minor notes

- Text Back Save: no obvious toast (save may still persist).
- Console: PWA `manifest.webmanifest` / `sw.js` 404 (non-blocking).
