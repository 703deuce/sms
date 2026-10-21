# New-App Phone Number Provisioning Matrix

**Purpose:** One place to see what must be provisioned for **Phone (inbound/outbound)**, **Call Forwarding**, **AI Receptionist (Conversational IVR / Voice V3)**, and **Missed Call Text Back (MCTB)** — and why you cannot today flip all four on the same DID without changing **Telnyx carrier ingress**.

**Audience:** Product + engineering planning a **single-provision** model.

**Code authority (new-app):** `new-app/lib/server/telephony/*`, `new-app/lib/server/phone/*`, `switchNumberToProduct` in `switch-product.ts`.

**Legacy MCTB (CFNA / customer forwards to toll-free):** `src/lib/mctb/texml-ingress/*`, `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` — separate product path; not merged into Phone Call Control in this doc’s “target” section.

---

## 1. The hard constraint (carrier layer)

On Telnyx, each **voice DID** has **one active `connection_id`** at a time. That connection decides **where the first inbound leg goes**:

| Telnyx connection target | Product voice path | Webhook / media entry |
|--------------------------|------------------|------------------------|
| **Call Control Application** | Transovo **Phone** | `POST /api/telnyx/phone` (`call.initiated`, `call.hangup`, …) |
| **TeXML Application** | Legacy **MCTB CFNA** | `POST /api/telnyx/voice/mctb-entry` (frozen pipeline) |
| **FQDN → LiveKit SIP** | **AI Receptionist (Voice V3)** | SIP → LiveKit → worker (`resolve-livekit-session.ts`) |

**Only one of these can own inbound PSTN for a given DID at once.** Switching products in Numbers runs `switchNumberToProduct`, which **parks** the prior config in `settingsJson.telephonyPark.snapshots` and **patches** the DID to a new connection (`applyTelnyxConnectionWithVerify`).

Logical features (forwarding rules, MCTB config, agent assignment) can live in **Postgres** at the same time; **voice ingress** cannot all be active on one DID without a **unified Call Control orchestrator** (not built yet).

---

## 2. Canonical persistence (what “provisioned” means in DB)

### 2.1 Per-number telephony ingress (carrier + runtime mode)

**Path:** `phoneNumber.settingsJson.telephony` (read/write via `readTelephonyProvision` / `writeTelephonyProvision` in `telephony-record.ts`).

| Field | Meaning |
|-------|---------|
| `routingMode` | `telnyx_call_control` \| `livekit_sip` \| `mctb_texml` |
| `state` | `pending` \| `provisioning` \| `active` \| `error` \| `removed` |
| `telnyxConnectionId` | Last known Telnyx connection applied to this DID |
| `telnyxTexmlAppId` | MCTB TeXML app id (MCTB mode) |
| `telnyxFqdnConnectionId` / `livekitInboundTrunkId` / `livekitDidDispatchRuleId` | Receptionist LiveKit path |
| `lastVerifiedAt` / `lastError` | Provision health |

**Binding detection:** `detectNumberProductBindings` in `bindings.ts` maps active `routingMode` + `state === "active"` to nav products: `phone`, `receptionist`, `mctb`.

**Parked snapshots:** `settingsJson.telephonyPark.snapshots[]` — previous product ingress before a switch (`ingress-park.ts`).

### 2.2 Phone answering & call forwarding (logical — Call Control)

**Not** the same as carrier ingress; used when `routingMode` allows Phone Call Control runtime.

| Store | Table / path | Used for |
|-------|----------------|----------|
| Per-DID answering policy | `phoneNumberAnsweringPolicy` | `answeringMode`: `browser` \| `forward` \| `greeting_then_forward` \| `auto_attendant` \| `voicemail`; `primaryDestinationId`; `forwardingGroupId`; pause; schedule/holiday JSON |
| Forward destinations | `forwardingDestination` | External E.164 or workspace_number; press-1/screening; ring timeout |
| Ring groups | `forwardingGroup` + members | Simultaneous / sequential forward |
| Effective routing | `resolveEffectiveAnswering` | Maps policy → `forward` / `forward_group` / `browser` / … **Blocked** if active `mctb_texml` or `livekit_sip` (`forwarding-runtime-gate.ts`) |

