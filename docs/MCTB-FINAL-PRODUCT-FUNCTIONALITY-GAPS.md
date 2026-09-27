# MCTB final product functionality — gap matrix

**Status:** In progress (gap-closing pass)  
**Baseline:** Commit `7c97075f` deployed; Sept 27 production Opus browser smoke (17/17 routes, real data). **Preserve baseline — do not rebuild pages or parallel config systems.**

**P0 fix in this pass:** `/mctb/missed-calls/[id]` returned “Missed call not found” for real list rows → hardened `loadMctbMissedCallDetailPayload`, workspace-scoped load, resilient sub-queries, conversation by `missedCallEventId`.

**Out of scope this pass:** PWA `manifest.webmanifest` / `sw.js` 404s; cosmetic save toasts.

**Not launch certification:** UI smoke PASS ≠ commercial launch complete (no live STOP/HELP, send-from-inbox, usage limits, urgent AI, etc. in smoke).

---

## Summary flags (updated as gaps close)

| Area | Status |
|------|--------|
| MCTB_PLATFORM_TEMPLATE_POLICY | PARTIAL → in progress (runtime + GET + Text Back UI lock) |
| MCTB_COOLDOWN_UI_RUNTIME | PARTIAL (UI + save; runtime consumes `cooldownMinutes` — verify in matrix row) |
| MCTB_MISSED_CALL_DETAIL | PARTIAL → fix landed this pass; needs prod re-test |
| MCTB_REPLY_EMAIL_NOTIFICATIONS | PARTIAL (handoff matrix exists; verify `caller_replied` delivery) |
| MCTB_URGENT_AI_CLASSIFIER | MISSING / DEFERRED |
| MCTB_WORKSPACE_INGRESS_PROVISIONING | PARTIAL (audit provisioning lib) |
| MCTB_END_TO_END_FUNCTIONALITY | MISSING (launch cert matrix §38 not run) |

---

## Gap table

| Feature | Backend | Persistence | Runtime consumer | Opus UI | UI editable | Runtime verified | Gap | Action |
|---------|---------|-------------|------------------|---------|-------------|------------------|-----|--------|
| Pure Opus Stage 2 shell | Yes | — | — | Yes | — | Smoke PASS | COMPLETE | Preserve |
| Missed calls list | Yes | DB | Yes | Yes | Filters | Smoke PASS | COMPLETE | Preserve |
| **Missed call detail** | Yes | DB | Yes | Yes | Read-only | **Was FAIL** | **PARTIAL** | **Fixed loader + API; re-test prod rows** |
| Conversations / inbox | Yes | DB | SMS pipeline | Yes | Composer | Smoke (no send) | PARTIAL | Verify send + entitlement |
| Platform sender template lock | Partial | `senderMode` | **Now `resolveMctbRecoveryOpenerTemplate`** | Text Back | Locked when PLATFORM | Needs PSTN/SMS | PARTIAL | Finish composer policy |
| Customer-owned sender / TFN / 10DLC | Yes | Numbers/A2P | send path | Setup/Numbers | Partial | Not in smoke | PARTIAL | Audit upgrade path |
| Recovery delay | Yes | `delaySeconds` | eligibility | Setup → Recovery | Yes | Not re-tested | PARTIAL | Setting test §37 |
| Cooldown | Yes | `cooldownMinutes` | eligibility | Recovery dropdown | Yes (expanded options) | Not re-tested | PARTIAL | Prove inside/outside window |
| Pause / resume | Yes | schedule | recovery_paused | Setup + Recovery | Yes | Not in smoke | PARTIAL | Test pause semantics |
| Notifications / handoff | Yes | `/api/mctb/handoff` | jobs | Setup → Notifications | Yes | Not verified | PARTIAL | Map events to runtime |
| Reply email on customer reply | Partial | handoff | ? | Notifications matrix | Toggle | Not verified | PARTIAL | Trace `caller_replied` |
| Urgent AI + business SMS alert | Missing/Partial | — | — | — | — | No | MISSING | Spec §13–17 |
| Exclusions | Yes | exclusions API | eligibility | Setup + row action | Yes | Not in smoke | PARTIAL | Runtime proof |
| Consent Press-1 / existing | Yes | setup + TeXML | frozen pipeline | Setup → Consent | Yes | Smoke PASS | COMPLETE | Preserve TeXML |
| Text Back opener (workspace) | Yes | `messageTemplate` | send | Text Back | Yes | Smoke PASS | COMPLETE | — |
| Voicemail | Yes | voicemail API | TeXML | Inbox + setup | Yes | Empty inbox OK | PARTIAL | existing_consent path |
| Setup Test / live test | Yes | live-test API | ingress | Setup → Test | Start test | Not started in smoke | PARTIAL | Real chain test |
| Usage / free 25 | Partial | billing? | ? | ? | ? | No | MISSING | Audit entitlement source |
| Ingress auto-provision | Partial | workspace | onboarding | Phone | — | Smoke shows 866 ingress | PARTIAL | Document lifecycle |
| STOP/HELP | Yes | suppression | send gates | — | — | Not in smoke | PARTIAL | §38 matrix |
| AI Recovery | Yes | lead-recovery config | SMS AI path | `/mctb/ai-recovery` | Yes | Smoke PASS | PARTIAL | Out of urgent scope |

---

## This pass — code changes (initial)

| Item | Files / API |
|------|-------------|
| Missed call detail | `src/lib/mctb/missed-call-detail-load.ts`, `src/app/api/mctb/missed-calls/[id]/route.ts`, Opus detail page, adapter `businessE164` + message direction |
| Platform template | `resolveMctbRecoveryOpenerTemplate`, `send.ts`, setup GET overlay, `text-back-editor.tsx` locked UI |
| Cooldown UI options | `setup-pages.tsx`, `setup/recovery/page.tsx` |

---

## Verification commands (after changes)

```bash
npm run verify:mctb-stage2-presentation
npm run verify:mctb-stage2-demo-state
npm run audit:mctb-opus-page-wiring
```

---

## Next tranches (same pass, not done yet)

1. Re-run production browser on missed-call detail (multiple row IDs).  
2. Handoff: confirm `caller_replied` email path + document.  
3. Urgent reply alerts (AI classifier, tester, conversation badge, entitled SMS).  
4. Usage limit + customer-visible quota UI.  
5. Ingress provisioning audit + honest failure states.  
6. Full §38 functional matrix (manual / scripted).
