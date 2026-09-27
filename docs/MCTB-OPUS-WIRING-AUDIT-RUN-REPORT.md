# MCTB Opus page wiring — full run report (copy-paste)

Generated: 2026-09-27 (UTC)  
Agent session: MCTB Stage 2 connected-page audit + shell context fixes  

---

## Repository / PR

| Item | Value |
|------|--------|
| Branch | `cursor/mctb-critical-path-perf-2304` |
| Latest commit (audit pass) | `f5f208ba` — fix(mctb): Opus page wiring audit — real shell context and no demo fallbacks |
| Pull request | https://github.com/703deuce/sms/pull/551 |
| Scope | MCTB main menu + setup sub-pages under Stage 2 (`isNewUiStage2Enabled()`). **Skipped:** Shared nav (Numbers, Settings, generic `/conversations`). |

---

## Commands run (this audit) and results

### 1. Git status (before commit)

```
On branch cursor/mctb-critical-path-perf-2304
Changes not staged: shell-context, sidebar, voicemail-browser, conversations-page,
  setup-pages, setup-wiring-hooks, opus-workspace-data, nav.ts
Untracked: scripts/audit-mctb-opus-page-wiring.ts, src/lib/mctb/shell-context-data.ts
```

### 2. Static sandbox grep (manual inspection)

Searched `newui-transplant` for `sandbox-data`, `MOCK_`, `wired === undefined` fallbacks.

- **`connected/mctb/**`:** no `sandbox-data` imports (PASS).
- **`mirror/routes/mctb/**`:** still imports `sandbox-data` for preview when `wired` is omitted (expected; not used in Stage 2 production routes).
- **`components/mctb/inbox.tsx`:** imports sandbox only for non-production path when `wiring` is absent; production passes `wiring` + real conversation rows.

### 3. `npm run audit:mctb-opus-page-wiring`

**Exit code:** 0  

```
# MCTB Opus page wiring inventory

## /mctb
- Connected: `overview-page.tsx`
- Data: SSR loadMctbOverview + /api/mctb/overview-enrichment
- Runtime writes: — (read-only)

## /mctb/missed-calls
- Connected: `missed-calls-page.tsx`
- Data: /api/mctb/missed-calls (client refetch)
- Runtime writes: Row exclusion → POST /api/mctb/exclusions

## /mctb/missed-calls/[id]
- Connected: `missed-call-detail-page.tsx`
- Data: GET /api/mctb/missed-calls/:id
- Runtime writes: — (read-only; links to inbox)

## /mctb/conversations
- Connected: `conversations-page.tsx`
- Data: kimi-inbox-adapter (source=mctb) + /api/mctb/shell-context
- Runtime writes: patchConversation, sendNewMessage → SMS pipeline
- Notes: MCTB-filtered shared inbox; not generic /conversations shell

## /mctb/ai-recovery
- Connected: `ai-recovery-page.tsx`
- Data: GET /api/mctb/ai-recovery/context
- Runtime writes: POST /api/mctb/lead-recovery/config (+ booking-links)

## /mctb/voicemail
- Connected: `voicemail-page.tsx`
- Data: GET /api/phone/voicemail
- Runtime writes: — (operational inbox)

## /mctb/analytics
- Connected: `analytics-page.tsx`
- Data: SSR loadMctbAnalytics + GET /api/mctb/analytics
- Runtime writes: —

## /mctb/compliance/consent
- Connected: `consent-history-page.tsx`
- Data: GET /api/mctb/consent-log
- Runtime writes: —

## /mctb/setup
- Connected: `setup-pages.tsx → overview wiring`
- Data: GET /api/mctb/setup, onboarding, live-test, funnel
- Runtime writes: Pause → POST /api/mctb/setup

## /mctb/setup/phone
- Connected: `mctb-setup-phone-wiring.ts`
- Data: GET /api/mctb/setup + /api/mctb/onboarding
- Runtime writes: POST /api/mctb/setup, /api/mctb/onboarding (forwarding test)

## /mctb/setup/consent
- Connected: `consent-editor.tsx`
- Data: GET /api/mctb/setup, /api/mctb/consent-prompt
- Runtime writes: POST /api/mctb/setup (consentMode, attestation)

## /mctb/setup/text-back
- Connected: `text-back-editor.tsx`
- Data: GET /api/mctb/setup
- Runtime writes: POST /api/mctb/setup (messageTemplate)

## /mctb/setup/recovery
- Connected: `setup-wiring-hooks useMctbRecoveryWiring`
- Data: GET /api/mctb/setup
- Runtime writes: POST /api/mctb/setup (triggers, pause, cooldown, delay)

## /mctb/setup/voicemail
- Connected: `useMctbVoicemailWiring`
- Data: GET /api/mctb/setup + /api/phone/voicemail
- Runtime writes: POST /api/phone/voicemail; setup triggerRules

## /mctb/setup/notifications
- Connected: `useMctbNotificationsWiring`
- Data: GET/POST /api/mctb/handoff
- Runtime writes: POST /api/mctb/handoff

## /mctb/setup/exclusions
- Connected: `exclusions-table.tsx`
- Data: GET/POST/DELETE /api/mctb/exclusions
- Runtime writes: Exclusions API → send eligibility

## /mctb/setup/links
- Connected: `useMctbLinksWiring`
- Data: GET /api/mctb/setup
- Runtime writes: POST /api/mctb/setup (defaultLinkUrl, requestForm)

## /mctb/setup/test
- Connected: `useMctbTestWiring`
- Data: /api/mctb/setup-test, /api/mctb/live-test, /api/mctb/setup
- Runtime writes: POST /api/mctb/live-test (start test)

PASS: no sandbox-data imports in connected/mctb
Pages inventoried: 18
```

