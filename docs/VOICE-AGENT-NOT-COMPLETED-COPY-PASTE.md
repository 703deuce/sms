# Voice Agent (Appointment Receptionist / Voice V3) — NOT COMPLETED inventory

**Copy-paste reference.** Generated from repo state on branch `cursor/voice-v3-gap-closure-2304` (post gap-closure, commit `3e16d2b5`).

**Product scope:** After-hours **Appointment Receptionist** wizard → LiveKit + GPT-Live (Amy) + Astra tools.  
**Not this list:** MCTB, Mass SMS, Smart Routing, Fax (separate products).

**Wizard manifest today:** `CONFIGURED_NOT_IMPLEMENTED` = **0** (all customer controls are either active, control-plane-only, prompt-only, or intentionally unsupported).  
**“Not completed” below** = deferred features, partial runtime, ops/sign-off, or out-of-scope product — not the old 104-row manifest NI bucket.

---

## 1. Intentionally unsupported or hidden (V1)

| Item | State path / area | What’s missing |
|------|-------------------|----------------|
| **Calendly live scheduling on Voice V3** | `calendlyEventTypeUri`, `calendlyEventTypeName`, `calendlyEventTypeDurationMin`, `calendlyTimezone` | No `voice-v3/calendar` Calendly FIND/BOOK. Manifest: `INTENTIONALLY_UNSUPPORTED`. Wizard calendar step shows **Microsoft + Google only** (Calendly hidden). Legacy Calendly state may still exist in DB. |
| **CRM on calls** | `crmEnabled` | No V3 CRM tools / sync. Manifest: `INTENTIONALLY_UNSUPPORTED`. |

---

## 2. Code gaps (product promises not fully built)

| # | Area | Gap | Severity |
|---|------|-----|----------|
| 1 | **Commercial billing** | No Stripe **Voice V3 LiveKit usage meter** / SKU wiring tied to egress minutes or call duration. `/voice/billing` is not a complete V3 meter story. | P1 commercial |
| 2 | **Per-service booking hours** | `appointmentTypes[].bookingHours` → `services[].bookingHoursProse` compiles but **slot generator does not enforce** per-type hours (only workspace weekly `businessHours` + holidays). | P1 |
| 3 | **Long-term caller memory** | `longTermMemory` compiles to `integrations.longTermMemory` but **no Voice V3 runtime** recalls prior callers across calls (control-plane flag only). | P1 |
| 4 | **Multi-calendar selection** | V3 defaults to env/`primary` calendar id. **No wizard picker** for secondary calendars per agent or per appointment type calendar field at FIND/BOOK. | P2 |
| 5 | **Business auto-import** | No verified end-to-end **website crawl → auto-fill wizard** pipeline for Voice V3 (URL + manual KB / hot context only). | P2 |
| 6 | **RAG (GPT Live One + LiveKit)** | **Implemented:** website/KB ingest → OpenAI vector store (`gpt-live-file-search-rag.ts`) → LiveKit `FileSearch` on `GPTLiveModel` delegation (`session.py`). Telnyx RAG skipped when `OPENAI_API_KEY` is set (opt back in with `VOICE_KNOWLEDGE_TELNYX_RAG=1`). **Remaining:** PSTN proof after website scan + vector store ready; multi-page crawl still single-page fetch unless extended. | Manual cert |
| 7 | **SLA “operations” maturity** | `operatingMaturity.sla` (non-callback) — **no dedicated executor** beyond callback SLA metadata. | P2 |
| 8 | **Quality studio → publish** | `qualityStudioLastRun` is control-plane; **publish hard-block** only when `VOICE_V3_PUBLISH_REQUIRE_TEST_PASS=1` (optional env), not default product gate. | P2 |
| 9 | **Legacy OAuth cleanup** | Duplicate `src/lib/voice/calendar/oauth.ts` vs canonical `src/lib/calendar/oauth.ts` — **tech debt**, not customer feature. | P2 |
| 10 | **Contact-center ops** | **Real-time supervisor wallboard**, monitor/whisper/barge — **not built** (ops pages are partial / cert-oriented). | P2 / deferred |
| 11 | **Generic AI receptionist** | `/voice/agents` builder, flows, campaigns — **deferred V1** (hidden nav); not Appointment Receptionist V3. | INTENTIONAL deferral |
| 12 | **Voice V2 Telnyx assistant path** | Preserved legacy after-hours; **not** the forward V3 wizard path. Parity/maintenance only. | INTENTIONAL preserve |

---

## 3. Partially done (code exists; limits remain)

