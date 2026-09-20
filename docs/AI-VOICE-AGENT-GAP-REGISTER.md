# AI Voice Agent (Voice V3) — gap register

**Purpose:** Every known gap between **what the Appointment Receptionist wizard implies** and **what Voice V3 actually does on a live PSTN call**, plus ops/product gaps. Use with `docs/AI-VOICE-AGENT-FEATURE-STATUS.md` (done vs not done summary).

**Last updated:** 2026-09-20  
**Evidence sources:** `wizard-v3-manifest-builder.ts` (216 controls), `VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md`, `VOICE-V3-TRANSFER-PREFLIGHT-AUDIT.md`, calendar/knowledge/runtime code search.

**Legend**

| Severity | Meaning |
|----------|---------|
| **P0** | Customer expects behavior; wrong or missing on live calls |
| **P1** | Important feature partially wired or prod sign-off open |
| **P2** | Compiled/saved but not enforced; or polish/ops |
| **INTENTIONAL** | Deferred product scope or legacy preserved |

---

## Summary counts (wizard manifest)

From `buildWizardV3FieldManifest()`:

| `executionStatus` | Count | Meaning |
|-------------------|------:|---------|
| `ACTIVE_EXECUTION` | 88 | Intended live effect |
| `CONFIGURED_NOT_IMPLEMENTED` | 104 | Saved/compiled; **no runtime executor** |
| `CONTROL_PLANE_ONLY` | 19 | Publish/UI only |
| `LIVE_PROMPT_CONTROL` | 5 | GPT-Live tuning via instructions |

**104 wizard controls are explicitly marked not implemented at runtime** — see Section 2.

---

## 1. Scheduling & calendar gaps

### 1.1 Booking strategies

