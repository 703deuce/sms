# Call Handling Ownership Switch — Implementation Report

**Status:** Implementation complete (not merged / not deployed)

- **Draft PR:** https://github.com/703deuce/sms/pull/483
- **Branch:** `cursor/call-handling-ownership-switch-2304`
- **Starting SHA:** `315b7bb83259d101d6532a52fdf443125b91a379`
- **Final SHA:** `29c437c7fff6aabff30f49c68985254d8ab48081`

---

## 1–4. Architecture & files

**New ownership layer** (`src/lib/call-handling/`):

| File | Role |
|------|------|
| `set-active-call-handler.ts` | `setActiveCallHandler`, `loadCallHandlingOwnershipState` |
| `phone-settings.ts` | `settingsJson.callHandling` read/merge |
| `effective-handler.ts` | Telnyx verify → `mctb` vs `ai_receptionist` |
| `readiness.ts` | MCTB + AI readiness before switch |
| `publish-gate.ts` | Skip ingress routing when explicit `mctb` |
| `switch-lock.ts` | Per-DID serialized mutations |
| `initial-selection.ts` | First-time activate records handler without extra switch |

**API:** `src/app/api/call-handling/route.ts` (GET/PATCH)

**UI:** `src/components/call-handling/call-handling-switcher.tsx` (sidebar + header + overview card)

**MCTB non-destructive route:** `routePhoneToMctbCallHandlingIngress()` in `src/lib/mctb/texml-ingress/provision.ts`

**Gates:** `src/lib/voice/agent-service.ts`, `src/app/api/solutions/appointment-receptionist/route.ts`

No changes to `mctb-entry`, frozen TeXML runtime, LiveKit, or Voice V3 webhook/PSTN handlers.

---

## 5–7. Persistence & routing primitives

- **Persisted:** `phoneNumber.settingsJson.callHandling.activeCallHandler` (`mctb` | `ai_receptionist`), plus `parkedAiReceptionistAgentId`, `explicitSelectionAt`, audit fields.
- **MCTB:** `routePhoneToMctbCallHandlingIngress` → `routePhoneToMctbTexmlIngress` + telephony metadata; **does not** call `switchDidToMctbTexmlIngress` (no join/`voiceAgent.phoneNumberId` teardown).
- **AI:** `routePhoneToVoiceV3BasicCallControl` only. Static test asserts **no** `routePhoneToTexmlAssistant` in the switch module.

---

## 8–10. Association preservation

- **Switch to MCTB:** resolves inbound AI via `resolveInboundAiAgent`, stores `parkedAiReceptionistAgentId`, routes TeXML **without** deleting `VoiceAgentPhoneNumber` rows.
- **Switch to AI:** restores routing to V3 CC, `syncVoiceAgentPhoneAssignment` for parked/ready agent, updates `parkedAiReceptionistAgentId`.
- **`missedCallTextConfig.phoneNumberId`** is not cleared on AI ownership.

---

## 11–12. Publish / pause

- **Publish/save gates:** when `hasExplicitCallHandlingSelection` and `activeCallHandler === mctb`, `publishVoiceAgent` skips ingress routing **and** `syncVoiceAgentPhoneAssignment` (avoids MCTB lock takeover). Same policy in `syncLiveWizardDraftToProvider`.
- **Appointment receptionist:** `setInboundHandlingMode(VOICE_AGENT)` runs only if **no** explicit call-handling selection; first activate can `persistInitialCallHandlerIfUnset(ai_receptionist)`.
- **MCTB pause:** unchanged (no handler switch in this work).

---

## 13–17. Switch semantics

- Readiness errors → no Telnyx change, no persistence update.
- Order: readiness → provider route → verify effective → persist → return state.
- Rollback: restore prior `connection_id` on verify failure.
- Concurrency: `withCallHandlingSwitchLock` per `phoneNumberId`.
- Drift: `selectedHandler` vs `effectiveHandler` exposed when they disagree.

---

## 18–21. UI (source-level; no live browser cert in this pass)

- **Sidebar + header:** “Call handling” dropdown when `hasMctb && hasVoice` (replaces product switcher in that case).
- **MCTB Overview:** `CallHandlingDashboardCard` with Active label, manage link, Switch.
- Both use **`/api/call-handling`** (single source).

---

## 20. Tests

| Test | Result |
|------|--------|
| `scripts/test-call-handling-ownership.ts` | PASS |
| MCTB setup scripts (consent, phone-forwarding, links, notifications, exclusions, recovery, handoff, onboarding) | PASS |
| `test-mctb-final-pipeline-contract.ts` | PASS |
| `test-voice-v3-wizard-step7-v3-path.ts` | PASS |
| `npm run verify:mctb-final-pipeline` | **Live Telnyx rows failed** (wrong connection / demo TeXML on env) — pre-existing env, not fixed here |

---

## 23. Zero-loss statement (code evidence)

- Runtimes untouched; switch only changes Telnyx `connection_id` + `callHandling` metadata (+ minimal telephony flags for MCTB route).
- Destructive `switchDidToMctbTexmlIngress` **not** used for customer toggle.
- Publish no longer repoints DID when customer explicitly chose MCTB.

---

## 24–25. Still required after deploy

Live certification (5-call matrix): AI → switch MCTB → switch AI → repeat; MCTB paused → voicemail, no SMS, AI must not answer.

**Watch items:**

1. **AI ↔ DID while MCTB active** — parked agent ID + preserved joins; verify on first PSTN flip.
2. **Publish stealing the number** — gated when explicit `mctb`; verify with “publish AI while MCTB active” on staging.

**Risks:** `GET /api/call-handling` calls Telnyx to resolve effective handler (may be slow); overview/header hidden if workspace has no MCTB ingress phone (404). No production build run per spec §31.

---

## Spec cross-reference (sections 1–36)

This implementation addresses the strict pass goals:

- Thin layer above two working routes; no runtime merge.
- Provider-first switching with verification before DB persist.
- Non-destructive MCTB routing primitive.
- Voice V3 Basic only for AI (not legacy TeXML assistant / `setInboundHandlingMode` for toggle).
- Header + dashboard from same API.
- Focused tests + listed MCTB regressions (see table above).
- **Do not merge or deploy** until source review and live PSTN certification.
