# READ-ONLY AUDIT — MCTB ↔ AI Receptionist ownership toggle

**Scope:** Inspection and proposal only. This document records architecture trace findings; it is not an implementation pass.

**Task constraints (original audit):** No code, files, migrations, database state, Telnyx, routing, deploy, or product runtime changes during the trace itself. This file was added afterward at your request so you can copy the report.

**Core finding:** What actually decides which product answers a forwarded call today is **Telnyx `connection_id` on the workspace `PhoneNumber` row** (TeXML app vs Call Control app), set by **product-specific provision/publish functions**. The `phoneNumber.settingsJson.mctbInbound.inboundHandlingMode` field is **not read by MCTB TeXML ingress or Voice V3 Basic**; it is a parallel policy/UI layer that can **diverge** from provider state and can **overwrite** Voice V3 routing after publish.

**Date:** 2026-09-22 · **Baseline:** `master` (code paths as traced in repo)

---

## A. Current MCTB architecture (forwarded call → MCTB runtime)

### Mental model (three numbers)

| Role | Source |
|------|--------|
| **Customer business line** | Public number; carrier CFNA forwards to Transovo |
| **Transovo ingress DID** | `PhoneNumber.e164` from `missedCallTextConfig.phoneNumberId` (via `getProductionMctbForwardTargetE164` in `production-forward-target.ts`) |
| **Text-back sender** | Separate SMS route (`outbound-sms-route.ts`) — not voice ingress |

### 1–5. Record, config, Telnyx, TeXML app, attach functions

| Step | Evidence |
|------|----------|
| **Phone record** | `prisma.phoneNumber` — `id`, `e164`, `providerNumberId`, `settingsJson`, `workspaceId` |
| **MCTB “owns” this DID (metadata)** | `settingsJson.routingOwner === "mctb_texml"` (`MCTB_TEXML_ROUTING_OWNER`), `mctbSipIngress: true`, `telephony.routingMode === "mctb_texml"` (`sip-ingress/sync.ts`, `texml-ingress/provision.ts`) |
| **Runtime line pointer** | `missedCallTextConfig.phoneNumberId` (`agents/missed-call-text-back/config.ts`) |
| **Telnyx mutation** | `PATCH /phone_numbers/{providerNumberId}` with `{ connection_id: <texmlAppId> }` (`routePhoneToMctbTexmlIngress` in `texml-ingress/texml-route.ts`) |
| **TeXML app** | `ensureMctbTexmlApplication()` → voice URL `mctbTexmlEntryVoiceUrl()` → **`POST /api/telnyx/voice/mctb-entry`** (`texml-route.ts`, `mctb-entry/route.ts`) |
| **Canonical “make MCTB active on this DID”** | `switchDidToMctbTexmlIngress()` (`texml-ingress/provision.ts`) ← called from `provisionMctbCustomerVoice()` (`provisioning/telnyx-sip-ingress.ts`) |
| **Also** | `provisionMctbPhoneTexmlIngressModeForWorkspace()` from setup API (`api/mctb/setup/route.ts`); trial/onboarding via `provisionMctbCustomerTelnyxLocalNumber()` |

`switchDidToMctbTexmlIngress` explicitly: routes TeXML, sets telephony metadata, **unassigns** `voiceAgent.phoneNumberId` and `VoiceAgentPhoneNumber` joins for that DID (agent **configs remain**; DID link cleared).

### 6. Forwarded call hits ingress DID

1. Carrier CFNA → Transovo **ingress E164** (same DID customer was told to forward to).
2. Telnyx executes TeXML for **MCTB TeXML application** (`connection_id`).
3. **`/api/telnyx/voice/mctb-entry`** — instant path uses `buildInstantMctbInboundTexml()` (`inbound-texml.ts`) + warmed `routing-profile` (consent mode, `automationActive`, greeting token).

### 7. Press-1 vs existing consent

- **Instant answer:** `buildInstantMctbInboundTexml` — existing consent **or** `!automationActive` → voicemail TeXML; else press-1 gather (`inbound-texml.ts`).
- **Deeper tree / hangup / SMS trigger:** `texml-status-callback.ts` (referenced in `frozen-pipeline.ts`) — existing consent auto-SMS on status, press-1 gather completion, etc.

### 8. Voicemail

- `buildInstantVoicemailTexml` → `buildMctbVoicemailGreetingTexml` + record callback (`instant-voicemail-texml.ts`, `resolveStableVoicemailGreetingPlayUrl`).

