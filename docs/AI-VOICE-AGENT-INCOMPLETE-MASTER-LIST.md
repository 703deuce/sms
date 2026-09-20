# AI Voice Agent (Voice V3) — master incomplete list

**Purpose:** Single checklist of **everything that is not fully implemented and completed** for the Appointment Receptionist / Voice V3 product. When every item in **Sections 1–8** is closed (or explicitly accepted as out of scope in Section 9), there should be **no remaining product gap**.

**Companion docs:** `docs/AI-VOICE-AGENT-FEATURE-STATUS.md` (what exists), `docs/AI-VOICE-AGENT-GAP-REGISTER.md` (narrative gaps).  
**This file is the exhaustive checklist** (second audit pass, 2026-09-20).

**How to read**

- **§1** — Official wizard manifest: `CONFIGURED_NOT_IMPLEMENTED` (**104 rows**).  
- **§2** — Manifest says `ACTIVE_EXECUTION` but code review shows **still incomplete**.  
- **§3** — `CONTROL_PLANE_ONLY` / wizard fields that **do not affect live PSTN** (still incomplete if you promise them in UI).  
- **§4** — Engineering gaps **not represented** in the manifest.  
- **§5** — **Production / ops sign-off** (not code — still “not done” until you confirm).  
- **§6** — **Google Calendar** (in-flight + ops).  
- **§7** — **Infrastructure & certification** debt.  
- **§8** — **Legacy / cleanup** debt.  
- **§A** — **Corrections:** manifest or older audits say “not done” but **runtime is actually done** (do not re-build; fix manifest/docs only).

---

## §1 — Wizard manifest: `CONFIGURED_NOT_IMPLEMENTED` (104)

Authoritative export from `buildWizardV3FieldManifest()`. Each row is **not finished** per Transovo’s own wizard→runtime contract unless listed in **§A**.