**Runtime:** Inbound `call.initiated` → `processInboundCallInitiated` → if effective is `forward*` → `startForwardingFlow` → `dialPstnLeg` (`forwarding-service.ts`). Events on same webhook: `routing-webhook.ts` (`cf_*` client_state kinds).

**Provision trigger (Phone forwarding):** `routeNumberToPhoneCallControl` (`product-routes.ts`) — sets DID to `TELNYX_CALL_CONTROL_APP_ID` or `TELNYX_CONNECTION_ID`. Called from Numbers **Phone** switch and (after recent fix) when saving forward policy / inbound forward intent (`ensure-phone-call-control.ts`).

### 2.3 Workspace-level Phone shell (browser ring, legacy external forward)

| Store | Path | Used for |
|-------|------|----------|
| Workspace call routing | `workspaceCallRouting.policyJson` | `duringHours` / `afterHours` / `noAnswer`, `ringTimeout`, `externalForwardE164`, `mctbEnabled`, `aiCoverage`, `receptionistAgentId`, `numberId` |

Used when per-DID policy resolves to **`browser`** or for **overflow** semantics documented in UI — not a substitute for `phoneNumberAnsweringPolicy` forward mode. Inbound bridge to WebRTC uses `workspaceCallRouting` + `PHONE_INBOUND_BRIDGE_WEBRTC` (`inbound-runtime.ts`, `inbound-webrtc-bridge.ts`).

### 2.4 AI Receptionist (logical + LiveKit ingress)

| Store | Purpose |
|-------|---------|
| `voiceAgent` + published version | Agent config, tools, prompts |
| `voiceAgentPhoneNumber` | Assignment: `phoneNumberId`, `inboundEnabled`, link to agent |
| `settingsJson.telephony` with `livekit_sip` + `active` | Carrier ingress to LiveKit |

**Provision sequence:** `prepareVoiceV3LiveKitDestination` → `activateVoiceV3TelnyxIngress` (`v3-receptionist-provision.ts`):

1. Ensure Telnyx **FQDN connection** to LiveKit SIP (`ensureTelnyxLiveKitFqdnConnection`).
2. Ensure LiveKit **inbound trunk** for DID + **dispatch rule** (`ensureInboundTrunkForNumber`, `ensureCanonicalV3SharedDispatchRule`).
3. **Patch Telnyx number** `connection_id` to FQDN connection.
4. Write `routingMode: livekit_sip`, `state: active`.

**Inbound resolution:** PSTN → LiveKit → `resolveReceptionistByCalledNumber` (`routing-resolve.ts`) → Voice V3 session (`resolve-livekit-session.ts`).

**Numbers UI:** `switchNumberToProduct({ targetProduct: "receptionist", ingressStrategy: "shared_voice" })` parks prior ingress, provisions LiveKit, and can **merge** `workspaceCallRouting.policyJson` with `receptionistAgentId` + `aiCoverage` without deleting Phone policy fields (`switch-product.ts`).

**Important:** While `livekit_sip` is **active**, Phone **Call Forwarding** runtime is **disabled** (`forwarding-runtime-gate.ts`) because webhooks no longer hit `/api/telnyx/phone`.

### 2.5 Missed Call Text Back

Two different architectures:

#### A) Legacy CFNA MCTB (monolith, frozen)

| Layer | Provision |
|-------|-----------|
| Customer business line | Carrier CFNA → workspace **ingress TFN** / MCTB DID |
| Telnyx | DID on **TeXML app** (`MCTB_TEXML_APP_ID`) |
| `settingsJson.telephony` | `routingMode: mctb_texml`, `state: active` via `routeNumberToMctbTexml` |
| Voice | `mctb-entry` TeXML — press-1 or existing_consent voicemail (`MCTB_FINAL_PRODUCTION_PIPELINE.md`) |
| SMS | Platform / workspace sender via `src/lib/agents/missed-call-text-back/*` — **not** the business DID as SMS FROM for platform mode |

