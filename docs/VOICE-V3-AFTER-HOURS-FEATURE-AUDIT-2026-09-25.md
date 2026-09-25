# Voice V3 After-Hours Feature Audit (copy-friendly)

**Date:** 2026-09-25  
**Production web commit (at audit):** `d5675ca28b476d3a1a30ebe82fcab48b502f3106`  
**Scope:** AI after-hours receptionist (Voice V3 / Appointment Receptionist) vs competitor matrix (Smith.ai, My AI Front Desk, Goodcall).  
**Related docs:** `docs/VOICE-V3-POST-RECONCILIATION-COMPLETION-REPORT.md`, `docs/VOICE-V3-GAP-RECONCILIATION-REPORT.md`, `docs/VOICE-V3-TRANSFER-CERT-READINESS.md`, `docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`, `docs/MCTB-FINAL-PRODUCT-DIRECTION-AUDIT.md`

---

## Short answer

**Call-time Amy (Voice V3)** is largely implemented in the repo on `master` (including post-reconciliation): booking (Microsoft + Google path), intake, callbacks, transfers (direct/warm/waterfall in Python), spam/solicitor, on-call injection, notifications (Brevo email + SMS), post-call pipeline (summary, Deepgram fallback, webhooks, knowledge-gap persistence).

**Not yet “self-serve plumber on Google Ads without touching the account”** because:

1. Several items are **built but not PSTN-certified** (warm/waterfall transfer, Google live book, spam SCREEN on real carrier headers, recording → playback E2E).
2. Some **dashboard promises are thinner than the marketing matrix** (dedicated after-hours analytics page is a stub; knowledge gaps persist in DB with **no owner UI**; “morning digest” is not clearly a Voice V3 product surface).
3. **Ingress / product boundary:** MCTB conditional forwarding vs Voice V3 PSTN is still called out as a risk when flipping “AI answers” on the business number.

**MCTB “platform”** (shared TFN sender ownership) is a **separate** track—implemented on `master`, handset cert still pending—not the same as Voice V3 after-hours.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Wired in code on `master` |
| 🟡 | Built; needs live PSTN certification and/or external setup |
| 🟠 | Partial (backend vs UI, or formal cert incomplete) |
| ❌ | Not implemented |
| ⏭️ | Intentionally out of scope |

---

## Ingress and positioning

| Capability | Status | Notes |
|------------|--------|--------|
| Answer calls after business doesn’t answer (CFNA) | ✅ / 🟡 | MCTB forwarding is real; Voice V3 answers via `startAppointmentReceptionistVoiceV3OnCall` — verify **number → Voice V3** routing for go-live accounts |
| Business keeps existing number | ✅ | Product model; not port-required |
| Natural AI conversation (GPT-Live / Astra) | ✅ | LiveKit + tool catalog; model env-driven |
| Business-specific greeting | ✅ | Wizard → compiled agent config |
| Business hours / context | ✅ | Wizard + operating policy |
| Website auto-setup | ✅ | `src/lib/voice-v3/knowledge/website-crawl/*` + crawl jobs |
| Business knowledge / FAQs | ✅ | FileSearch RAG + wizard knowledge |
| Custom knowledge editing | ✅ | Wizard / knowledge editors |
| Knowledge-gap discovery | 🟠 | Post-call LLM candidates → `voiceKnowledgeGap` (`run-post-call-side-effects.ts`) — **no dedicated “gaps inbox” UI** in `src/app` yet |
| Custom intake | ✅ | `update_intake`, objective merge, Astra contracts |
| Remember volunteered information | ✅ | Intake state + `update_intake` |

---

## Conversation actions

| Capability | Status | Notes |
|------------|--------|--------|
| Take a message | ✅ | `take_message` tool (distinct from `request_callback`) |
| Request callback | ✅ | `request_callback` + persist + notifications |
| Book appointment live (Microsoft) | ✅ | Certified baseline frozen in `AGENTS.md` / known-good baseline |
| Book appointment live (Google) | 🟡 | Provider in repo; wizard blocks Calendly; **PSTN cert called out** |
| Find existing appointment | ✅ | `find_appointment` in tool catalog |
| Reschedule appointment | ✅ | `reschedule_appointment` (direct calendar strategy) |
| Cancel appointment | ✅ | `cancel_appointment` |
| Send booking link | ✅ | `send_booking_link` |
| SMS booking link | ✅ | Outbound SMS resolver + send path |
| Emergency identification | ✅ | Urgency + transfer auth; emergency notifications in `notify-transfer-outcome.ts` |
| On-call schedules | ✅ | `resolveActiveOnCallTarget` + `authorize-transfer.ts` |
| Overnight schedules / time zones | ✅ | Operating maturity / on-call + behavior gating |
| Direct transfer | 🟡 | Python transfer executor — **PSTN cert pending** |
| Warm transfer | 🟡 | `_warm_transfer` in `transfer_executor.py` — **PSTN cert pending** |
| Multiple-person waterfall | 🟡 | Waterfall in Python executor — **PSTN cert pending** |
| Human / no-answer / decline handling | 🟡 | Implemented in transfer path — **PSTN cert pending** |
| Voicemail handling during escalation | 🟡 | Hardened in transfer design — **PSTN cert pending** |
| Failed-transfer fallback | ✅ | `transferFallback` in wizard + executor |
| Emergency notifications | ✅ | Email/SMS via Brevo + `sendQuickSms` |
| Spam Likely carrier blocking | 🟡 | SCREEN hint when Telnyx header + trunk mapping present (`voice-v3-livekit.ts`) |
| Solicitor detection / decline | ✅ | `report_unwanted_solicitor` + policies |
| Manual caller blocklist | ✅ | `spam-protection/*`, APIs, `VoiceCallerBlock` |
| Native end-call | ✅ | `end_call` in catalog |

