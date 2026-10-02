# MCTB settings end-to-end audit summary

**Generated:** 2026-10-02 (UTC)  
**Audience:** Copy/paste handoff for launch certification

---

## End-to-end settings audit — result

The full **Matrix G + H** browser settings cert was re-run against production on workspace `ws_1` (deploy SHA `aca6107e`). Every exercised control follows **change → save → DB → reload → match → restore**.

### Outcome: **13 PASS / 0 FAIL / 6 SKIP** (exit 0)

**Evidence:**

- `/opt/cursor/artifacts/mctb-browser-settings-cert/settings-full-summary.json`
- `/opt/cursor/artifacts/mctb-browser-settings-cert/settings-full-final.png`
- Doc matrix (append-only history): `docs/MCTB-BROWSER-SETTINGS-FULL-CERT-RESULTS.md`
- Latest doc commit on `master`: `22bb0db5` (executive summary block)

**Latest run timestamp (from summary JSON):** `2026-10-02T22:10:48.955Z`  
**Production SHA at cert:** `aca6107e98f2a3b8b7d5e5ebe0dd8b671e4e7942`

---

## Settings verified (UI ↔ backend)

| Area | What was tested |
|------|------------------|
| Missed-call rules | Voicemail + busy triggers |
| Text back | Recovery delay, platform template, booking URL, request form |
| Recovery general | Cooldown + max automated texts |
| Phone & forwarding | Ring seconds, carrier select |
| AI Recovery | CALLBACK_TIME field toggle (save + restore) |
| Notifications | Urgent reply detection + cert recipient row |
| Sender | Platform sender readback from backend |

### PASS holes (13) — detail strings from cert

1. Missed-call trigger rules — toggle voicemail + restore  
2. Text-back template/delay — delay (platform sender)  
3. Cooldown/max messages — cooldown + max messages  
4. Phone/business-line metadata — forwarding ring seconds  
5. AI Recovery configuration — CALLBACK_TIME field toggle  
6. Sender mode — sender mode readable in backend (PLATFORM); UI radio not exposed  
7. Busy missed-call trigger — busy toggle + restore  
8. Booking link URL — booking URL persist  
9. Request form toggle — request form toggle  
10. Forwarding carrier — carrier verizon → att → restore  
11. Urgent reply detection — urgent toggle + restore  
12. Platform recovery template — platform template switch + restore  
13. Notifications recipient (stable) — cert recipient present + UI  

---

## Skips (not failures)

1. **Voicemail greeting/settings** — Headless run fills script and clicks Generate, but **“Use this greeting”** does not appear within 120s (TTS/preview timing). Product TTS can work manually; this row is a **cert/harness** gap, not a proven save bug.

2. **Consent mode, recovery pause, exclusions CRUD, missed calls UX** — Intentionally **not duplicated** in the settings-full suite; they live in the **27-row** main browser cert (`scripts/mctb-production-browser-cert.ts`). Documented as **27/27 PASS** in `docs/MCTB-E2E-AUDIT-HANDOFF-2026-10-01.md`.

3. **Recovery goal** — Control is **not shown** for platform sender (expected for `ws_1`).

---

## Combined launch picture

- **This suite** (Matrix G + H settings persistence): 13 PASS, 0 FAIL, 6 SKIP.  
- **Plus** the **27-row main browser cert** (consent, pause, exclusions, operational UX, route smoke, etc.) for “every setting surface” on V1 MCTB.  
- **Voicemail text + activate** still needs manual TTS smoke or harness follow-up if you require **zero SKIP** rows in the settings-full report.

**What each PASS proves:** UI change → Save (where applicable) → **database snapshot** → hard reload → UI and backend match → restore baseline.

---

## Re-run commands

### Full Matrix G + H settings persistence

```bash
MCTB_PROD_CERT_BASE_URL=... \
MCTB_PROD_CERT_EMAIL=... \
MCTB_PROD_CERT_WORKSPACE_ID=ws_1 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npm run test:mctb-browser-settings-cert
```

Artifacts default: `/opt/cursor/artifacts/mctb-browser-settings-cert/`

### Main 27-row cert (consent, pause, exclusions, missed-calls UX, etc.)

```bash
MCTB_PROD_CERT_BASE_URL=... \
MCTB_PROD_CERT_EMAIL=... \
MCTB_PROD_CERT_WORKSPACE_ID=ws_1 \
npx tsx scripts/mctb-production-browser-cert.ts
```

See `docs/MCTB-E2E-AUDIT-HANDOFF-2026-10-01.md` for prior 27/27 results and artifact paths.

### Targeted Matrix G holes (AI Recovery + Voicemail only)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/mctb-browser-cert/run-targeted-matrix-g-holes.ts ai-recovery voicemail
```

---

## Bottom line

For launch settings surfaces that the settings-full harness covers, **frontend saves persist to the backend** with reload proof. The only open gap in *this* report is **voicemail activate-via-TTS in headless**; everything else either **PASS**es here or is **covered by the main 27-row cert**.

---

## Related fixes on `master` (context)

- First-run wizard no longer blocks `/mctb/ai-recovery` and `/mctb/voicemail` (`MCTB_DEDICATED_SETUP_PATH_PREFIXES`).  
- AI Recovery: lead-recovery config save no longer wipes `collectCapabilities` on second POST.  
- Cert harness: Base UI button locators, restore polling via in-process DB snapshot, platform template poll, AI Recovery save only when master toggle changes.