**Switching a DID to MCTB in Numbers** calls `routeNumberToMctbTexml` — **replaces** Call Control / LiveKit ingress.

#### B) Phone-owned MCTB (new-app, Transovo DID)

| Layer | Provision |
|-------|-----------|
| Voice ingress | **Same as Phone:** `telnyx_call_control` — inbound handled in `processInboundCallInitiated` |
| Enable per line | `phoneNumber.settingsJson.mctbInbound.enabled` |
| Workspace recovery | `missedCallTextConfig` + `workspace.customFieldsConfig.mctb` (template, consent, pause, cooldown) |
| Trigger | Terminal **missed** `humanCall` → `processPhoneOwnedMctbMissedCall` (no separate TeXML) |
| SMS | **Platform sender** (`resolveCanonicalMctbPlatformSender` / env `VOICE_OUTBOUND_SMS_*`) — voice DID ≠ SMS FROM |

**No extra Telnyx connection** for MCTB on owned numbers — MCTB is an **automation on Phone call outcomes**, not a fourth ingress mode.

---

## 3. Feature-by-feature checklist

### 3.1 Phone — inbound (browser / voicemail / menu on Call Control)

| Step | What | Where / env |
|------|------|-------------|
| 1 | Telnyx API | `TELNYX_API_KEY` |
| 2 | Call Control app id | `TELNYX_CALL_CONTROL_APP_ID` or `TELNYX_CONNECTION_ID` |
| 3 | Webhook URL | Call Control app → `https://<app>/api/telnyx/phone` |
| 4 | DID on that connection | `routeNumberToPhoneCallControl` → `settingsJson.telephony`: `telnyx_call_control` + `active` |
| 5 | Workspace row | `phoneNumber` Active, workspace-scoped |
| 6 | Answering policy (optional) | `phoneNumberAnsweringPolicy` — default effective path may be `browser` |
| 7 | WebRTC bridge (optional) | `TELNYX_TELEPHONY_CREDENTIAL_ID`, WebRTC connection envs; `PHONE_INBOUND_BRIDGE_WEBRTC` ≠ `0` |

**Runtime:** `call.initiated` → `handleInboundCall` → `processInboundCallInitiated` → answer/bridge/voicemail/menu/forward per `resolveEffectiveAnswering` + `decideInboundRoute`.

### 3.2 Phone — outbound (dialer / WebRTC)

| Step | What | Where / env |
|------|------|-------------|
| 1 | Same Call Control / connection as inbound | Outbound legs created via `POST /v2/calls` with `connection_id` |
| 2 | WebRTC credential | `TELNYX_TELEPHONY_CREDENTIAL_ID`, optional `TELNYX_WEBRTC_*` |
| 3 | Caller ID | Workspace default / selected `phoneNumber.e164` (`resolveCallerIdNumber`) |
| 4 | DB | `humanCall` direction `outbound`, `mediaMode: webrtc` (`createWebRtcOutboundCall`) |

Outbound does **not** change the DID’s inbound `connection_id`; it uses the **Call Control application** and workspace numbers.

### 3.3 Call forwarding (external PSTN, ring groups, press-1 screen)

| Step | What | Where |
|------|------|--------|
| 1 | **Requires Phone Call Control ingress** | `telnyx_call_control` + `active` (or auto-provision on policy save) |
| 2 | Destinations | `forwardingDestination` rows |
| 3 | Policy | `phoneNumberAnsweringPolicy.answeringMode = forward` (or group / greeting_then_forward) + `primaryDestinationId` |
| 4 | Telnyx | Inbound webhook → `startForwardingFlow` → `dialPstnLeg` to destination E.164 |
| 5 | Follow-up events | `/api/telnyx/phone` → `processCallForwardingWebhookEvent` (`cf_inbound`, `cf_outbound`, `cf_screening`) |