### 9. Recovery eligibility

- Missed-call event creation → `evaluateMissedCallTextEligibility()` (`eligibility.ts`) — consent, triggers, opt-out, cooldown/`maxMessagesPerCaller`, **`isMctbSchedulePaused`** → `MCTB_DISABLED`, send window.
- SMS send uses `missedCallTextConfig` + template vars.

### 10. MCTB paused (not ownership switch)

- Pause: `!config.enabled` / `pauseUntil` / `manuallyPaused` → `isMctbAutomationActive` **false** (`schedule-shared.ts`).
- **TeXML:** `automationActive` in routing profile → instant branch **`paused_voicemail`** (press-1 path) or existing-consent voicemail (`inbound-texml.ts`).
- **SMS:** `MCTB_DISABLED` in eligibility when not `demoMode`.
- **Telnyx `connection_id`:** Not changed by pause (no evidence in schedule code); ingress stays MCTB TeXML.
- **`mctbInbound.inboundHandlingMode`:** Unchanged by pause; defaults remain `MCTB_RECOVERY` if unset (`line-config-parse.ts`).

**Frozen pipeline:** MCTB ingress code under `texml-ingress/` does **not** reference `inboundHandlingMode`. Working MCTB is **connection + mctb_texml metadata + mctb-entry**, not the inbound-handling enum.

---

## B. Current AI Receptionist / Voice V3 architecture (working path)

**Do not treat `setInboundHandlingMode(VOICE_AGENT)` as the Voice V3 product path.** It calls `routePhoneToTexmlAssistant` (Telnyx AI Assistant TeXML URL). Voice V3 appointment receptionist uses a **different** path.

### How a number gets Voice V3 today

| Step | Evidence |
|------|----------|
| **Wizard / agent** | `VoiceAgent` + `draftConfig` / published `VoiceAgentVersion`; `advanced.capabilityPack === "appointment_receptionist"` → `isAppointmentReceptionistAgent` (`voice-v3/config/from-published-agent.ts`) |
| **Phone association** | `voiceAgent.phoneNumberId` + `VoiceAgentPhoneNumber` join (`voice/agent-phone.ts` `syncVoiceAgentPhoneAssignment`) |
| **Activate (appointment receptionist)** | `POST /api/solutions/appointment-receptionist` `action: "activate"` → `activateFlowTriggers()` → **`publishVoiceAgent()`** (`automations/trigger-deployments.ts`, `appointment-receptionist/route.ts`) |
| **Publish routing for V3** | In `publishVoiceAgent()` when `voiceV3AppointmentReceptionist`: **`routePhoneToVoiceV3BasicCallControl()`** (`voice/agent-service.ts` ~667–707) |
| **Telnyx destination** | Call Control app from `findOrCreateVoiceV3BasicCallControlApp` → webhook **`/api/telnyx/voice/v3-basic`** (`route-phone-to-voice-v3-basic.ts`, `v3-basic/route.ts`) |
| **Inbound call** | `call.initiated` → `forwardInboundCallToOpenAiLiveSip` (`voice-v3-basic/telnyx-webhook-handler.ts`) |
| **Runtime** | `startAppointmentReceptionistVoiceV3OnCall` used from broader Telnyx stack (`voice-v3/start-appointment-receptionist-pstn.ts`, `webhook-handlers.ts`, `voice/inbound.ts`) — GPT-Live SIP transfer, not MCTB TeXML |
| **Agent binding on PSTN** | `tryNotePstnWizardBindingFromToE164` — workspace by **To** E164, latest **published** appointment receptionist (`resolve-pstn-wizard-binding.ts`) |
| **Live draft sync** | `syncLiveWizardDraftToProvider()` — for V3 agent, **`routePhoneToVoiceV3BasicCallControl`** again (`agent-service.ts` ~848–857) |

**Voice V3 does not import or read `mctbInbound` or `inboundHandlingMode`** (grep under `src/lib/voice-v3` is empty).

### Publish / takeover side effects (assignment layer)

- `publishVoiceAgent` with appointment wizard: `allowMctbTexmlVoiceAgentTakeover: true` → may **`clearMctbTexmlIngressLockMetadataForVoiceAgent`** (`mctb-voice-agent-phone-takeover.ts`) — clears `routingOwner`, `mctbSipIngress`, telephony routing fields on **phone settings** (not `missedCallTextConfig` message/consent).
- `activateFlowTriggers` with `forceTakeover: true` — claims DID, calls `publishVoiceAgent`.