| Area | Done | Not done |
|------|------|----------|
| **Google Calendar** | Provider modules under `src/lib/voice-v3/calendar/google/`, compile `GOOGLE_CALENDAR` on this branch | **Google Cloud OAuth app verification**, production tenant **PSTN find/book/manage sign-off** |
| **On-call routing** | On-call destinations injected in `authorize-transfer` when schedule matches | Not full PBX-style rotation UI guarantees; edge cases need live transfer testing |
| **Transfer waterfall** | `transferRouting: waterfall`, `transferPlanSteps` compile; telemetry fields exist | **PSTN multi-step waterfall** needs handset certification per transfer directive |
| **After-hours policy** | `effective-tool-authorization` + `gateCapabilitiesForOperatingState` gate book/callback/transfer/message | Policy is **tool-level**, not a separate “after-hours executor” UI story; complex closures need PSTN validation |
| **Qualification / urgency** | `evaluateVoiceV3Qualification`, `evaluateVoiceV3Urgency`, tool blocks | Rule coverage and **live call** proof for every wizard rule combination |
| **Booking behavior toggles** | Astra instructions + `offerEarliestThree` in `booking-presentation`; `confirmBeforeBooking` in verbal-confirmation | Not every toggle has a **hard executor** guard (mostly prompt + selective gates) |
| **AI call recovery SMS** | `post-call/ai-call-recovery-sms.ts` when `recovery.*` enabled | **Press-1 / consent parity** with MCTB not applicable; live SMS proof on your numbers |
| **Callback SLA overdue** | Cron `voice_v2_callback_sla_overdue_scan` + `voiceV2CallbackSla` metadata on V3 persists | Job name/path is V2-branded; verify **all** V3 callback rows get correct SLA metadata in prod |
| **Call forensics** | Most tools log executions | **Some LiveKit legs** may still lack complete `voiceCall` + tool trace rows (see transfer/cancel forensics audits) |

---

## 4. Wizard fields with no live call effect (by design)

**`CONTROL_PLANE_ONLY` (19)** — saved for UI, routing, or publish; **not** read as runtime behavior on the call:

- `answerWhen`, `solutionName`
- `numberSource`, `ringBehavior`, `ringTeamSeconds`
- `voiceLabel`, `voiceSource`, `openAiCustomVoiceId`
- `testScenario`, `lastTestPassed`
- `activationMode`, `scheduledAt`
- `longTermMemory` (flag stored; see §2 #3)
- `qualityStudioLastRun`
- `agentId`, `setupId`, `outcomeSlug`, `preset`, `telnyxAssistantId`

**`LIVE_PROMPT_CONTROL` (5)** — affect GPT-Live instructions only (no deterministic backend):

- `speakingPace`, `voiceAccent`, `backchannelLevel`, `callerPausePatience`, `interruptionStyle`

---

## 5. Manual production certification (not “missing code”)

You must still run on **real PSTN / production workspace** (code can be DONE in repo):

| Check | Notes |
|-------|--------|
| Inbound PSTN → LiveKit → Amy answers | SIP, media, interruption under latency |
| Microsoft **find → book → find → reschedule → cancel** | Regression-sensitive frozen path |
| Google **find → book → manage** | OAuth + calendar on your tenant |
| **SEND_LINK** SMS received | Consent + sender |
| **REQUEST_ONLY** / `submit_appointment_request` | No calendar mutation |
| **transfer_call** to real handset | Warm/cold, failure paths |
| **request_callback** + staff notifications | Required fields |
| **take_message** | Message recorded for staff |
| **search_business_knowledge** | Linked KB indexed and enabled |
| Post-call **recording, transcript, summary, email/webhook** | Egress + Deepgram + Brevo |
| Spam/solicitor + blocklist on real carrier labels | `spam_likely` header when available |
| After-hours matrix (closed → callback only, etc.) | Real calls outside business hours |
| Wizard **publish → next call** picks up config | Republish behavior |

Docs: `docs/V1-PRODUCTION-CERTIFICATION.md` (V1 scope note: matrix is MCTB/Fax-heavy), Voice V3 transfer/callback cert reports under `docs/VOICE-V3-*`.

---

## 6. Automated gates you can run (repo)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-manifest-coverage.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-compiler.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-operating-policy-gating.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-qualification-urgency.ts
```

These prove **compile + policy units**; they do **not** replace PSTN certification.

---

## 7. Stale docs (do not use as NI source)

These were written **before** gap-closure pass `3e16d2b5` and still mention **104 `CONFIGURED_NOT_IMPLEMENTED`** rows or “RAG not in catalog”:

- `docs/AI-VOICE-AGENT-GAP-REGISTER.md` (header counts)
- `docs/AI-VOICE-AGENT-FEATURE-STATUS.md` §13 “Known gaps” table
- `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md` §1 auto-export (regenerate with script in that doc)

**Current manifest truth:** `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-REPORT.md`

---

## 8. One-line summary

**Wizard→runtime contract:** closed in code (`CONFIGURED_NOT_IMPLEMENTED` = 0).  
**Still not “completed product”:** Calendly + CRM (unsupported), billing meter, per-type booking hours enforcement, long-term memory runtime, multi-calendar UX, business auto-import, contact-center wallboard, full PSTN/provider certification, and optional Google OAuth production sign-off.

---

*End of file — safe to copy entire contents.*