---

## Post-call and dashboard

| Capability | Status | Notes |
|------------|--------|--------|
| Recording | 🟠 | `start-telnyx-recording.ts`; **call-history cert: recording E2E NOT PROVEN** on real dual-channel ingest |
| Transcript | ✅ | Native LiveKit materialization + Deepgram fallback (`post-call-pipeline.ts`) |
| Post-call AI summary | ✅ | `ensureCallHistorySummary` |
| Immediate email call summary | ✅ | `notifyVoiceV3CallCompleted` → Brevo (`post-call.ts` for appointment-receptionist) |
| Calls Inbox | ✅ | `/voice/calls` |
| Full Call Detail | ✅ | `/voice/calls/[id]` — API-backed |
| Listen to recording | 🟠 | UI exists; **E2E recording ingest not certified** |
| Read transcript | ✅ | Detail page + segments API |
| Call outcome / history | ✅ | `derive-call-outcome`, badges, events |
| Analytics (general) | 🟠 | `loadVoiceAnalytics` API; `/voice/analytics` **redirects to MCTB analytics** |
| After-hours analytics page | ❌ / 🟠 | `/voice/analytics/after-hours` is a **stub** |
| Cross-product reports | 🟠 | `/voice/reports` — optional Voice AI metrics toggle |
| Call-volume analytics | ✅ | API (`loadVoiceAnalytics`) |
| Outcome analytics | ✅ | API outcomes breakdown |
| Emergency / transfer analytics | 🟠 | Transfer counts in API; not a dedicated after-hours dashboard |
| Common reasons for calling | 🟠 | Partial via insights / outcomes — not full “reasons” product |
| Needs-attention calls | 🟠 | Notifications + outcomes; not unified after-hours attention queue |
| Knowledge-gap analytics | ❌ / 🟠 | DB persistence only — **no analytics UI** |
| Generic outbound webhooks | ✅ | `emitVoiceV3PostCallWebhooks` on call-history completion |
| Morning / after-hours digest | ❌ / 🟠 | Generic `notification_digest` job exists; **no Voice-specific morning digest** in wizard/notifications |
| English / Spanish conversation | ✅ | Native model behavior (not a separate Transovo module) |

---

## Transfer / on-call system (emphasis)

**In code — strong vs generic “transfer the caller”:**

| Layer | Location |
|-------|----------|
| Wizard | `EmergencyTransferEditor`, `transfer-wizard-state.ts` — waterfall, warm/direct per step, ring timeouts, fallback |
| Runtime auth | `authorize-transfer.ts` — on-call schedule merged into destinations, after-hours gating |
| Execution | `voice-runtime-python/.../transfer_executor.py` — waterfall, warm consult |
| Staff alerts | `record-voice-v3-transfer-outcome-for-python.ts` → `notifyVoiceV3TransferOutcome` |

**Not done:** PSTN proof on real after-hours calls (DIRECT / WARM / WATERFALL / exhausted) per `docs/VOICE-V3-TRANSFER-CERT-READINESS.md`.

---

## Post-call pass (recording / transcript / summary / email)

**Landed on `master`:**

```
runVoiceV3CallHistoryPostProcess
  → summary
  → async runVoiceV3PostCallSideEffects (webhooks + knowledge gaps)
  → optional AI recovery SMS
```

**Gaps vs mature answering-service parity:**

- Recording **playback E2E** — formal cert **FAIL** until staging PSTN produces `VoiceRecording` (`docs/VOICE-V3-CALL-HISTORY-CERTIFICATION-REPORT.md`).
- Knowledge gaps — conservative post-call model (no auto-learn from callers) — **no owner-facing gaps UI** yet.

---

## Spam pass

| Item | Status |
|------|--------|
| `report_unwanted_solicitor` | ✅ |
| Blocklist + publish hooks | ✅ |
| Carrier Spam Likely (SCREEN) | 🟡 — conditional on Telnyx screening metadata + trunk mapping |
| DECLINE/SCREEN on live PSTN | 🟡 — treat as cert pending |

---

## Scheduling (vs market minimum)

Transovo has: book directly, find, reschedule, cancel, send booking link, take message, request callback.