| # | Step | UI label | `statePath` | Scope |
|---|------|----------|-------------|-------|
| 1 | 2 | Outbound SMS mode | `outboundSmsMode` | YES_GENERAL |
| 2 | 2 | Outbound SMS number id | `outboundSmsPhoneNumberId` | YES_GENERAL |
| 3 | 2 | Outbound SMS E.164 | `outboundSmsE164` | YES_GENERAL |
| 4 | 3 | Knowledge source | `knowledgeSource` | FUTURE_RAG_EXECUTION |
| 5 | 3 | Website URL | `websiteUrl` | FUTURE_RAG_EXECUTION |
| 6 | 3 | Linked knowledge base | `linkedKnowledgeBaseId` | FUTURE_RAG_EXECUTION |
| 7 | 3 | Knowledge base enabled | `knowledgeBaseEnabled` | FUTURE_RAG_EXECUTION |
| 8 | 3 | Knowledge base revision | `knowledgeBaseRevision` | FUTURE_RAG_EXECUTION |
| 9 | 3 | Business schedule timezone | `operatingMaturity.businessSchedule.timezone` | YES_GENERAL |
| 10 | 3 | On-call configuration | `operatingMaturity.onCall` | YES_GENERAL |
| 11 | 3 | SLA configuration | `operatingMaturity.sla` | YES_GENERAL |
| 12 | 3 | After-hours use operating state | `operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls` | YES_GENERAL |
| 13 | 3 | After-hours when closed: allowLiveBooking | `operatingMaturity.afterHoursBehavior.whenClosed.allowLiveBooking` | YES_GENERAL |
| 14 | 3 | After-hours when closed: allowCallbackRequest | `operatingMaturity.afterHoursBehavior.whenClosed.allowCallbackRequest` | YES_GENERAL |
| 15 | 3 | After-hours when closed: allowMessageTaking | `operatingMaturity.afterHoursBehavior.whenClosed.allowMessageTaking` | YES_GENERAL |
| 16 | 3 | After-hours when closed: allowOnCallEscalation | `operatingMaturity.afterHoursBehavior.whenClosed.allowOnCallEscalation` | YES_GENERAL |
| 17 | 3 | After-hours when closed: allowOfficeTransfer | `operatingMaturity.afterHoursBehavior.whenClosed.allowOfficeTransfer` | YES_GENERAL |
| 18 | 3 | After-hours when closed: allowNormalTransferDestinations | `operatingMaturity.afterHoursBehavior.whenClosed.allowNormalTransferDestinations` | YES_GENERAL |
| 19 | 3 | Holiday id | `operatingMaturity.businessSchedule.holidays[].id` | YES_GENERAL |
| 20 | 3 | Holiday name | `operatingMaturity.businessSchedule.holidays[].name` | YES_GENERAL |
| 21 | 3 | Holiday startDate | `operatingMaturity.businessSchedule.holidays[].startDate` | YES_GENERAL |
| 22 | 3 | Holiday endDate | `operatingMaturity.businessSchedule.holidays[].endDate` | YES_GENERAL |
| 23 | 3 | Holiday closedAllDay | `operatingMaturity.businessSchedule.holidays[].closedAllDay` | YES_GENERAL |
| 24 | 3 | On-call schedule enabled | `operatingMaturity.onCallSchedule.enabled` | YES_GENERAL |
| 25 | 3 | On-call entry id | `operatingMaturity.onCallSchedule.entries[].id` | YES_GENERAL |
| 26 | 3 | On-call entry name | `operatingMaturity.onCallSchedule.entries[].name` | YES_GENERAL |
| 27 | 3 | On-call entry dayOfWeek | `operatingMaturity.onCallSchedule.entries[].dayOfWeek` | YES_GENERAL |
| 28 | 3 | On-call entry date | `operatingMaturity.onCallSchedule.entries[].date` | YES_GENERAL |
| 29 | 3 | On-call entry startTime | `operatingMaturity.onCallSchedule.entries[].startTime` | YES_GENERAL |
| 30 | 3 | On-call entry endTime | `operatingMaturity.onCallSchedule.entries[].endTime` | YES_GENERAL |
| 31 | 3 | On-call entry destination.label | `operatingMaturity.onCallSchedule.entries[].destination.label` | YES_GENERAL |
| 32 | 3 | On-call entry destination.phoneE164 | `operatingMaturity.onCallSchedule.entries[].destination.phoneE164` | YES_GENERAL |
| 33 | 3 | On-call entry priority | `operatingMaturity.onCallSchedule.entries[].priority` | YES_GENERAL |
| 34 | 3 | On-call entry enabled | `operatingMaturity.onCallSchedule.entries[].enabled` | YES_GENERAL |
| 35 | 3 | Callback SLA normalTarget | `operatingMaturity.callbackSla.normalTarget` | YES_GENERAL |
| 36 | 3 | Callback SLA normalCustomMinutes | `operatingMaturity.callbackSla.normalCustomMinutes` | YES_GENERAL |
| 37 | 3 | Callback SLA urgentTarget | `operatingMaturity.callbackSla.urgentTarget` | YES_GENERAL |
| 38 | 3 | Callback SLA urgentCustomMinutes | `operatingMaturity.callbackSla.urgentCustomMinutes` | YES_GENERAL |
| 39 | 4 | Booking link URL | `bookingLinkUrl` | FUTURE_BOOKING_LINK |
| 40 | 4 | Booking link label | `bookingLinkLabel` | FUTURE_BOOKING_LINK |
| 41 | 4 | Calendly event type URI | `calendlyEventTypeUri` | FUTURE_CALENDLY |
| 42 | 4 | Calendly event type name | `calendlyEventTypeName` | FUTURE_CALENDLY |
| 43 | 4 | Calendly duration | `calendlyEventTypeDurationMin` | FUTURE_CALENDLY |
| 44 | 4 | Calendly timezone | `calendlyTimezone` | FUTURE_CALENDLY |
| 45 | 4 | Appointment type id | `appointmentTypes[].id` | YES_MICROSOFT_BOOKING |
| 46 | 4 | Appointment type name | `appointmentTypes[].name` | YES_MICROSOFT_BOOKING |
| 47 | 4 | Appointment type calendar | `appointmentTypes[].calendar` | YES_MICROSOFT_BOOKING |
| 48 | 4 | Appointment type status | `appointmentTypes[].status` | YES_MICROSOFT_BOOKING |
| 49 | 4 | Appointment type location | `appointmentTypes[].location` | YES_MICROSOFT_BOOKING |
| 50 | 4 | Appointment type modality | `appointmentTypes[].modality` | YES_MICROSOFT_BOOKING |
| 51 | 4 | Appointment type description | `appointmentTypes[].description` | YES_MICROSOFT_BOOKING |
| 52 | 4 | Appointment type bookingHours | `appointmentTypes[].bookingHours` | YES_MICROSOFT_BOOKING |
| 53 | 4 | Appointment type minNotice | `appointmentTypes[].minNotice` | YES_MICROSOFT_BOOKING |
| 54 | 4 | Appointment type maxDaysAhead | `appointmentTypes[].maxDaysAhead` | YES_MICROSOFT_BOOKING |
| 55 | 4 | Appointment type requiredFields | `appointmentTypes[].requiredFields` | YES_MICROSOFT_BOOKING |
| 56 | 4 | Appointment type bookingPermission | `appointmentTypes[].bookingPermission` | YES_MICROSOFT_BOOKING |
| 57 | 5 | qualificationEnabled | `qualificationEnabled` | YES_GENERAL |
| 58 | 5 | qualificationRequiredBeforePrimaryAction | `qualificationRequiredBeforePrimaryAction` | YES_GENERAL |
| 59 | 5 | qualificationRevision | `qualificationRevision` | YES_GENERAL |
| 60 | 5 | qualificationRulesMatchMode | `qualificationRulesMatchMode` | YES_GENERAL |
| 61 | 5 | qualificationNotQualifiedFallback | `qualificationNotQualifiedFallback` | YES_GENERAL |
| 62 | 5 | qualificationNeedsReviewFallback | `qualificationNeedsReviewFallback` | YES_GENERAL |
| 63 | 5 | Qualification supported zip codes | `qualificationSupportedZipCodes[]` | YES_GENERAL |
| 64 | 5 | Qualification rule id | `qualificationRules[].id` | YES_GENERAL |
| 65 | 5 | Qualification rule fieldKey | `qualificationRules[].fieldKey` | YES_GENERAL |
| 66 | 5 | Qualification rule operator | `qualificationRules[].operator` | YES_GENERAL |
| 67 | 5 | Qualification rule value | `qualificationRules[].value` | YES_GENERAL |
| 68 | 5 | Qualification rule resultStatus | `qualificationRules[].resultStatus` | YES_GENERAL |
| 69 | 5 | Qualification rule reasonCode | `qualificationRules[].reasonCode` | YES_GENERAL |
| 70 | 5 | Qualification rule reasonLabel | `qualificationRules[].reasonLabel` | YES_GENERAL |
| 71 | 5 | Urgency rule id | `urgencyRules[].id` | YES_GENERAL |
| 72 | 5 | Urgency rule label | `urgencyRules[].label` | YES_GENERAL |
| 73 | 5 | Urgency rule fieldKey | `urgencyRules[].fieldKey` | YES_GENERAL |
| 74 | 5 | Urgency rule operator | `urgencyRules[].operator` | YES_GENERAL |
| 75 | 5 | Urgency rule value | `urgencyRules[].value` | YES_GENERAL |
| 76 | 5 | Urgency rule severity | `urgencyRules[].severity` | YES_GENERAL |
| 77 | 5 | Urgency rule action | `urgencyRules[].action` | YES_GENERAL |
| 78 | 5 | Urgency rule transferPlanId | `urgencyRules[].transferPlanId` | YES_GENERAL |
| 79 | 5 | Urgency rule fallbackAction | `urgencyRules[].fallbackAction` | YES_GENERAL |
| 80 | 4 | Appointment type required intake keys | `appointmentTypes[].requiredFields[]` | YES_MICROSOFT_BOOKING |
| 81 | 5 | Warm transfer | `warmTransfer` | YES_GENERAL |
| 82 | 5 | Detect voicemail on transfer | `detectVoicemailOnTransfer` | YES_GENERAL |
| 83 | 5 | Human transfer enabled | `voiceV2HumanTransferEnabled` | YES_GENERAL |
| 84 | 5 | Allow caller-requested transfer | `allowCallerRequestedTransfer` | YES_GENERAL |
| 85 | 5 | Default transfer plan id | `defaultTransferPlanId` | YES_GENERAL |
| 86 | 5 | Urgency rules enabled | `urgencyEnabled` | YES_GENERAL |
| 87 | 5 | Callback use ANI | `callbackUseAniByDefault` | YES_GENERAL |
| 88 | 5 | Callback ask preferred time | `callbackAskPreferredTime` | YES_GENERAL |
| 89 | 5 | Callback confirm number | `callbackConfirmNumber` | YES_GENERAL |
| 90 | 5 | Sales solicitation enabled | `salesSolicitationEnabled` | YES_GENERAL |
| 91 | 5 | Sales solicitation action | `salesSolicitationAction` | YES_GENERAL |
| 92 | 5 | Spam Likely policy | `spamLikelyPolicy` | YES_GENERAL |
| 93 | 5 | Solicitor policy | `solicitorPolicy` | YES_GENERAL |
| 94 | 5 | Transfer plan step order | `transferPlanSteps[].order` | YES_GENERAL |
| 95 | 5 | Transfer plan step destinationId | `transferPlanSteps[].destinationId` | YES_GENERAL |
| 96 | 5 | Transfer plan step transferMode | `transferPlanSteps[].transferMode` | YES_GENERAL |
| 97 | 5 | Transfer plan step timeoutSeconds | `transferPlanSteps[].timeoutSeconds` | YES_GENERAL |
| 98 | 5 | aiCallRecoveryEnabled | `aiCallRecoveryEnabled` | FUTURE_EXECUTION |
| 99 | 5 | aiCallRecoveryConsentMode | `aiCallRecoveryConsentMode` | FUTURE_EXECUTION |
| 100 | 5 | aiCallRecoverySendingPhoneNumberId | `aiCallRecoverySendingPhoneNumberId` | FUTURE_EXECUTION |
| 101 | 5 | aiCallRecoveryContinueOverSms | `aiCallRecoveryContinueOverSms` | FUTURE_EXECUTION |
| 102 | 5 | aiCallRecoveryDelaySeconds | `aiCallRecoveryDelaySeconds` | FUTURE_EXECUTION |
| 103 | 5 | aiCallRecoverySendWhenCallbackCreated | `aiCallRecoverySendWhenCallbackCreated` | FUTURE_EXECUTION |
| 104 | 8 | CRM enabled | `crmEnabled` | FUTURE_CRM |

