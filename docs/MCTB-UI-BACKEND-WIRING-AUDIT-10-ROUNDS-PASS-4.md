# MCTB UI wiring audit — Pass 4 (rounds 31–40, functional bugs)

**Date:** 2026-09-30  
**Focus:** Settings → API → reload correctness (not error banners). Control-by-control traces on launch IA.

---

## Round 31 — Missed-call recovery usage stat

**Bug:** `/mctb/missed-call-recovery` read `capabilities.monthlyRecoveryUsed`; API exposes `monthlyRecoveriesUsed` (`capabilities.ts`, overview).  
**Effect:** “This month” stat never appeared when a monthly limit was configured.  
**Fix:** `mctb-ia-pages.tsx` — correct field; refresh usage on `mctb-setup-updated`.

## Round 32 — Setup overview trigger labels

**Bug:** `setup-overview-model.ts` swapped labels: `sendAfterRejected` → “Unreachable”, `sendAfterTimeout` → “Timeout”.  
**Canonical:** `TRIGGER_OPTIONS` — Rejected vs Unreachable (`setup-recovery-model.ts`).  
**Fix:** Align summary strings with runtime/editor labels.

## Round 33 — Recovery header vs tab editors (split brain)

**Bug:** `NewUiMctbMissedCallRecoveryPage` and embedded General/Rules each called `useMctbRecoveryWiring()`; pause/save on one tab did not update header stats until full refresh.  
**Fix:** Single hook on IA page; pass `recovery` into `NewUiMctbSetupRecoveryPage` / `NewUiMctbSetupMissedCallRulesPage`. `useMctbRecoveryWiring` listens for `mctb-setup-updated` for other surfaces.

## Round 34 — Conversations “Needs reply” vs KPIs

**Bug:** List used `unread && (open || pending)`; hydrated thread used `Open || Pending` without `unread`; overview/missed-calls KPI count `OPEN && unread` only.  
**Effect:** Wrong pills after thread load; filter could disagree with Home KPI.  
**Fix:** `mctbInboxNeedsReply()` in `mctb-conversations.ts`; server query `{ product: mctb, unread: true, status: open }` for Needs reply filter.

## Round 35 — Setup overview stale after saves elsewhere

**Bug:** Setup overview wiring only loaded on mount; recovery/rules/text-back saves did not refresh summary rows until navigation remount.  
**Fix:** `mctb-setup-updated` → `load()` in `mctb-setup-overview-wiring.ts`.

## Rounds 36–40 — Re-verified (no new code)

| Area | Result |
|------|--------|
| Phone / forwarding save | `saveMctbSetup` + onboarding POST; business line normalized |
| Consent mode + attestation | Blocks save without phone or attestation; maps `press_1` / `existing_consent` |
| Text-back save | Requires `phoneNumberId`; `recoveryGoal` + template on save |
| Trigger rules API | `triggerRules` camelCase ↔ `updateMissedCallTextConfig` |
| Handoff routing | `persistConfig` config-only; recipients via `save(override)` |
| Voicemail partial triggers | `triggerRules: { voicemail }` only |
| Analytics / missed-call detail | Read paths; no control→persist gaps found this pass |

---

## Fix IDs (master log)

42. Monthly recovery usage field name (`monthlyRecoveriesUsed`).  
43. Setup overview trigger label swap.  
44. Single recovery wiring on missed-call recovery IA page + setup-updated sync on hook.  
45. Needs reply domain alignment (inbox adapter + server filter).  
46. Setup overview refresh on `mctb-setup-updated`.