---

## C. Separation boundary (where they diverge)

```
Customer business line (CFNA)
        │
        ▼
Single Transovo PhoneNumber.e164 (typical same-number product model)
        │
        ▼
Telnyx phone_numbers.connection_id  ◄── AUTHORITATIVE for who answers
        │
   ┌────┴────┐
   │         │
   ▼         ▼
MCTB TeXML     Voice V3 Basic Call Control
app id         app id
   │         │
   ▼         ▼
/api/telnyx/   /api/telnyx/voice/v3-basic
voice/mctb-entry
   │         │
   ▼         ▼
Frozen MCTB    OpenAI Live SIP + Voice V3
pipeline       (Sol, tools, booking, etc.)
```

**Below the boundary:** No shared call-processing pipeline between the two (by design in repo: separate webhooks, separate runtimes).

**Above the boundary (today, fragmented):**

- MCTB activate: `switchDidToMctbTexmlIngress` / `provisionMctbCustomerVoice`
- Voice activate: `publishVoiceAgent` → `routePhoneToVoiceV3BasicCallControl`
- **Plus** optional `setInboundHandlingMode` (TeXML assistant — **third** destination)
- **Plus** legacy `setCallHandlingMode(..., "mctb")` on Numbers (metadata + `missedCallTextConfig.phone_number_id`, not always TeXML route)

---

## D. Phone / DID relationship

**Answer: (A) Same Transovo DID, mutate inbound destination** — for the common “one number” appointment receptionist + MCTB workspace model.

| Evidence | Detail |
|----------|--------|
| Forwarding target | `getProductionMctbForwardTargetE164(workspaceId)` uses **`missedCallTextConfig.phoneNumberId`** |
| Receptionist wizard | `state.phoneNumberId` on same `PhoneNumber` row for activate |
| Telnyx | One `providerNumberId` per row; **`connection_id` overwritten** by whichever provision/publish ran last |
| **Not** separate hidden MCTB vs voice DIDs in code path | Same `e164`; role is **connection + settingsJson**, not two DIDs |

**Implication for toggle:** Customer-facing switch is **“point this DID’s `connection_id` at product A or B”** plus **minimal assignment/metadata** each product already expects — not two parallel numbers.

---

## E. Current routing operations (make each product “active”)

| Product | Existing operation(s) | Provider mutation | DB besides `connection_id` |
|---------|----------------------|-------------------|------------------------------|
| **MCTB** | `switchDidToMctbTexmlIngress`, `provisionMctbCustomerVoice` | `routePhoneToMctbTexmlIngress` → MCTB TeXML `connection_id` | `routingOwner`, `mctbSipIngress`, `telephony.routingMode`, optional `mctbTexmlPreviousConnectionId`; clears voice **DID assignment** on that number |
| **Voice V3 receptionist** | `publishVoiceAgent` (activate), `syncLiveWizardDraftToProvider` (live draft) | `routePhoneToVoiceV3BasicCallControl` → V3 Basic CC `connection_id`; `metadata.voiceV3Basic` | `voiceAgent.phoneNumberId`, join table; may clear MCTB lock **metadata** via takeover helper |
| **Legacy / wrong for V3** | `setInboundHandlingMode(VOICE_AGENT)` | `routePhoneToTexmlAssistant` → **Telnyx AI Assistant TeXML** | `settingsJson.mctbInbound` (`inboundHandlingMode`, `voiceTexmlAppId`, etc.) |
| **Numbers UI (partial)** | `setCallHandlingMode(..., "mctb")` | Blocked if `mctbSipIngress` frozen; else sets `callHandlingMode`, assigns `missedCallTextConfig.phone_number_id` | Does **not** by itself equal full TeXML provision |

**Smallest toggle concept (not implemented):**

- `setActiveCallHandler("mctb")` → call **`switchDidToMctbTexmlIngress`** (or idempotent verify + route).
- `setActiveCallHandler("ai_receptionist")` → call **`routePhoneToVoiceV3BasicCallControl`** + ensure published agent + `syncVoiceAgentPhoneAssignment` (reuse publish prerequisites), **not** `setInboundHandlingMode` TeXML assistant path for V3.

---

## F. Current ownership state (who “claims” the number)