**Fails silently (historically)** if telephony block missing: policy saved in UI but effective path stayed `browser`. Mitigation: `ensurePhoneCallControlForForwarding` + relaxed gate (`forwarding-runtime-gate.ts`).

### 3.4 AI Receptionist (Voice V3)

| Step | What | Where / env |
|------|------|-------------|
| 1 | LiveKit | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| 2 | Telnyx FQDN → SIP | `TELNYX_LIVEKIT_FQDN_CONNECTION_ID` (or auto-created) |
| 3 | DID patched to FQDN connection | `activateVoiceV3TelnyxIngress` |
| 4 | DB telephony | `routingMode: livekit_sip`, `state: active` |
| 5 | Agent assignment | `voiceAgentPhoneNumber` + published agent version |
| 6 | Optional shared policy | `workspaceCallRouting.policyJson.receptionistAgentId`, `aiCoverage` |

**Inbound does not use** `/api/telnyx/phone` for media path — uses LiveKit SIP ingress.

### 3.5 MCTB

| Mode | Voice provision | SMS provision | Trigger |
|------|-----------------|---------------|---------|
| **CFNA legacy** | `mctb_texml` + TeXML app | Monolith MCTB sender rules + platform option | TeXML terminal / consent gather |
| **Phone-owned (new-app)** | **Shared with Phone** (`telnyx_call_control`) | Platform sender env / `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | Missed `humanCall` after Phone routing |

Per-line: `mctbInbound.enabled`, workspace `missedCallTextConfig`, consent in `customFieldsConfig.mctb`.

---

## 4. Environment variables (shared infrastructure)

| Variable | Used by |
|----------|---------|
| `TELNYX_API_KEY` | All Telnyx API (Phone, forward legs, SMS) |
| `TELNYX_CALL_CONTROL_APP_ID` / `TELNYX_CONNECTION_ID` | Phone inbound/outbound + forwarding |
| `TELNYX_TELEPHONY_CREDENTIAL_ID` | WebRTC browser phone |
| `TELNYX_WEBRTC_*` | WebRTC SIP user / connection overrides |
| `MCTB_TEXML_APP_ID` | Legacy MCTB CFNA only |
| `LIVEKIT_*` | AI Receptionist only |
| `TELNYX_LIVEKIT_FQDN_CONNECTION_ID` | Receptionist Telnyx → SIP |
| `VOICE_OUTBOUND_SMS_FROM_E164` / `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | MCTB / platform SMS (not voice DID) |

---

## 5. What “switch product” does today

Entry: `POST` Numbers switch API → `switchNumberToProduct` (`switch-product.ts`).

| `targetProduct` | Carrier action | `routingMode` after success |
|-----------------|----------------|----------------------------|
| `phone` | `routeNumberToPhoneCallControl` | `telnyx_call_control` |
| `receptionist` | LiveKit prepare + `activateVoiceV3TelnyxIngress` | `livekit_sip` |
| `mctb` | `routeNumberToMctbTexml` | `mctb_texml` |

Before change: `parkCurrentIngressIfNeeded` saves snapshot to `telephonyPark`.

`ingressStrategy: "shared_voice"` (receptionist): keeps **workspace** Phone policy fields while still **moving carrier ingress to LiveKit** — so Phone forwarding webhooks stop until ingress is Phone again.

---

## 6. Compatibility matrix (one DID, today)

| Active `routingMode` (carrier) | Browser Phone | Call forwarding | AI Receptionist (PSTN) | MCTB voice | MCTB SMS (owned) |
|-------------------------------|---------------|-----------------|-------------------------|------------|------------------|
| `telnyx_call_control` | Yes | Yes (with policy) | No (needs LiveKit ingress) | Yes (missed-call on Phone path) | Yes (platform sender) |
| `livekit_sip` | No | **No** (gate) | Yes | No (no Phone missed pipeline) | Config may exist; no Phone missed events |
| `mctb_texml` | No | **No** | No | Yes (TeXML pipeline) | Yes (monolith pipeline) |