### 4. `npm run verify:mctb-stage2-demo-state`

**Exit code:** 0  

```
MCTB_CUSTOMER_VISIBLE_DEMO_STATE: 0
PASS verify:mctb-stage2-demo-state
```

### 5. Business line resolver unit test

**Command:** `npx tsx src/lib/mctb/resolve-workspace-business-line.test.ts`  
**Exit code:** 0  

```
resolve-workspace-business-line: ok
```

### 6. Git commit + push (audit deliverable)

```
git add (12 files — see “Files changed” below)
git commit -m "fix(mctb): Opus page wiring audit — real shell context and no demo fallbacks ..."
git push -u origin cursor/mctb-critical-path-perf-2304
# Push: 8557a333..f5f208ba
```

---

## Related commands from same branch (earlier in session — ingress / cert)

These were run while fixing pipeline verification and business-line display (not re-run at 21:01 UTC unless noted).

| Command | Result (summary) |
|---------|------------------|
| `npm run verify:mctb-final-pipeline` (default legacy DID) | **FAIL** — pointed at cert placeholder +18663464256 / stale cert=C stub |
| `npm run verify:mctb-final-pipeline` (workspace ingress +18666020680) | **PASS** after verifier default/env fixes |
| Live PSTN (user call ~2026-09-27 20:06 UTC) | Press-1 path, texml_mctb_ingress, SMS from +18666020680 — documented in session; not repeatable in cloud VM without your phone |

Verifier / docs touched on branch (separate commits): `scripts/verify-mctb-final-pipeline.ts`, `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`, `docs/MCTB-LAUNCH-CERTIFICATION-EXECUTION-2026-09-27.md`.

---

## Files changed in audit commit `f5f208ba`

| File | Purpose |
|------|---------|
| `src/lib/mctb/shell-context-data.ts` | Shared loader: business line resolver, sender E164, timezone |
| `src/app/api/mctb/shell-context/route.ts` | GET API for Opus chrome |
| `src/newui-transplant/context/opus-workspace-data.tsx` | Fetch shell-context; pass `senderE164` |
| `src/newui-transplant/components/app/app-sidebar.tsx` | No `BUSINESS` sandbox fallback |
| `src/newui-transplant/components/mctb/voicemail-browser.tsx` | Default `[]` not sandbox voicemails |
| `src/newui-transplant/connected/mctb/conversations-page.tsx` | Uses `useOpusWorkspaceData()` |
| `src/newui-transplant/connected/mctb/setup-pages.tsx` | Test checkpoints: messagingReady + openerSaved |
| `src/newui-transplant/connected/mctb/setup-wiring-hooks.ts` | `useMctbTestWiring` loads resolver + opener |
| `src/newui-transplant/lib/nav.ts` | Removed fake Inbox badge `4` |
| `scripts/audit-mctb-opus-page-wiring.ts` | Static inventory + connected scan |
| `docs/MCTB-OPUS-PAGE-WIRING-AUDIT.md` | Short audit reference |
| `package.json` | Script `audit:mctb-opus-page-wiring` |

(Also on branch from prior commits: `resolve-workspace-business-line.ts`, setup GET wiring, setup layout padding, verifier updates.)

---

## Runtime write map (UI → live MCTB)

| Route | Saves that affect live MCTB |
|-------|-----------------------------|
| Setup → Consent | `consentMode`, attestation → TeXML press-1 vs existing_consent |
| Setup → Text back | `messageTemplate` → recovery SMS body |
| Setup → Recovery | triggers, pause, cooldown, delay, max messages |
| Setup → Phone | carrier/ring, forwarding test (onboarding + setup) |
| Setup → Voicemail | greeting + voicemail trigger rules |
| Setup → Exclusions | exclusion list → eligibility |
| Setup → Links | `defaultLinkUrl`, request form |
| Setup → Notifications | handoff recipients |
| Setup → Test | `POST /api/mctb/live-test` |
| Missed calls list | row exclusion → exclusions API |
| Inbox `/mctb/conversations` | replies → SMS send path |
| AI Recovery | lead-recovery config |

Read-only: Overview, Analytics, Missed call detail, Consent history, Voicemail inbox list.

---

## What was NOT run in cloud VM

- Full browser walkthrough of every MCTB page (no authenticated production session in agent VM).
- Live Telnyx SMS / PSTN retest after `f5f208ba` (user-deferred; prior live call evidence on +18666020680).
- `npm run test:v1-production-readiness` (full cert gate).

---

## Re-run checklist (copy these commands)

```bash
cd /path/to/sms
git checkout cursor/mctb-critical-path-perf-2304
git pull

npm run audit:mctb-opus-page-wiring
npm run verify:mctb-stage2-demo-state
npx tsx src/lib/mctb/resolve-workspace-business-line.test.ts

# Optional: pipeline verifier (use workspace ingress, not legacy cert DID)
npm run verify:mctb-final-pipeline
```

---

## Artifact copy on disk (agent VM)

Plain terminal capture (same as section 3–5 output):

`/opt/cursor/artifacts/MCTB-OPUS-WIRING-AUDIT-RUN-LOG.txt`

This document (richer context):

`docs/MCTB-OPUS-WIRING-AUDIT-RUN-REPORT.md`
