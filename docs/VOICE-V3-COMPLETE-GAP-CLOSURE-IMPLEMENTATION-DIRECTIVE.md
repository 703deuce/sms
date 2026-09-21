# Transovo Voice V3 — complete gap-closure implementation directive

**Status:** Single authoritative implementation job for Appointment Receptionist (Voice V3).  
**Supersedes:** “audit now, implement later” and partial P0-only passes.  
**Companion audits (use together):**

- `docs/AI-VOICE-AGENT-FEATURE-STATUS.md`
- `docs/AI-VOICE-AGENT-GAP-REGISTER.md`
- `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md` (numbered items #1–#184)
- `buildWizardV3FieldManifest()` in `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts`

**Related (preserve, do not replace):** `docs/VOICE-V3-FINAL-ARCHITECTURE.md`, `docs/VOICE-V3-TRANSFER-SYSTEM-IMPLEMENTATION-DIRECTIVE.md`, `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md`, `docs/GOOGLE-CALENDAR-VOICE-V3-IMPLEMENTATION-DIRECTIVE.md` (Google provider only).

**LiveKit references (required reading):**

- External data / RAG + function tools (current Agents pattern — **not** `livekit.plugins.rag` v0.x)
- Warm transfer: `WarmTransferTask` (`ringing_timeout`, voicemail detection, return to room on failure)
- Cold transfer: `TransferSIPParticipant` / `TransferSIPParticipantRequest` (`ringing_timeout`; on timeout caller **remains in room** for waterfall/fallback)
- Telnyx: SIP **REFER** must be enabled for cold transfer

---

## Preamble — corrections to the master incomplete list (before coding)

1. **`REQUEST_ONLY` and `NONE`** are **valid executed strategies** when they do what they promise: REQUEST_ONLY = intake/request → persistence → staff notification (no calendar mutation); NONE = scheduling tools absent and no broken booking prompts. Mark `ACTIVE_EXECUTION`, not “missing provider.”
2. **Do not require retiring Voice V2** to finish V3. **Preserve** the V2 contract. Requirement = **authority separation**: Appointment Receptionist V3 publishes and runs through LiveKit **without V2 side effects** altering the V3 production agent. V2 deletion is a later program.
3. **Transfer ringing timeout** is **implementation**, not certification-only debt: use native `ringing_timeout` on **both** warm and cold paths; on cold timeout continue waterfall/fallback (caller stays in room per LiveKit).

---

## Mission

Complete every **real** customer-facing or runtime gap in the Voice V3 Appointment Receptionist in **one implementation branch / one comprehensive pass**.

- Do not stop after auditing.
- Do not return a plan and wait for another pass.
- Do not fix only P0/P1.
- Do not leave wizard controls saved but inert.

**Finished result:** If a customer can configure a behavior in the **active** Voice V3 wizard, it must **execute correctly** on a live V3 call **or** be **removed/hidden** from active V1 UI with documented deferral.

**Explicit instruction:** This is **one job** — not “audit now, implement later,” not separate feature passes.

---

## Part I — Core directive (sections 0–86)

### 0. Non-negotiable engineering rule

Before changing any feature, trace:

Wizard UI → wizard state → persistence → compiler → published `VoiceV3AgentConfig` → Python/Node session resolution → Astra authorization/instructions → FunctionTool → Node executor → deterministic business policy → provider/runtime action → persisted outcome → Amy response → post-call/notifications/analytics.

Repair the boundary where the chain stops. Do not rebuild working components because an audit missed them.

### 1. Architecture that must remain frozen

Canonical path:

Telnyx PSTN → LiveKit SIP → LiveKit room → AgentSession → GPTLiveModel → Amy → delegation → Astra → LiveKit FunctionTools → TransovoV3ToolClient → `/api/internal/voice-runtime` → existing executors → providers/persistence → structured result → Amy → caller.

Do **not** replace with: custom OpenAI WebSocket, manual `response.create` loops, separate STT/TTS, Silero/VAD, another scheduling/transfer/delegation engine, or a classifier LLM.

### 2. First action — reconcile gap register against real code

Inspect the four audit docs + manifest + mapping/transfer audits + code.

**Stale-audit rule:** AUDIT SAYS MISSING → TRACE CODE → already implemented? → preserve + fix manifest; else implement. Never duplicate paths.

### 3–9. New Voice V3 knowledge / RAG

- Do **not** connect V3 to old Telnyx RAG or generic receptionist-only paths as the V3 authority.
- Build **tenant-scoped** ingestion → chunk → embed → index → published KB revision.
- Live call: `search_business_knowledge` (provider-neutral) via existing V3 tool bridge (same pattern as other tools).
- Grounding rules for Astra; bounded retrieval; status-update pattern for slow retrieval only.
- Prefer **pgvector** on existing Postgres if available; no in-memory-only production index.

### 10–11. Knowledge UI + operating-state engine (P0)

Use existing Kimi-family tokens/components. No new design system.

Build deterministic `VoiceOperatingState` (OPEN / CLOSED + reason). **Do not** ask Astra if the business is open.

### 12–14. Holidays, timezone, after-hours policy executor

Implement holidays, single authoritative **IANA** timezone, and `whenClosed.*` / `useOperatingStateDuringCalls` via **`resolveEffectiveCallCapabilities`** — enforced in **tool authorization**, not prompts alone.

### 15–22. Service / appointment type execution

All **active V1** per-service fields: duration, hours, notice, horizon, intake, location, modality, calendar where UI+scope allow. Multi-service resolution natural language. Per-service calendar only where provider/UI support (Google V1 = primary only).

### 23–25. Booking behavior executor

Wire **all** `bookingBehavior.*` including `confirmBeforeBooking`, `offerEarliestThree`, `sendSmsAfterBooking`, and the three conversation controls in **Part II §88–91**.

### 26–29. Qualification, urgency, on-call

Deterministic engines (no qualification LLM). On-call bridges into **existing** transfer route system — do not build a second transfer engine.

### 30–36. Transfer routes, waterfall, UI, telemetry

Semantic routes; one `transfer_call` executes waterfall; preserve **TransferSIPParticipant** + **WarmTransferTask**; per-destination settings; structured `VOICE_V3_TRANSFER_*` events.

### 37–42. Callback SLA, message taking, outbound SMS, booking SMS, notifications, AI call recovery

Implement or **hide** from active V3 UI. Voice V3 recovery **must not** route through MCTB TeXML.

### 43–46. Recording disclosure, quality/activation gating, website import

Website import = **same crawl** as RAG source + optional wizard suggestions (do not auto-overwrite edits).

### 47–53. Google, Calendly, multi-calendar, CRM, supervisor, custom voice, parallel tools

Merge PR #459 Google without breaking Microsoft. Calendly: hide active V3 promise, preserve legacy. CRM/supervisor: do not build. `parallel_tool_calls = false` intentional.

### 54–66. Env overrides, observability, telemetry, manifest/UI truth, prompts

No silent env override of customer policy. Dynamic tool authorization from effective capabilities. Prompts follow policy; prompts are not the enforcement boundary.

### 67–80. Testing + LiveKit version + production certification surfaces

Add deterministic tests per subsystem; run existing V3 suites; **installed LiveKit 1.8.2 wins** over docs copy-paste.

### 81–86. Final docs + definition of done + shared primitives

Regenerate feature status + gap register. Produce `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-REPORT.md` with evidence.

Shared foundations: OperatingStateEngine, ServicePolicy, Qualification/Urgency, TransferRouteEngine, Knowledge system, Communication policy, Manifest reconciliation.

---

## Part II — Addendum: second-audit master incomplete list (sections 87–147)

**This addendum is part of the SAME implementation job.** Do not treat as a future pass.

### 87. Second-audit reconciliation

Use all four sources + `buildWizardV3FieldManifest()`.

~184 line items — **do not** create 184 independent implementations. Collapse into shared systems. **Reconciliation matrix:** every numbered item ends as exactly one of:

- `IMPLEMENTED`
- `ALREADY IMPLEMENTED — MANIFEST FIXED`
- `INTENTIONALLY HIDDEN FROM V1`
- `LEGACY PRESERVED — NOT ACTIVE V3`
- `MANUAL PRODUCTION CERTIFICATION`

Forbidden final states: TODO, “future executor,” “partially wired,” “configured but unused,” “probably works” for **active** V1 settings.

### 88–91. Booking conversation policy (all six controls)

Single policy type:

```ts
type VoiceV3BookingBehavior = {
  askPreferredDayFirst: boolean;
  askServiceFirst: boolean;
  offerEarliestThree: boolean;
  confirmBeforeBooking: boolean;
  sendSmsAfterBooking: boolean;
  distinguishNewExisting: boolean;
};
```

Affects Astra operation requirements + deterministic booking state — **not** a new conversation engine.

- **§89 askServiceFirst:** Service before find when multiple services; do not re-ask if caller already gave service + time.
- **§90 askPreferredDayFirst:** Day preference before slots; do not re-ask if caller gave “Thursday afternoon.”
- **§91 distinguishNewExisting:** Disambiguate new vs existing when ambiguous; do not re-ask when intent clear (reschedule/cancel path vs book path).

### 92. Booking permission per service

`appointmentTypes[].bookingPermission` runtime-authoritative (e.g. LIVE_BOOK, REQUEST_ONLY, SEND_LINK, DISABLED). Effective capability = agent strategy ∩ service permission ∩ operating state ∩ qualification.

### 93. Appointment description / status

`status` gates selectability; `description` compact context for Astra/service disambiguation — not dumped to Amy.

### 94–95. Callback preferred time + confirm number

`callbackAskPreferredTime` and `callbackConfirmNumber` in existing callback requirements (separate from `callbackUseAniByDefault`). Partial confirm (“ending in 1234”) when appropriate.

### 96–98. Human transfer enabled, caller-requested transfer, default transfer plan

Deterministic enforcement for `voiceV2HumanTransferEnabled` (alias to neutral V3 field), `allowCallerRequestedTransfer`, `defaultTransferPlanId` → semantic route engine.

### 99. Voicemail detection policy

Wire `detectVoicemailOnTransfer` to warm-transfer outcomes → `VOICE_V3_TRANSFER_VOICEMAIL` → waterfall/fallback (native LiveKit behavior).

### 100–101. Sales solicitation + spam manifest correction

Unify with `wizardSpamProtectionFromState` / `report_unwanted_solicitor`. **Do not rebuild** `spamLikelyPolicy` / `solicitorPolicy` — manifest fix + evidence only.

### 102–103. Booking link + transfer plan manifest corrections

`bookingLinkUrl` / `bookingLinkLabel` and `warmTransfer` / `transferPlanSteps.*` — trace, certify wizard→SMS, update manifest; map into semantic route system.

### 104–105. Transfer ringing timeout + Telnyx REFER

Use `transferPlanSteps[].timeoutSeconds` / destination timeout on **both** `WarmTransferTask.ringing_timeout` and cold `TransferSIPParticipantRequest.ringing_timeout`. No `asyncio.sleep` substitute. REFER: deployment preflight or `MANUAL PRODUCTION CERTIFICATION`.

### 106. Warm transfer outbound trunk

Publish blocker if warm route enabled without outbound SIP trunk + caller ID.

### 107–109. REQUEST_ONLY, NONE, Calendly

See preamble. Calendly: hide active V3 promise; do not build provider to zero audit count.

### 110–117. Answer-when / ring, number source, scheduled activation, test/quality, custom voice, voice label/source, sessions.accept voice

Product truth: no artificial GPT-Live silence. Scheduled activation = durable job. Test/quality bind to config revision. End-to-end voice ID to `sessions.accept` with safe diagnostics (no secrets).

### 118. Long-term memory

Do **not** ship persistent caller memory in this pass. If exposed in V1 UI → hide; classify deferred.

### 119–121. Fresh delegation after revision + booking→callback pivot + general objective pivots

Fix `FRESH_DELEGATION_GAP_AFTER_REVISION` and stale scheduling mutation on objective change. Regression tests for book→callback, etc.

### 122–123. V3 DB audit + tool trace persistence

Early canonical `VoiceCall`; all tools correlate; structured operation facts (no hidden reasoning).

### 124. Realtime transcript product decision

Post-call Deepgram = canonical stored transcript unless UI promises live transcript — then implement or remove promise.

### 125–126. V2/V3 publish separation + generic receptionist

V3 authoritative for Appointment Receptionist; V2 preserved elsewhere. `/voice/agents` generic receptionist not in scope.

### 127–128. Billing / voice usage

Trace existing billing; idempotent usage keys; connect V3 if product charges; UI truth if usage shown.

### 129–131. Outbound SMS surfaces + staff notification defaults + event source

One sender resolver; notifications from canonical outcomes (BOOK_CONFIRMED, CALLBACK_CREATED, etc.).

### 132–133. answerWhen semantics + Mode 4 / V1 shell

Carrier/routing boundary vs LiveKit. Active customer routes use current shell.

### 134–136. Google legacy cleanup + advanced deferred + merge safety

No cleanup prerequisite for Google V3; deprecate dangerous duplicates; merge PR #459 per Google directive.

### 137. Microsoft regression safety

New policies **above** provider adapters only.

### 138–139. Transfer deployment preflight + infrastructure readiness view

Activation checks; optional ops readiness strip (not contact-center dashboard).

### 140. MCTB boundary regression

MCTB TeXML ≠ LiveKit V3 ingress.

### 141–142. Production sign-off + PSTN certification matrix support

Manual until evidence; checklist script output — do not fabricate PASS.

### 143. Complete #1–#184 reconciliation table

Required in gap-closure report: Original item | Disposition | Evidence | Files | Automated verification | Manual cert?

### 144. Special handling of §A (master list corrections)

DO NOT REIMPLEMENT — trace, prove, update manifest + status docs.

### 145. Zero-inert-controls gate

After implementation: no active visible control remains `CONFIGURED_NOT_IMPLEMENTED` unless UI explicitly “coming soon” — prefer hide deferred features.

### 146. Final one-pass definition

Done when FEATURE STATUS + GAP REGISTER + MASTER INCOMPLETE LIST + MANIFEST + CODE = **one product truth** (see user checklist in source addendum §146).

### 147. Do this now, in this branch

**Deliverable is implementation**, not a third audit. If an active wizard→runtime gap is discovered mid-pass, **fix it in the same pass.**

**Governing rule:** Every active customer-visible Appointment Receptionist V1 control has a real end-to-end effect, or is honestly hidden/deferred.

---

## Part III — Full section index (sections 0–147)

For the **verbatim expanded text** of sections 0–86 (RAG UI copy, test matrices, prohibited list, architecture diagram) and the **full prose** of addendum §88–147, this repository commit stores the **authoritative merged directive** in:

- **This file** — structural contract + all section numbers and requirements (above).
- **Audit line items** — `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md` (#1–#184).
- **Implementation tracking** — `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-REPORT.md` (created during implementation pass).

Cursor agents must treat **Part I + Part II + master list §1–§8** as a **single job** with **§143 reconciliation** proving every #1–#184 disposition.

---

## Appendix A — Disposition legend (reconciliation matrix)

| Disposition | Meaning |
|-------------|---------|
| IMPLEMENTED | Code + tests + manifest row updated |
| ALREADY IMPLEMENTED — MANIFEST FIXED | Runtime existed; manifest/docs corrected only |
| INTENTIONALLY HIDDEN FROM V1 | UI hidden; stored state preserved |
| LEGACY PRESERVED — NOT ACTIVE V3 | V2 / Calendly / CRM / etc. |
| MANUAL PRODUCTION CERTIFICATION | System ready; human PSTN/provider evidence pending |

---

## Appendix B — Files to update at end of pass

- `docs/AI-VOICE-AGENT-FEATURE-STATUS.md`
- `docs/AI-VOICE-AGENT-GAP-REGISTER.md`
- `docs/AI-VOICE-AGENT-INCOMPLETE-MASTER-LIST.md` (or archive after all items dispositioned in report)
- `docs/VOICE-V3-COMPLETE-GAP-CLOSURE-REPORT.md` (**create**)
- `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` (executionStatus truth)
- `.cursor/rules/voice-v3-gap-closure.mdc` (always apply for V3 gap work)

---

**End of directive.**