**Logical config** for multiple products can coexist in DB; **runtime** is limited by the single Telnyx connection.

---

## 7. Direction: “provision once, use all four”

What would need to converge:

1. **Single inbound orchestrator on Call Control**  
   One `telnyx_call_control` connection per business DID. Inbound webhook runs a **state machine**: ring browser → forward PSTN → hand off to LiveKit room for AI → voicemail → on terminal missed → MCTB SMS.

2. **Receptionist as handoff, not alternate ingress**  
   Instead of repointing DID to FQDN, use Call Control `transfer` / SIP bridge / programmatic connect to LiveKit (or Telnyx AI) **from** Phone runtime — assignment in `voiceAgentPhoneNumber` already exists.

3. **Retire exclusive `mctb_texml` for owned DIDs**  
   Keep TeXML path only for **CFNA / ingress TFN** (legacy). Owned Transovo numbers use Phone + MCTB automation (already aligned in new-app spec).

4. **One “provision phone line” action**  
   - Patch DID → Call Control once  
   - Write `telephony: { routingMode: telnyx_call_control, state: active }`  
   - Enable flags: `phoneNumberAnsweringPolicy`, `mctbInbound`, `voiceAgentPhoneNumber`, `missedCallTextConfig`  
   - Never require `switchNumberToProduct` to change `connection_id` for feature toggles

5. **SMS stays orthogonal**  
   Platform MCTB sender + Inbox — no per-DID A2P on voice number for default product.

Until then, **operational rule:** For a **571-style business DID** that should forward + browser + MCTB: keep it on **`phone` / Call Control** in Numbers; do **not** switch the same DID to **MCTB TeXML** or **Receptionist-only** ingress if you need forwarding.

---

## 8. Key source files (quick index)

| Topic | File |
|-------|------|
| Telephony record | `new-app/lib/server/telephony/telephony-record.ts` |
| Phone / MCTB / LiveKit route | `new-app/lib/server/telephony/product-routes.ts` |
| Product switch + park | `new-app/lib/server/telephony/switch-product.ts`, `ingress-park.ts` |
| Bindings UI truth | `new-app/lib/server/telephony/bindings.ts` |
| Forwarding gate | `new-app/lib/server/telephony/forwarding-runtime-gate.ts` |
| Ensure Call Control | `new-app/lib/server/telephony/ensure-phone-call-control.ts` |
| Receptionist LiveKit | `new-app/lib/server/telephony/v3-receptionist-provision.ts` |
| Inbound Phone | `new-app/lib/server/phone/inbound-runtime.ts` |
| Effective answering | `new-app/lib/server/phone/routing/resolve-effective-policy.ts` |
| Forward dial | `new-app/lib/server/phone/routing/forwarding-service.ts` |
| Telnyx webhook | `new-app/app/api/telnyx/phone/route.ts` |
| Legacy MCTB TeXML | `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`, `src/lib/mctb/texml-ingress/*` |
| Wiring audit | `docs/NEW-APP-NUMBERS-WIRING-AUDIT.md` |

---

## 9. Glossary

| Term | Meaning |
|------|---------|
| **Ingress** | Where Telnyx sends the **first** inbound PSTN leg |
| **Logical provision** | DB config (policies, destinations, MCTB, agent link) |
| **Carrier provision** | Telnyx `connection_id` on the number + `settingsJson.telephony` |
| **Platform sender** | Shared SMS FROM for MCTB — not the voice DID |
| **CFNA** | Customer forwards unanswered calls from their carrier to Transovo ingress (legacy MCTB) |

---

*Generated from repository state for planning unified provisioning. Update this doc when ingress architecture changes.*