| Field / store | Claims |
|---------------|--------|
| **Telnyx `connection_id`** | **Effective owner** (MCTB TeXML app vs V3 CC vs TeXML assistant) |
| `phoneNumber.settingsJson` | `routingOwner`, `mctbSipIngress`, `telephony.*`, `callHandlingMode`, **`mctbInbound.*`** |
| `missedCallTextConfig.phoneNumberId` | MCTB logical line |
| `voiceAgent.phoneNumberId` + `VoiceAgentPhoneNumber` | AI inbound owner (join table used for routing lookups) |
| `mctbInbound.inboundHandlingMode` | `MCTB_RECOVERY` (default) or `VOICE_AGENT` — **policy/UI only** for MCTB inbound-handling API; **not** TeXML ingress |
| `resolveInboundHandlingDecision()` | Reads `mctbInbound`; **does not** change Telnyx |

---

## G. Conflicts / legacy / source-of-truth problem

1. **Three destinations on one DID:** MCTB TeXML, V3 Basic CC, TeXML-direct assistant (`setInboundHandlingMode`).
2. **`mctbInbound` vs Telnyx:** UI can show “Voice Agent” while `connection_id` still MCTB (or vice versa) if only one layer updated.
3. **`/numbers/[id]/call-handling`:** `callHandlingMode` ∈ `unconfigured | call_forwarding | smart_routing | mctb` (`call-handling-mode-shared.ts`) — Smart Routing / call forwarding product modes; **`mctb` here ≠ inbound ownership toggle**; frozen MCTB numbers **reject** mode changes (`isFrozenMctbSipIngress`).
4. **Post-activate overwrite risk (evidence):** After `activateFlowTriggers` → `publishVoiceAgent` (V3 CC route), appointment receptionist route calls **`setInboundHandlingMode(VOICE_AGENT)`** when `isMctbV1Primary()` (`appointment-receptionist/route.ts` ~392–417) — **`routePhoneToTexmlAssistant`** may **replace** V3 `connection_id`. Same pattern on **`save_draft`** + live sync (~186–217). Failures are `.catch` → warnings only → **DB may say VOICE_AGENT while Telnyx stays V3** (inconsistent the other way).

---

## H. Publish vs ownership

| Question | Finding |
|----------|---------|
| **When does publish change routing?** | **Activate:** `activateFlowTriggers` → `publishVoiceAgent` → V3 `routePhoneToVoiceV3BasicCallControl`. **Then** (MCTB V1 primary) `setInboundHandlingMode(VOICE_AGENT)`. **Live draft save:** `syncLiveWizardDraftToProvider` routes (V3 or TeXML assistant), then optional `setInboundHandlingMode`. |
| **Why** | Historical “same number” MCTB + after-hours voice; `mctbInbound` model conflates **ownership** with **TeXML assistant** path. |
| **Override explicit MCTB selection?** | **Yes, risk:** activate/live-sync can force `VOICE_AGENT` + TeXML assistant routing without a customer toggle. |
| **Onboarding required?** | Not proven required for Voice V3 CC; **extra** `setInboundHandlingMode` is not the V3 ingress mechanism. |
| **Later publishes** | **Yes** — any activate or live `save_draft` on ACTIVE agent can re-run routing + `setInboundHandlingMode`. |
| **Smallest future fix (proposal only)** | **Decouple:** publish/sync only updates **agent config + V3 route**; **separate explicit** `setActiveCallHandler` customer action; **remove or gate** `setInboundHandlingMode` on publish when handler ≠ voice (feature flag / ownership field). |

---

## I. Pause behavior (MCTB recovery paused ≠ ownership switch)

| Expectation | Current code |
|-------------|--------------|
| Active handler stays MCTB | Pause does not change `connection_id` or switch to AI |
| Voicemail still answers | `!automationActive` → `paused_voicemail` / existing-consent VM (`inbound-texml.ts`) |
| No recovery SMS | `MCTB_DISABLED` in eligibility |
| No dead endpoint | TeXML still returned from mctb-entry |

**Does not** flip `inboundHandlingMode` or Voice routing. **Satisfied** for ownership; pause is **recovery SMS + automation flag**, not handler switch.

---

## J. Configuration preservation (switching hypothetical)

### Can remain untouched (product config blobs)

| MCTB | AI Receptionist |
|------|-----------------|
| Consent, template, triggers, cooldown, pause, exclusions, voicemail greeting assets, request form, booking link config, notifications, histories | Wizard state, draft/published versions, prompt, voice, KB, booking, calendars, transfers, schedules, call history |

