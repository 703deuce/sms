# Voice V2 wizard — backend wiring certification

**Date:** 2026-09-16  
**Scope:** Backend / configuration / runtime wiring only (no Playwright customer-path cert in this pass).  
**Agent ID:** `cmshz2lc25c622c4i58303501`  
**Production health SHA:** `bd5dc547ab686f3ae1bc0c48a7ab95d3cb66aeab` (includes PR #386 TeXML publish + PR #387 hydrate + H1 title sync)  
**571 test DID (last 4):** `3615` — `VOICE_AGENT`, TeXML → Telnyx Assistant  
**Ready for manual frontend test:** **YES** (line attached via API; user performs UI + PSTN)

---

## 1. Routing (hard invariant)

| Check | Status | Notes |
|-------|--------|-------|
| Voice Agent path | **PASS** | `routePhoneToTexmlAssistant` on publish + `syncLiveWizardDraftToProvider` for live wizard saves |
| LiveKit provision on wizard publish | **SKIP** | `shouldSkipLiveKitProvisionForMctbPhone(..., { appointmentWizard: true })` |
| MCTB vs Voice Agent ownership | **PASS** | `PATCH /api/mctb/inbound-handling` → `setInboundHandlingMode` in `switch-mode.ts` |
| Save must not flip to MCTB | **PASS** | Appointment save does not call MCTB mode switch; merge-on-save per step |
| Activate must refresh TeXML | **PASS** | `publishVoiceAgent` routes TeXML when `appointmentReceptionistWizard` present |

**TeXML path (production API setup):**  
`+15714073615 → TeXML 3049047658506225103 → assistant assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6 (direct)`

---

## 2. 571 test line (API attach — no PSTN)

| Field | Value |
|-------|--------|
| Last 4 | `3615` |
| `phoneNumberId` | `cmsgtjms84g6l2h0o255w1e3v` |
| Assigned agent | `cmshz2lc25c622c4i58303501` |
| `inboundHandlingMode` | `VOICE_AGENT` |
| `voiceTexmlAppId` | `3049047658506225103` |
| Agent status | `ACTIVE` |
| Telnyx assistant | configured |
| Published revision | `cmu47dlvl1q486s662t590g2j` |

Script: `node scripts/wizard-571-voice-line-api-setup.mjs`

---

## 3. Wizard field wiring (27-control inventory)

**Source of truth:** `scripts/wizard-control-inventory.json` — **exactly 27 rows** (one row per control; no extra matrix lines).

**Legend (Voice V2 PSTN / MCTB wizard):**

| Status | Meaning |
|--------|---------|
| **CONNECTED** | UI (where shown) → step merge → `buildWizardAgentConfig` → publish → **Voice V2 One-Amy PSTN** consumer (`src/lib/voice-v2/*`, V2 Telnyx tools on GENERAL node) |
| **NOT_STARTED** | May persist/publish to legacy config, but **not** a certified V2 PSTN runtime capability (`docs/VOICE-V2-HARDENING-REPORT.md`) |
| **NOT_APPLICABLE** | Not exposed on MCTB wizard surface |

**Per-page row counts:** Purpose 3 · Phone 4 · Business Knowledge 8 · Booking 5 · Call Handling 2 · Voice 2 · Test 1 · Activate 2 → **27**.

| Page | Control | Persisted | Published | Runtime consumer | V2 connected | Notes |
|------|---------|-----------|-----------|------------------|--------------|-------|
| Purpose | Agent name | `solutionName` | wizard snapshot, dynvars | Shell title, Layer B, setup | **YES** | H1 sync (`bd5dc547`) |
| Purpose | Capability cards | `capabilities` | advanced + workflow | V2 capability / booking gates | **YES** | — |
| Purpose | When should this agent answer | `answerWhen` | `inboundRules` | Answer mode / routing context | **YES** | — |
| Phone | Number source cards | `numberSource` | wizard snapshot | Assignment UX | **YES** | — |
| Phone | Transovo number list | `phoneNumberId` | agent + inbound block | TeXML route, inbound mode API | **YES** | 571 API attach |
| Phone | Outbound SMS mode | `outboundSmsMode` | `messaging` | SMS transport | **N/A** | Not on MCTB phone step |
| Phone | Call recording | `callRecording` | `compliance` | Recording disclosure | **YES** | Shown on phone step |
| Business Knowledge | Business name | `businessName` | Layer B / dynvars | V2 knowledge Layer B | **YES** | — |
| Business Knowledge | Website URL | `websiteUrl` | knowledge advanced | KB / scan | **YES** | — |
| Business Knowledge | Knowledge source cards | `knowledgeSource` | knowledge advanced | RAG eligibility | **YES** | — |
| Business Knowledge | Knowledge items / FAQs | `knowledgeItems` | knowledge + prompt | Layer B, `voice_v2_search_knowledge` | **YES** | — |
| Business Knowledge | Agent display name | `agentName` | identity + prompt | Persona / greeting | **YES** | — |
| Business Knowledge | Opening greeting | `openingGreeting` | `callHandling.greeting` | Telnyx assistant greeting | **YES** | — |
| Business Knowledge | Timezone | `timezone` | dynvars | Booking / display TZ | **YES** | — |
| Business Knowledge | Long-term memory | `longTermMemory` | `advanced.memory` | Memory config | **YES** | — |
| Booking | Calendar provider cards | `calendarProvider` | `voiceV2Calendly` / Microsoft | Provider selection | **YES** | — |
| Booking | When someone wants an appointment | `bookingStrategy` | `bookingStrategy`, `voiceV2PstnLiveBooking` | V2 workflow + tool set | **YES** | Headless strategy tests |
| Booking | Send link URL | `bookingLinkUrl` | `bookingLink` | `voice_v2_send_booking_link` | **YES** | — |
| Booking | Caller collect fields | `collectFields` | `voiceV2Intake`, `callerFields` | Intake schema + save tools | **YES** | Bridge tests |
| Booking | Qualification enabled | `qualification*` | `qualification` advanced | Layer B + evaluator | **YES** | — |
| Call Handling | Transfer destination phone | `transferDestinationPhone` | `transfers.destinationPhone`, `transferPolicy` | Legacy Telnyx **HUMAN** node `transfer` tool only | **NOT_STARTED** | Hidden on MCTB UI; not V2 PSTN |
| Call Handling | Transfer triggers | `transferTriggers` | `transfers.triggers`, system prompt lines | Legacy prompt / HUMAN routing | **NOT_STARTED** | Hidden on MCTB UI; not V2 PSTN |
| Voice | Voice picker | `voiceId` | `voiceLanguage` | Telnyx assistant TTS | **YES** | — |
| Voice | Speaking speed | `speakingSpeed` | `voiceLanguage.speed` | TTS timing | **YES** | — |
| Test | Test scenario / run test | `lastTestPassed` | readiness flags | Activation checklist | **YES** | No PSTN in backend cert |
| Activate | Activation mode | `activationMode` | publish action | Lifecycle | **YES** | — |
| Activate | Publish / Activate | POST `activate` | `publishVoiceAgent` | ACTIVE + Telnyx + TeXML | **YES** | #386 |

**Totals (27 inventory rows):** **24 CONNECTED** · **1 NOT_APPLICABLE** · **2 NOT_STARTED** · **0 DEAD**

### Transfer / urgency (explicit)

| Wizard field | Persists? | Publishes to | Voice V2 One-Amy PSTN runtime |
|--------------|-----------|--------------|-------------------------------|
| `transferDestinationPhone` | Yes (`call-handling` merge) | `draftConfig.transfers`, `receptionistAdvanced.transferPolicy`, Telnyx workflow **HUMAN** node when `toolIds.transfer` set | **No** — hardening report: transfer/urgency **NOT_STARTED** in `voice-v2`; One-Amy GENERAL node uses V2 tools only (`conversation-workflow.ts` `v2ToolIds`). `transfer_available` dynvar comes from legacy `call-session-context.ts`, not V2 session execution. |
| `transferTriggers` | Yes | `transfers.triggers`, `buildSystemPrompt` lines | **No** — prompt-only on legacy path; not V2 transfer product. |

**MCTB UI:** Human transfer block is **hidden** (callout only) so PSTN testers are not told transfer is wired for V2. Warm transfer remains legacy-only on non-MCTB wizard.

**Not in inventory (informational only):** `warmTransfer` / `detectVoicemailOnTransfer` — legacy wizard controls, not separate inventory rows.

---

## 4. Booking strategy matrix (headless)

Verified via `scripts/test-voice-v2-wizard-booking-strategies.ts` + `buildVoiceV2CallCapabilitySnapshot`:

| Strategy | FIND | BOOK | Send link | `voiceV2PstnLiveBooking` |
|----------|------|------|-----------|---------------------------|
| NONE | off | off | off | false |
| REQUEST_ONLY | off | off | off | false |
| SEND_LINK | off | off | on | false |
| MICROSOFT_365 | on | on | off | true |
| CALENDLY | on | on | off | true |

---

## 5. Tool eligibility

Authoritative: `resolveVoiceV2BookingStrategy` + `buildVoiceV2CallCapabilitySnapshot` + Telnyx workflow compile (`conversation-workflow.ts`).  
REQUEST_ONLY / NONE / SEND_LINK must not expose FIND/BOOK on V2 workflow nodes (verified in capability tests).

---

## 6. Custom fields

Path: `collectFields` → `wizardCollectFieldsToVoiceV2Intake` → `compileVoiceV2IntakeSchema` → runtime intake tools.  
Covered by `test-wizard-advanced-bridge.ts` (custom field key + requirement levels).

---

## 7. Qualification

Path: `qualificationConfigFromWizard` → advanced.qualification → `buildVoiceV2QualificationLayerBInstructions`.

---

## 8. Knowledge / RAG

Path: `knowledgeConfigFromWizard` → `knowledge` advanced + KB IDs → RAG tool gating in `knowledge-config.ts`.

---

## 9. Cross-page save safety

`mergeWizardStateForSave` + step-owned fields (`merge-wizard-state-on-save.ts`).  
**PASS:** `test-wizard-merge-on-save.ts`.

---

## 10. Hydration / boolean safety

- Save disabled until hydrated (`wizard.tsx`, PR #387).  
- `solutionName` prefers server on hydrate (PR #387).  
- Page H1 follows editable name (`mctb-voice-agent-page.tsx`, `bd5dc547`).

---

## 11. Targeted test results

| Test | Result |
|------|--------|
| `test-mctb-wizard-skip-livekit.ts` | PASS |
| `test-wizard-advanced-bridge.ts` | PASS |
| `test-wizard-merge-on-save.ts` | PASS |
| `test-voice-v2-wizard-booking-strategies.ts` | PASS |
| `wizard-571-voice-line-api-setup.mjs` (production) | PASS |

---

## 12. Frontend customer-path certification

**Deferred to user.** Prior Playwright pass was **PARTIAL**; do not block backend wiring on UI re-run.  
Optional later: `node scripts/voice-v2-wizard-full-cert.mjs` (not run in this pass).

---

## 13. Bugs fixed in this pass

1. `test-wizard-advanced-bridge.ts` — pin `MICROSOFT_365` before asserting live booking flag.  
2. MCTB Call Handling — human transfer hidden on V2 surface; legacy-only publish path documented.  
3. Production 571 line — re-attached `VOICE_AGENT` + wizard phone save via API script.  
4. Certification matrix reconciled to **27** inventory rows with correct totals.

---

## Artifacts

- `/opt/cursor/artifacts/` — prior UI cert screenshots (historical)  
- Backend setup JSON: stdout from `wizard-571-voice-line-api-setup.mjs`