**Note:** Rows **39–40, 81, 92–97** are **manifest stale** — see **§A** (partially or fully implemented). They remain in §1 until manifest is corrected; use **§A** so you do not duplicate work.

---

## §2 — Manifest `ACTIVE_EXECUTION` but still incomplete (code audit)

| # | Item | What’s missing |
|---|------|----------------|
| 105 | `bookingBehavior.askPreferredDayFirst` | Compiles; **not** in Amy/Astra prompts; **not** in FIND/offer-set. |
| 106 | `bookingBehavior.offerEarliestThree` | Same. |
| 107 | `bookingBehavior.confirmBeforeBooking` | Same; no executor gate before `book_appointment`. |
| 108 | `bookingBehavior.sendSmsAfterBooking` | Sets capability only; **no** caller SMS on book success in `book-dispatch`. |
| 109 | `bookingBehavior.askServiceFirst` | Same as 105–107. |
| 110 | `bookingBehavior.distinguishNewExisting` | Same. |
| 111 | `answer_questions` capability | No in-call RAG / `get_business_answer` on V3 tool catalog; hot facts only. |
| 112 | `knowledge.retrieval.documentSourceIds` | Always `[]` at compile; no document-source runtime. |
| 113 | `bookingStrategy` `REQUEST_ONLY` / `NONE` / `CALENDLY` | `bookingStrategyDetail.executionStatus` = `CONFIGURED_NOT_IMPLEMENTED` (Calendly has **no** V3 executor). |
| 114 | Multi-route transfer UX | Compiler builds **one** default route; no multi-route editor per transfer directive. |
| 115 | `detectVoicemailOnTransfer` | Compiles to `callHandling`; **not** wired to transfer executor policy (outcomes exist in warm path only). |
| 116 | `urgencyEnabled` + `urgencyRules[]` | Compiled; **no** urgency executor. |
| 117 | `callbackAskPreferredTime` | Compiled; **not** used in `callback-requirements.ts` (only `callbackUseAniByDefault` enforced). |
| 118 | `callbackConfirmNumber` | Compiled; **not** enforced in callback executor. |
| 119 | `qualify_callers` capability | Config compiles; **no** qualification executor (see §1 #57–70). |
| 120 | Staff notification defaults | `notify-appointment-booked` defaults often **off**; book path does not force notify/webhook emission from dispatch layer. |
| 121 | `telephony.answerWhen` / `ringBehavior` / `ringTeamSeconds` | Compiled; **CONTROL_PLANE_ONLY** — no LiveKit PSTN ring logic. |
| 122 | `longTermMemory` | Compiled to integrations; **no** runtime memory product. |
| 123 | Publish quality gate | `qualityStudioLastRun` / `lastTestPassed` do not hard-block publish in all paths. |
| 124 | Custom OpenAI voice wizard | Gated by `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1`. |
| 125 | `VOICE_V3_PARALLEL_TOOL_CALLS` | Off by default; not certified for production. |

---

## §3 — `CONTROL_PLANE_ONLY` wizard fields (not on live call path)

Incomplete **if** the UI implies they change call behavior. Safe to ignore **only** for pure metadata rows (agent id, setup id).

| # | Item | Status |
|---|------|--------|
| 126 | `answerWhen` | Not driving V3 LiveKit answer timing. |
| 127 | `numberSource` | Provisioning metadata. |
| 128 | `ringBehavior` / `ringTeamSeconds` | Not V3 conversation path. |
| 129 | `testScenario` / `lastTestPassed` | Wizard QA only. |
| 130 | `activationMode` / `scheduledAt` | Publish scheduling — verify end-to-end scheduled activation. |
| 131 | `voiceLabel` / `voiceSource` / `openAiCustomVoiceId` | Partially control plane until custom voice flag on. |

---

## §4 — Runtime / architecture gaps (not in manifest)

| # | Item |
|---|------|
| 132 | In-call **KB / website RAG** tool for V3 (internal `business_answer` exists for generic worker, not V3 catalog). |
| 133 | **After-hours policy executor** for `whenClosed.*` and `useOperatingStateDuringCalls`. |
| 134 | **Holiday closure** in FIND/BOOK slot generator. |
| 135 | **On-call schedule** routing to transfer targets. |
| 136 | **SLA / callback SLA** enforcement and notifications. |
| 137 | **Calendly** V3 find/book/cancel provider module. |
| 138 | **AI call recovery SMS** after V3 hangup (`aiCallRecovery*` wizard fields). |
| 139 | **CRM tools** for `crmEnabled`. |
| 140 | **Dedicated outbound SMS** telephony fields (`outboundSms*`) for all SMS surfaces. |
| 141 | **Per-service** calendar, notice, horizon, booking hours in scheduling engine. |
| 142 | **Per-service required intake** at book gate. |
| 143 | **Business website auto-import** → wizard population (not verified E2E). |
| 144 | **Contact-center** supervisor UI (monitor, barge, whisper). |
| 145 | **Consistent DB audit** for all LiveKit V3 calls (`voiceCall`, tool traces) — forensics gaps on some calls. |
| 146 | **Conversation/delegation edge cases** — `FRESH_DELEGATION_GAP_AFTER_REVISION`, pivot booking→callback without scheduling generation bump (see architecture docs). |
| 147 | **Manifest truth** — align `executionStatus` with code (spam, booking link, transfer plan, warm transfer). |
| 148 | **Dual Voice V2 + V3 publish** — wizard still feeds V2 `instructions.system` / Telnyx assistant artifacts. |
| 149 | **Generic AI receptionist** (`/voice/agents` factory) — deferred V1; not Appointment Receptionist V3. |
| 150 | **Realtime transcript** on call detail vs post-call Deepgram — two paths; confirm product expectation. |

---

## §5 — Production & ops sign-off (not complete until you confirm)

| # | Gate |
|---|------|
| 151 | Microsoft PSTN: find → book → reschedule → cancel on real calendar. |
| 152 | Google PSTN: same (after PR merge + OAuth). |
| 153 | SEND_LINK: SMS received with correct URL. |
| 154 | REQUEST_ONLY: no calendar mutation; intake/message path acceptable. |
| 155 | Transfer: cold + warm on real handset; waterfall if enabled. |
| 156 | Callback: staff notification + requirements loop. |
| 157 | Post-call: egress recording audible (caller + Amy); transcript; summary email. |
| 158 | Outbound webhooks: signed delivery + retries in prod. |
| 159 | Daily digest cron in prod. |
| 160 | Spam **Spam Likely** PSTN with carrier header (`VOICE-V3-SPAM-SOLICITOR-PROTECTION-FINAL-REPORT.md`). |
| 161 | Telnyx inbound screening sync in prod. |
| 162 | LiveKit: trunk/dispatch/worker per cert number (`verify-571-livekit-callable.ts`). |
| 163 | Brevo / SMS provider env in prod. |
| 164 | Stripe/billing for voice usage if product requires it. |

---

## §6 — Google Calendar (not finished until closed)

From `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md` (code on PR #459 until merged to `master`):

| # | Item |
|---|------|
| 165 | Merge Google implementation to `master`. |
| 166 | Prod: Integrations OAuth connect → CONNECTED. |
| 167 | Prod: Wizard publish Google agent. |
| 168 | Prod: PSTN find/book/reschedule/cancel on `primary`. |
| 169 | Prod: Microsoft regression unchanged. |
| 170 | Google Cloud OAuth app verification (if public rollout). |
| 171 | Multi-calendar beyond `primary`. |
| 172 | Per-agent Google credentials (workspace-only today). |
| 173 | ACL / CalendarList / Meet / service accounts (out of scope — still not done). |
| 174 | Cleanup: `src/lib/voice/calendar/oauth.ts` duplicate. |
| 175 | Cleanup: legacy `src/lib/calendar/providers.ts` Google helpers (non–V3). |

---

## §7 — Infrastructure & certification debt

| # | Item |
|---|------|
| 176 | Full **PSTN certification matrix** all booking × transfer × callback modes. |
| 177 | Warm transfer **outbound SIP trunk** + REFER on Telnyx trunk (per transfer preflight). |
| 178 | **Ringing timeout** on all cold-transfer code paths (API vs JobContext wrapper). |
| 179 | **End-to-end** wizard publish → `sessions.accept` voice id (verify no env override drift). |
| 180 | **Mode 4 / V1** voice pages if in rebuild manifest — any route still on legacy shell. |

---

## §8 — Legacy cleanup (technical debt)

| # | Item |
|---|------|
| 181 | Remove or align duplicate OAuth modules (`voice/calendar/oauth.ts`). |
| 182 | Consolidate Calendly strategy (implement V3 or remove from wizard). |
| 183 | Retire or redirect **Voice V2** PSTN path when V3 is sole product. |
| 184 | MCTB / Voice boundary tests remain — no TeXML conflation (frozen). |

---

## §9 — Explicitly out of V1 / intentional (not incomplete for Appointment Receptionist V3)

Do **not** count these toward V3 “done” unless product scope expands:

- Mass SMS / campaigns / Smart Routing as part of V3 agent  
- PBX, AI receptionist builder, Zoho/Teams booking adapters in V3  
- Generic CRM inside V3 (`crmEnabled`)  
- Google FreeBusy API (events.list only by design)  
- MCTB TeXML voice pipeline changes  

---

## §A — Corrections (manifest or old audits say NI; runtime is done or mostly done)

**Do not re-implement** — update manifest `executionStatus` and docs instead.

| Manifest row(s) | Actual runtime |
|-----------------|----------------|
| §1 #92–93 `spamLikelyPolicy`, `solicitorPolicy` | **DONE** — `wizardSpamProtectionFromState`, prompts, Telnyx screening sync. |
| §1 #39–40 `bookingLinkUrl`, `bookingLinkLabel` | **DONE** for SEND_LINK — `send_booking_link` + `bookingStrategyDetail`. |
| §1 #81 `warmTransfer` | **DONE** — `compile-transfer-config` + `transfer_executor.py` WARM mode. |
| §1 #94–97 `transferPlanSteps[]` | **DONE** — used in `compileVoiceV3TransferPolicyFromWizard` (manifest stale). |
| §1 #87 `callbackUseAniByDefault` | **DONE** — `callback-requirements.ts`. |
| Transfer preflight “no warm transfer” | **Obsolete** — warm path exists; PSTN cert may still be open (§5 #155). |
| Prompt mapping audit “transfer destinations empty” | **Obsolete** — `transferDestinationsFromWizard` in compile. |

**Still incomplete despite compile:** §1 #82 `detectVoicemailOnTransfer`, #88–89 callback UX flags, #86 urgency, #83–85 transfer flags (partial enforcement), #90–91 sales solicitation (partial via spam merge).

---

## Totals (checklist math)

| Bucket | Count |
|--------|------:|
| §1 Manifest `CONFIGURED_NOT_IMPLEMENTED` | 104 |
| §2 Active but incomplete | 21 |
| §3 Control plane (if product-promised) | 6 |
| §4 Runtime/architecture | 19 |
| §5 Production sign-off | 14 |
| §6 Google | 11 |
| §7 Infra/cert | 5 |
| §8 Legacy cleanup | 4 |
| **Rough total line items** | **~184** (minus §A overlaps with §1) |

**Ship rule:** Close **§1–§8** (or move items to **§9** with product sign-off). Fix **§A** manifest drift so §1 matches reality.

---

## Regenerate §1 table

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx -e "
import { buildWizardV3FieldManifest } from './src/lib/voice-v3/config/wizard-v3-manifest-builder.ts';
for (const r of buildWizardV3FieldManifest().filter(x => x.executionStatus === 'CONFIGURED_NOT_IMPLEMENTED'))
  console.log(r.step, r.uiLabel, r.statePath, r.scope);
"
```

**End of master incomplete list.**