**None of these are deleted by routing functions alone.**

### What **does** change today (violates “only flip destination” if not careful)

| Action | Effect |
|--------|--------|
| `switchDidToMctbTexmlIngress` | Clears **`voiceAgent.phoneNumberId`** and joins on that DID — **receptionist config intact**, must **re-link DID** when switching back to AI |
| `clearMctbTexmlIngressLockMetadataForVoiceAgent` | Clears MCTB **phone metadata** flags (not message template) |
| `setInboundHandlingMode` | Updates `mctbInbound` + Telnyx; sets `voiceAgentEnabled` false for MCTB mode |
| Exclusive phone assignment | One “primary” DID per agent pattern |

**AI → MCTB → AI:** Agent row and published version remain; **DID assignment** may need restore on return.

**MCTB → AI → MCTB:** `missedCallTextConfig` unchanged; **MCTB phone metadata** may have been cleared on voice takeover; **re-provision** may be needed to restore `mctbSipIngress` flags.

---

## K. Proposed toggle architecture (smallest, above both stacks)

1. **New persisted field (recommendation):** `activeCallHandler: "mctb" | "ai_receptionist"` (workspace or phone-scoped) — **do not overload** `mctbInbound.inboundHandlingMode` as sole source of truth without aligning Telnyx.
2. **Customer changes toggle** → server validates readiness (MCTB: forwarding/DID provisioned; AI: published appointment receptionist + entitlement).
3. **MCTB on:** invoke **`switchDidToMctbTexmlIngress`** (idempotent verify); set handler field; **do not** touch Voice agent config.
4. **AI on:** invoke **`routePhoneToVoiceV3BasicCallControl`** + **`syncVoiceAgentPhoneAssignment`** for chosen agent; set handler field; **do not** call `routePhoneToTexmlAssistant` for V3.
5. **Provider confirm:** reuse `matched` / `verifyMctbTexmlIngressRoute` / V3 route `matched` flags.
6. **Persist handler only after provider success** (see M).
7. **Stop coupling publish to ownership** (section H).

**No new shared pipeline** — only orchestration calling existing entrypoints.

---

## L. Proposed UI location (no implementation)

| Option | Rationale |
|--------|-----------|
| **Primary:** MCTB Overview + Receptionist home **when same DID** | Matches IA: “is it working / who answers?” |
| **Secondary:** `PhoneNumber` detail (`/numbers/[id]`) | Already has `CallHandlingModePanel` — but today that is **SR/CF/MCTB purchase mode**, not MCTB↔AI |
| **Avoid only:** buried solely on MCTB Voice Agent page (`CallHandlingModeSwitch`) — wrong product framing for “AI Receptionist” |

Copy aligned with your selector (AI answers vs MCTB consent/VM/text). Show **effective handler** from **Telnyx verify + handler field**, not only `mctbInbound` label.

---

## M. Failure / rollback (proposal)

**Principle:** If Telnyx PATCH fails, **do not** persist `activeCallHandler` as AI (or MCTB).

**Existing hooks:**

- `routePhoneToMctbTexmlIngress` returns `previousConnectionId`, stores `telephony.mctbTexmlPreviousConnectionId`.
- V3 route returns `matched` boolean.
- `publishVoiceAgent` has **rollbackPublish** on failure (voice product internal).

**Proposed toggle transaction:**

1. Read live `connection_id` (before).
2. Call target product route.
3. Verify `matched`.
4. Only then update ownership field.
5. On failure: leave prior `connection_id` (or PATCH back using `previousConnectionId` if captured).

`setInboundHandlingMode` today updates DB **after** Telnyx in some paths but appointment wizard **catches errors** → **partial state** already possible.

---

## N. Future files likely to change (list only — not modified in this audit)

- New thin orchestration: e.g. `src/lib/call-ownership/` or extend `inbound-handling` **without** merging runtimes
- `src/app/api/...` ownership PATCH (new or replace misuse of `/api/mctb/inbound-handling`)
- UI: MCTB overview, receptionist wizard/summary, numbers panel (read-only display + toggle)
- `src/app/api/solutions/appointment-receptionist/route.ts` — **gate** `setInboundHandlingMode` on publish
- `src/lib/voice/agent-service.ts` — optional: ownership-aware publish (route only, don’t steal handler)
- Docs only

---