| Item | Status |
|------|--------|
| Microsoft live book | ✅ (certified baseline — do not regress FIND/BOOK without re-cert) |
| Google live book | 🟡 built, needs PSTN cert |
| Calendly V3 live book | ❌ wizard **blocks** activation |
| REQUEST_ONLY / SEND_LINK | ✅ |

---

## MCTB platform sender (separate from Voice agent)

| Product | Status |
|---------|--------|
| MCTB platform sender (`MctbPlatformSenderAssignment`, shared TFN) | ✅ Engineering on `master` |
| Handset / ACTIVE_ASSIGNMENT / collision cert | 🟡 Pending — do not rely on legacy resolver for production proof |
| AI after-hours receptionist (Amy) | ✅ Feature stack in repo; PSTN + recording + transfer cert before paid acquisition |

Shared: SMS/consent infra. **Do not conflate** in ops or marketing.

---

## Intentionally absent (matches product direction)

| Item | Status |
|------|--------|
| Human backup call center (Smith-style live agents) | ⏭️ |
| Payments on call | ⏭️ optional later (Text-to-Pay) |
| Huge integration catalog | ⏭️ — webhooks as escape hatch |
| Outbound AI calling campaigns | ⏭️ |
| Full daytime front-office replacement | ⏭️ |
| Post-call SMS “thanks, we’ll follow up tomorrow” (Smith-style) | ⏭️ — foundation exists (MCTB/SMS); not productized as Voice follow-up |

---

## One feature to watch later

**Customer follow-up after the call** (SMS/email based on call criteria):

- Not required for V1 after-hours receptionist.
- Natural extension later: existing SMS, consent, booking-link SMS, MCTB — **not a missing foundation**.

---

## Market comparison summary (after passes)

For: *“Keep your business number. When you don’t answer after hours, Amy takes over.”*

| Area | Verdict |
|------|---------|
| Answering, natural conversation, FAQs, intake, messages, callbacks | ✅ in code |
| Appointments | ✅ MS strong; 🟡 Google; ❌ Calendly V3 |
| Emergency + on-call dispatch | ✅ code; 🟡 PSTN cert |
| Transfers (warm/waterfall) | ✅ code; 🟡 PSTN cert |
| Spam / solicitors | ✅ mostly; 🟡 carrier SCREEN cert |
| Recording / transcript / summary / email | 🟠 recording E2E; rest ✅ |
| Call history UI | ✅ |
| Analytics / digest / knowledge-gap UI | 🟠 thinner than sales matrix |
| Human backup, payments, integration catalog | ⏭️ intentional |

**Engineering conclusion:** Feature set is **substantially complete in software**; **commercial conclusion:** Stop major feature builds and **certify reliability** (PSTN matrices + fix/hide stub surfaces).

---

## Recommended go/no-go certification checklist

1. One **after-hours PSTN** call: FAQ → intake → callback **or** Microsoft book.
2. One **emergency** → on-call **waterfall** → warm handoff → staff notifications received.
3. One **spam/solicitor** path (DECLINE or SCREEN with real carrier header).
4. One call with **recording enabled** → transcript → summary → **email** → call detail UI + playback.
5. Confirm **post-call webhook** fires (if configured) + optional **AI recovery SMS** on a flagged scenario.
6. Fix or hide **stub** `/voice/analytics/after-hours` before customer-facing nav exposes it.
7. Ship **knowledge-gap owner UI** (or expose gaps on call detail) so “self-healing FAQs” is owner-operable.

---

## Key code pointers (quick audit trail)

| Area | Path |
|------|------|
| Post-call pipeline | `src/lib/voice-v3/call-history/post-call-pipeline.ts` |
| Webhooks + knowledge gaps | `src/lib/voice-v3/post-call/run-post-call-side-effects.ts` |
| Notifications (Brevo/SMS) | `src/lib/voice-v3/notifications/*` |
| Transfer auth + on-call | `src/lib/voice-v3/transfer/authorize-transfer.ts` |
| Transfer execution | `voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py` |
| Spam / screening | `src/lib/voice-v3/spam-protection/*`, `voice-v3-livekit.ts` |
| Tool catalog | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| Calls UI | `src/app/(app)/voice/calls/` |
| Voice analytics API | `src/lib/voice/analytics.ts`, `src/app/api/voice/analytics/route.ts` |
| Website crawl | `src/lib/voice-v3/knowledge/website-crawl/` |

---

## Bottom line

- **Substantial after-hours product in software?** **Yes** — especially transfer/on-call, Microsoft scheduling, notifications, post-call pipeline.
- **Safe to claim “nothing major missing” vs Smith on a sales page?** **Almost** — footnote recording E2E, transfer PSTN cert, Google book cert, knowledge-gap UI, analytics/digest surfaces.
- **Transfer held?** **Yes in implementation; not in certification.**
- **Platform (MCTB sender) held?** **Yes in implementation; not in handset cert.**

At that point the right question is: *Does every row work reliably enough to put money behind Google Ads and send a plumber/HVAC/electrician/roofer/lawyer through onboarding without hand-holding?* — **Feature-wise, basically yes; ops-wise, cert first.**