| Gap | Severity | Detail |
|-----|----------|--------|
| **Calendly live FIND/BOOK on V3** | **P0** | `bookingStrategy === CALENDLY` compiles (`FUTURE_CALENDLY` in manifest). No `voice-v3/calendar` Calendly provider. Wizard UI de-emphasized; legacy V2/Telnyx paths may still exist elsewhere. |
| **Google Calendar on `master`** | **P1** | Full provider on branch `cursor/google-calendar-voice-v3-implementation-2304` (PR #459). Merge + live OAuth/PSTN sign-off required. |
| **Google Cloud OAuth verification** | **P1** | Production consent / verified app — ops (`docs/GOOGLE-CALENDAR-OAUTH-VERIFICATION.md`). |
| **Multi-calendar selection** | **P2** | V3 defaults to `primary` (Microsoft env calendar id / Google `primary`). No picker for secondary calendars. |
| **Per-agent Google credentials** | **P2** | Uses workspace `voiceCalendarConnection` only. |

### 1.2 Appointment types & services

| Gap | Severity | Detail |
|-----|----------|--------|
| **Per-type calendar, location, modality, booking hours, min notice, max days ahead** | **P1** | Manifest: only `enabled` + `durationMin` are `ACTIVE_EXECUTION` for `appointmentTypes[]`. Other fields compile to `services[]` but **FIND/BOOK does not read them** (no per-service calendar id, notice, or horizon in slot generator). |
| **Per-type required intake keys** | **P1** | `appointmentTypes[].requiredFields[]` → `CONFIGURED_NOT_IMPLEMENTED` (“per-service intake future”). Global intake schema only. |
| **Multiple enabled types** | **P2** | `resolveBookingServiceForRuntime` can pick type via intake ids/names; without collection UX, calls often stay on **primary service** only. |

### 1.3 Booking behavior toggles (wizard Step 4)

| Gap | Severity | Detail |
|-----|----------|--------|
| **`bookingBehavior.*` not enforced in executors** | **P1** | Values compile to `scheduling.bookingBehavior` but **no usage** in `voice-v3/calendar/*` (no `confirmBeforeBooking` gate in `book-dispatch`, no `offerEarliestThree` in offer-set). Manifest claims Astra consumption — **not present in `voice-v3/prompts`** (grep empty). Customer toggles are mostly **inert** except `sendSmsAfterBooking` → capability flag only (see notifications). |
| **Holidays / closure dates** | **P1** | `operatingMaturity.businessSchedule.holidays[]` — all `CONFIGURED_NOT_IMPLEMENTED`. FIND uses weekly `businessHours` only. |
| **Business schedule timezone row** | **P2** | Manifest marks timezone scalar `CONFIGURED_NOT_IMPLEMENTED` while weekly day ranges are active — verify workspace `timezone` vs wizard schedule timezone alignment on edge cases. |

### 1.4 Microsoft-specific

| Gap | Severity | Detail |
|-----|----------|--------|
| **PSTN regression / certification matrix** | **P1** | Code frozen; **your** ongoing sign-off on find/book/reschedule/cancel after any provider change. |
| **Legacy observability on some calls** | **P2** | Forensics noted missing `voiceCall` / tool rows for some LiveKit calls (`VOICE-V3-TRANSFER-PREFLIGHT-AUDIT.md`, cancel/reschedule forensics). Do not assume CRM audit is complete for every V3 leg. |

---

## 2. Wizard controls with no runtime (manifest `CONFIGURED_NOT_IMPLEMENTED`)

Grouped by `scope` (104 controls). These are **saved in wizard state** and often **compiled into `VoiceV3AgentConfig`**, but manifest says **no executor**.

### 2.1 `FUTURE_RAG_EXECUTION` (5 controls)

| Control | Gap |
|---------|-----|
| `knowledgeSource`, `websiteUrl`, `linkedKnowledgeBaseId`, `knowledgeBaseEnabled`, `knowledgeBaseRevision` | **P0 for “answer from my KB”** — IDs compile to `knowledge.retrieval`, but V3 has **no** `get_business_answer` / RAG tool in `voice-tool-catalog.ts`. Live calls rely on **hot context** (`knowledgeItems`, business facts in Amy prompt). Linked KB / crawl / Telnyx RAG **not invoked** on V3 PSTN path. (Generic receptionist worker still has `get_business_answer` → `business_answer` internal API.) |

### 2.2 `FUTURE_CALENDLY` (4 controls)

Calendly URI, name, duration, timezone — compile only; **no V3 executor**.

### 2.3 `FUTURE_BOOKING_LINK` (2 controls)

Manifest still tags some booking-link fields `CONFIGURED_NOT_IMPLEMENTED` while `send_booking_link` tool **is** implemented — treat manifest row as **stale**; confirm `bookingLinkUrl` / strategy detail in `authorize-tool-for-config` for your workspace.

### 2.4 `FUTURE_EXECUTION` (6 controls) — AI call recovery SMS

| Control | Gap |
|---------|-----|
| `aiCallRecoveryEnabled`, consent mode, sending number, SMS continuation, delay, send-on-callback | **P1** — V2/MCTB-adjacent recovery; **not** wired to V3 LiveKit hangup. Wizard toggles **do nothing** on V3 calls. |

### 2.5 `FUTURE_CRM` (1 control)

`crmEnabled` — **INTENTIONAL** / deferred; no V3 CRM tools in catalog.

### 2.6 `YES_GENERAL` — operations & after-hours policy (largest bucket)

| Area | Examples | Gap |
|------|----------|-----|
| **Outbound SMS telephony** | `outboundSmsMode`, `outboundSmsPhoneNumberId`, `outboundSmsE164` | **P1** — SEND_LINK / notifications may use other resolution paths; dedicated outbound SMS wizard fields **not implemented** per manifest. |
| **After-hours behavior matrix** | `afterHoursBehavior.useOperatingStateDuringCalls`, `whenClosed.allowLiveBooking`, `allowCallbackRequest`, `allowMessageTaking`, `allowOnCallEscalation`, `allowOfficeTransfer`, `allowNormalTransferDestinations` | **P0** — Customer configures “when closed, only callback” etc.; **no deterministic after-hours executor** applies these flags on V3. |
| **On-call** | `operatingMaturity.onCall`, `onCallSchedule.*` | **P1** — No on-call routing engine on V3 transfers. |
| **SLA** | `operatingMaturity.sla`, `callbackSla.*` | **P2** — Display/compile only; no SLA enforcement or notifications. |
| **Qualification** | `qualificationEnabled`, rules, zip codes, fallbacks | **P1** — Compiles to `config.qualification` but manifest: **“future qualification executor”** — no zip/rule gate before book/transfer. |
| **Urgency rules** | `urgencyRules[]` | **P1** — Not enforced in runtime. |
| **Transfer plan waterfall** | `transferPlanSteps[]` | **P1** — Single-destination / enum model today; no multi-step waterfall per transfer directive. |
| **Warm transfer / voicemail detect / sales solicitation scalars** | Several `callHandling` scalars marked NI | **P2** — Partial: warm transfer exists in Python path; not all wizard scalars map 1:1 (see transfer section). |
| **Activation / quality studio** | Wizard test checklist, `qualityStudioLastRun` | **P2** — Publish gating may not block on studio results uniformly. |

### 2.7 `YES_MICROSOFT_BOOKING` (13 controls)

Mostly **appointment type sub-fields** and per-type intake — see Section 1.2.

---

## 3. Transfer system gaps

From `docs/VOICE-V3-TRANSFER-PREFLIGHT-AUDIT.md` (updated partially since publish):

| Gap | Severity | Detail |
|-----|----------|--------|
| **Semantic transfer routes** (`route_id`, descriptions, waterfall one-call-per-route) | **P1** | Tool uses `destination` + `reason`; no route catalog for Astra. |
| **Per-destination DIRECT/WARM + availability flags** | **P1** | Limited `VoiceV3TransferDestination` shape vs directive. |
| **Wizard “Transfer settings → Destinations → Routes” UX** | **P2** | Not reorganized per directive; destinations **do** map via `transferDestinationsFromWizard` (earlier audit “empty destinations” **partially obsolete**). |
| **Telnyx REFER / outbound trunk for warm transfer** | **P1** | Infra checklist — must be true in each deployment. |
| **Structured `VOICE_V3_TRANSFER_*` telemetry** | **P2** | Incomplete vs directive. |

---

## 4. Knowledge & “answer questions” capability

| Gap | Severity | Detail |
|-----|----------|--------|
| **`answer_questions` without RAG tool on V3** | **P0** | Capability enables prompt copy; long-tail KB search **not** on Astra tool list. |
| **Website URL crawl → live answers** | **P1** | URL compiles; no V3 crawl/RAG execution (manifest `FUTURE_RAG_EXECUTION`). |
| **Post-call knowledge gaps** | **DONE** | Gap queue from summary — separate from in-call RAG. |
| **Business auto-import / website wizard job** | **P1** | Not verified as end-to-end V3 feature in repo (no dedicated import module tied to wizard publish). |

---

## 5. Notifications & SMS gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **`sendSmsAfterBooking` → customer SMS** | **P1** | Sets `sendSmsConfirmations` capability; **no** clear hook in `book-dispatch` to SMS the caller. Staff notifications use `notifyVoiceV3AppointmentBooked` (telemetry path) — **defaults often email/SMS off** in `defaults.ts`. |
| **Event toggles in after-hours notifications editor** | **P2** | Compiled; verify each event is fired on V3 tool success (callback/transfer/book). |
| **Post-call summary** | **DONE** code | **MANUAL SIGN-OFF** Brevo/cron in prod. |
| **Daily digest** | **DONE** code | **MANUAL SIGN-OFF** cron in prod. |

---

## 6. Voice, persona & GPT-Live gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **Custom OpenAI voice wizard** | **P2** | Gated by `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1`; default builtin mapping (`voice-v3-live-built-in-voices.ts`). |
| **Legacy ElevenLabs / Flux wizard fields** | **INTENTIONAL** | Removed from customer wizard per GPT-Live audit. |
| **Env overrides** | **P2** | `VOICE_V3_*` env can override name/hours — wizard not sole source. |
| **Parallel tool calls** | **P2** | Off by default; enabling requires cert (`VOICE_V3_PARALLEL_TOOL_CALLS`). |

Most **role / tone / opening greeting / live prompt controls** are **DONE** in `live-frontend-instructions.ts` (mapping audit partially outdated).

---

## 7. Intake, messages & capabilities

| Gap | Severity | Detail |
|-----|----------|--------|
| **`take_messages` capability** | **P2** | Prompt + capability flag; message capture via Python `persist-message` bridge — confirm product flow vs dedicated tool. |
| **Intake objectives / `update_intake`** | **DONE** | Canonical V3 path. |
| **`qualify_callers`** | **P1** | Capability + compile; **no rule executor** (Section 2.6). |

---

## 8. Post-call, analytics & ops gaps

| Gap | Severity | Detail |
|-----|----------|--------|
| **Listen-test dual-channel egress** | **P1** | **MANUAL SIGN-OFF** |
| **Realtime monitoring / supervisor** | **P2** | No full contact-center UI. |
| **Call detail vs DB forensics** | **P2** | Some PSTN sessions thin in DB rows. |
| **Wizard recording consent / disclosure** | **P2** | Check alignment with egress + UI copy per workspace. |

Post-call pipeline items in `VOICE-V3-AFTER-HOURS-POST-CALL-AUDIT.md` checklist are largely **implemented in code** since that doc was written; remaining gap is **production validation**, not missing modules.

---

## 9. Google Calendar–specific gaps (in-flight PR)

See `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md` Section 8–10:

- Legacy duplicate OAuth module cleanup  
- Old `calendar/providers.ts` Google helpers (non–V3)  
- No FreeBusy API (events.list only) — **INTENTIONAL**  
- Production connect / publish / PSTN manage flows — **MANUAL SIGN-OFF**

---

## 10. Legacy, parallel & deferred products

| Item | Severity | Detail |
|------|----------|--------|
| **Voice V2 Telnyx assistant** | **INTENTIONAL** | Separate contract; do not conflate cert with V3. |
| **Generic AI receptionist `/voice/agents`** | **INTENTIONAL** | Deferred V1; has `get_business_answer` pattern V3 lacks. |
| **Smart Routing, campaigns, inbound routing** | **INTENTIONAL** | Different products; hidden or secondary nav. |
| **Dual compile paths (V2 `instructions.system` + V3)** | **P2** | Wizard still feeds V2 publish artifacts for non-V3 surfaces. |

---

## 11. Production sign-off gaps (not code)

These are **expected open** until you close them:

- PSTN find/book/reschedule/cancel per strategy (Microsoft, Google, SEND_LINK, REQUEST_ONLY)  
- Transfer to real handset / warm path  
- Callback + staff notifications  
- Spam/solicitor with real carrier screening header  
- Post-call email, webhooks, digest cron  
- Google OAuth + verified app (if public rollout)  

---

## 12. Recommended fix order (engineering)

1. **P0:** In-call RAG / `linkedKnowledgeBaseId` **or** honest wizard copy (“hot facts only until RAG ships”).  
2. **P0:** After-hours `whenClosed.*` policy executor **or** hide controls.  
3. **P1:** `bookingBehavior` → Astra prompts + book/find enforcement (confirm before book, offer set size).  
4. **P1:** Qualification + urgency executors **or** hide Step 5 rules.  
5. **P1:** Merge Google PR + prod gates; decide Calendly V3 vs remove strategy.  
6. **P1:** Transfer routes/waterfall + telemetry per transfer directive.  
7. **P1:** Per-service calendar/notice/horizon **or** simplify wizard to single service.  
8. **P2:** Manifest truth pass (align `ACTIVE_EXECUTION` with code), observability rows, outbound SMS fields.

---

## 13. How to regenerate manifest numbers

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx -e "
import { buildWizardV3FieldManifest } from './src/lib/voice-v3/config/wizard-v3-manifest-builder.ts';
const rows = buildWizardV3FieldManifest();
console.log(rows.filter(r => r.executionStatus === 'CONFIGURED_NOT_IMPLEMENTED').map(r => r.uiLabel).join('\n'));
"
```

---

**End of gap register.** Pair with `docs/AI-VOICE-AGENT-FEATURE-STATUS.md` for the positive inventory.