## O. Protected systems (ZERO internal changes for toggle goal)

**MCTB:** `mctb-entry`, `inbound-texml`, `frozen-pipeline`, consent TeXML, `texml-status-callback`, eligibility, SMS dispatch, voicemail play URLs, forwarding verification, `evaluateMissedCallTextEligibility`.

**Voice V3:** `voice-v3-basic` webhook, `route-phone-to-voice-v3-basic`, `start-appointment-receptionist-pstn`, OpenAI SIP forward, Sol/tools/booking/transfer/post-call under `src/lib/voice-v3/**`, published config compile path.

Toggle should only **call** provision/route entrypoints at the **Telnyx boundary**.

---

## P. Risks / decisions (evidence-based)

| # | Issue | Decision needed |
|---|--------|-----------------|
| 1 | **`setInboundHandlingMode` ≠ Voice V3** and may **overwrite** V3 CC after activate | Stop using for V3; use only `routePhoneToVoiceV3BasicCallControl` for AI handler |
| 2 | **`mctbInbound` not read by either ingress** | Use as UI hint only unless wired to orchestration + Telnyx verify |
| 3 | **DID assignment cleared** when MCTB provision runs | Accept re-assign on AI switch, or preserve join in orchestration without deleting configs |
| 4 | **Publish steals ownership** today on MCTB V1 primary | Must separate publish from handler toggle |
| 5 | **Three Telnyx destinations** on one number | Confirm TeXML-assistant path is **out of scope** for launch toggle |
| 6 | **Which agent** if multiple published receptionists? | `tryNotePstnWizardBindingFromToE164` picks latest — toggle should pin **one** canonical agent id |

---

## Side-by-side comparison (section 3)

| Layer | MCTB | AI Receptionist (Voice V3) |
|-------|------|----------------------------|
| Customer business number | `mctbOnboarding.businessNumberE164` / setup | Same (wizard) |
| Forwarding destination | `getProductionMctbForwardTargetE164` → ingress `PhoneNumber.e164` | Same DID when shared |
| Transovo DID | `missedCallTextConfig.phoneNumberId` → `PhoneNumber` | `voiceAgent.phoneNumberId` / wizard `state.phoneNumberId` (often **same row**) |
| Persisted ownership/config | `settingsJson.routingOwner=mctb_texml`, `mctbSipIngress`, `telephony.routingMode=mctb_texml`; optional `mctbInbound` | `metadata.voiceV3Basic`, published `VoiceAgent`, join table; optional `mctbInbound` (legacy) |
| Telnyx connection/application | MCTB **TeXML application** id (`ensureMctbTexmlApplication`) | **Call Control** app (`findOrCreateVoiceV3BasicCallControlApp`) |
| Activation/routing function | `switchDidToMctbTexmlIngress` / `provisionMctbCustomerVoice` | `publishVoiceAgent` → `routePhoneToVoiceV3BasicCallControl`; live: `syncLiveWizardDraftToProvider` |
| Inbound entrypoint | `POST /api/telnyx/voice/mctb-entry` | `POST /api/telnyx/voice/v3-basic` |
| Call-processing runtime | Frozen TeXML → consent/VM → status callbacks → missed call → SMS | CC answer → OpenAI Live SIP → Voice V3 runtime |
| Voicemail | MCTB TeXML Play+Record (`instant-voicemail-texml`) | Receptionist handles in-call (no MCTB VM tree) |
| Product configuration storage | `missedCallTextConfig`, workspace `customFieldsConfig.mctb*`, onboarding state | `VoiceAgent` / versions, `SolutionSetup` appointment receptionist |
| Publish behavior | Setup/onboarding provision TeXML; not Voice publish | Activate → `publishVoiceAgent` + (problematic) `setInboundHandlingMode` |

---

## Hypothetical minimum state changes (section 6)

### MCTB → AI Receptionist

| Must change | Need not change |
|-------------|-----------------|
| Telnyx `connection_id` → V3 Basic CC app | MCTB consent, template, pause, exclusions, VM audio assets, form, histories |
| `voiceAgent.phoneNumberId` + join (if exclusive model kept) | Voice draft/published config content |
| `activeCallHandler` (future) | Workspace SMS/compliance unrelated to voice |
| Optionally restore phone settings if MCTB lock was cleared earlier | |

### AI Receptionist → MCTB

| Must change | Need not change |
|-------------|-----------------|
| Telnyx `connection_id` → MCTB TeXML app | Voice agent versions, prompts, calendars |
| `settingsJson` MCTB telephony metadata (`switchDidToMctbTexmlIngress`) | |
| Clear voice DID assignment on that number (today’s MCTB provision behavior) | Voice agent rows themselves |
| `activeCallHandler` (future) | |

**Can it be “only provider destination”?** **Almost** — but MCTB provision today also **normalizes phone metadata** and **unassigns voice DID**; AI publish **clears MCTB lock metadata**. True preservation needs **orchestration** that separates **Telnyx PATCH** from **assignment side effects** (future design choice).

---

## `mctbInbound` model audit (section 10)

| Question | Finding |
|----------|---------|
| Predates Voice V3? | Yes — `VOICE_AGENT` + `routePhoneToTexmlAssistant` predates V3 Basic CC path |
| VOICE_AGENT = old voice? | Often **Telnyx AI Assistant TeXML**, not V3 |
| Voice V3 trusts it? | **No** — no references under `src/lib/voice-v3` |
| MCTB TeXML trusts it? | **No** — `texml-ingress/` does not read `inboundHandlingMode` |
| Safe as customer ownership without coupling? | **Only if** paired with Telnyx verify + correct route functions; **not** alone |
| Other authoritative field? | **Telnyx `connection_id`** on `PhoneNumber` |

**Recommendation:** Introduce explicit `activeCallHandler` (or equivalent) at orchestration layer; treat `mctbInbound` as legacy unless migrated deliberately.

---

## Confirmation (section 15)

A customer-facing toggle **can** sit above existing operations **without** redesigning MCTB TeXML or Voice V3 internals **if**:

- It calls **`switchDidToMctbTexmlIngress`** and **`routePhoneToVoiceV3BasicCallControl`** (plus existing readiness checks),
- It **does not** route Voice through MCTB TeXML or MCTB through LiveKit,
- It **removes or gates** publish-time **`setInboundHandlingMode`** so publish does not steal ownership.

**If you required using `setInboundHandlingMode(VOICE_AGENT)` as the AI path:** that **would** require treating TeXML-assistant as Voice V3 or changing that function — **not** recommended; evidence shows V3 uses a different entrypoint.

---

## Bottom line

- **MCTB active today** = `switchDidToMctbTexmlIngress` / `provisionMctbCustomerVoice` → MCTB TeXML `connection_id` → `mctb-entry`.
- **AI Receptionist active today** = `publishVoiceAgent` / `syncLiveWizardDraftToProvider` → `routePhoneToVoiceV3BasicCallControl` → `v3-basic` → GPT-Live.
- **Toggle** = orchestrate those two provider operations + a clear ownership field; **fix publish coupling** separately so configuring one product does not silently repoint the DID.

---

## Appendix — Key file index

| Topic | Files |
|-------|--------|
| MCTB provision / route | `src/lib/mctb/texml-ingress/provision.ts`, `texml-route.ts`, `src/lib/mctb/provisioning/telnyx-sip-ingress.ts` |
| MCTB ingress HTTP | `src/app/api/telnyx/voice/mctb-entry/route.ts` |
| MCTB instant TeXML | `src/lib/mctb/texml-ingress/inbound-texml.ts` |
| MCTB pause / eligibility | `src/lib/mctb/schedule-shared.ts`, `src/lib/agents/missed-call-text-back/eligibility.ts` |
| Legacy inbound-handling API | `src/lib/mctb/inbound-handling/switch-mode.ts`, `src/app/api/mctb/inbound-handling/route.ts` |
| Voice V3 route | `src/lib/voice-v3/provisioning/route-phone-to-voice-v3-basic.ts` |
| Voice V3 webhook | `src/app/api/telnyx/voice/v3-basic/route.ts`, `src/lib/voice-v3-basic/telnyx-webhook-handler.ts` |
| Voice publish | `src/lib/voice/agent-service.ts` (`publishVoiceAgent`, `syncLiveWizardDraftToProvider`) |
| Receptionist activate | `src/app/api/solutions/appointment-receptionist/route.ts` |
| Numbers call-handling | `src/lib/numbers/call-handling-mode.ts`, `call-handling-mode-shared.ts` |
| Phone assignment | `src/lib/voice/agent-phone.ts`, `src/lib/voice/mctb-voice-agent-phone-takeover.ts` |
| MCTB lock metadata | `src/lib/mctb/sip-ingress/sync.ts` |
