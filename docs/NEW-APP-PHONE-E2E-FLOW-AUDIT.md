# New-App Phone — front-to-back flow audit

**Purpose:** Map what a customer configures in UI to runtime behavior on Telnyx Call Control.  
**Live PSTN:** Not certified in this document — see “Verify on live call” per row.

## Prerequisites (all voice features)

| Requirement | UI signal | Backend |
|-------------|-----------|---------|
| Telnyx API + Call Control app | Phone readiness | `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID` or `TELNYX_CALL_CONTROL_APP_ID` |
| WebRTC browser phone | “Calling not ready” toast | `TELNYX_TELEPHONY_CREDENTIAL_ID`, `/api/phone/webrtc-token` |
| Webhook | — | Telnyx app → `POST /api/telnyx/phone` |
| Workspace number on CC | Numbers detail | `phoneNumber` row + `phone_foundation` ingress when using integrated provision |

---

## 1. Outbound call (browser phone)

| Step | Front end | API / runtime |
|------|-----------|----------------|
| User dials | `WorkspaceProvider.startCall` | `POST /api/phone/calls` `action=outbound_register` → `createWebRtcOutboundCall` |
| WebRTC leg | `TelnyxRTC.newCall` + `clientState` `{ humanCallId }` | Telnyx WebRTC credential |
| Link control id | `linkCallControl` | `action=link_control` → `linkHumanCallControlId` |
| Lifecycle | SDK notifications | `processHumanCallWebhookEvent` on Telnyx events |

**Connected:** Yes, when WebRTC token + credential + user media permissions work.  
**Verify on live call:** Place outbound from `/app/phone` (or dialer); confirm `humanCall` row and recording if enabled.

---

## 2. Inbound → browser phone

| Step | Front end | API / runtime |
|------|-----------|----------------|
| PSTN to DID | — | `call.initiated` → `handleInboundCall` → `processInboundCallInitiated` |
| Policy | Numbers → Incoming calls = **Browser phone** | `resolveEffectiveAnswering` → `browser` + `decideInboundRoute` |
| Bridge | Incoming toast | `PHONE_INBOUND_BRIDGE_WEBRTC` (default on) → `bridgeInboundCallToWebRtc` dials WebRTC SIP user |
| Answer | `answerIncoming` | WebRTC answer + `inbound_answer` API |
| Ring timeout | — | `processDueInboundRingTimeouts` on webhook ticks |

**Connected:** Yes, when bridge env + WebRTC registered + same Call Control connection as the DID.  
**Gap:** Legacy workspace **routing** (`/api/phone/routing`) still affects `decideInboundRoute` for external/voicemail timeout — keep Numbers answering policy and routing in sync.

---

## 3. Inbound → call forwarding (one number → another)

| Step | Front end | API / runtime |
|------|-----------|----------------|
| Configure | Numbers → **Forward to phone** OR Phone → Call forwarding | `PUT /api/phone/forwarding` or answering policy → `upsertAnsweringPolicy` |
| Destination | Forwarding destinations CRUD | `forwarding_destinations` |
| Runtime | — | `effective.kind === forward` → `startForwardingFlow` → `dialDestination` (PSTN leg, optional press-1 screening) |
| No answer | No-answer fallback panel | `scheduleJson.noAnswerFallback` → `executeFallback` (voicemail, IVR, forward group, etc.) |

**Connected:** Yes for single E.164 forward and ring groups on Call Control.  
**Verify on live call:** Call business line; external phone rings; press-1 screening if enabled on destination.

---

## 4. Auto attendant (keypad IVR)

| Step | Front end | API / runtime |
|------|-----------|----------------|
| Build menu | `/app/phone/auto-attendant` | Menus CRUD + publish |
| Greeting | TTS / upload / record / **ElevenLabs** | `menu-executor` → `gatherUsingSpeak` or `gatherUsingAudio` |
| Assign to number | Incoming calls → Auto attendant | `answeringMode=auto_attendant`, `autoAttendantMenuId` |
| DTMF | — | `routing-webhook` `call.gather.ended` → `handleIvrGatherEnded` |

**Connected:** Yes after publish.  
**Fix (2026-03):** Uploaded/EL greetings now stored as **absolute** URLs for Telnyx (`toPublicAssetUrl`).

---

## 5. Conversational IVR (AI first)

| Step | Front end | API / runtime |
|------|-----------|----------------|
| Mode | Incoming calls → Conversational IVR | `answeringMode=conversational_ivr` |
| Agent link | AI Receptionist → number assignment | `voiceAgentPhoneNumber` |
| Runtime | — | `startConversationalIvrOnCallControlSession` → LiveKit handoff (`phone_call_control` bootstrap) |
| Transfer to ring group | AI tool transfer | `authorize-transfer` → `phone_call_control` → Python worker → `execute_phone_foundation_transfer` |

**Connected:** Code path complete; **requires live** Voice V3 worker + LiveKit + agent publish.  
**Gap:** Staff-first-then-AI is primarily workspace routing / fallback JSON — confirm product copy in UI matches saved policy.

---

## 6. Voicemail

| Step | Front end | API / runtime |
|------|-----------|----------------|
| Boxes | `/app/phone/voicemail` (basic CRUD) | `voicemail_boxes` |
| Greeting on call | Routing greeting text/URL | `leaveVoicemailOnCall` playback or TTS |
| MCTB press-1 | — | Before voicemail fallback, optional `cf_mctb_consent` gather |

**Partial:** Voicemail UI does not yet mirror auto-attendant ElevenLabs builder (greeting edit is routing/box fields). Runtime playback works with absolute `greetingUrl`.

---

## 7. Missed Call Text Back (owned number)

| Step | Front end | API / runtime |
|------|-----------|----------------|
| Per-line toggle | Numbers → MCTB panel | `PATCH /api/phone/mctb` |
| Miss detection | — | Terminal inbound miss → `schedulePhoneOwnedMctbIfMissed` (skips active AI/forward orchestration) |
| Consent | existing_consent / press_1 | Eligibility + `press1-consent` on CC fallback |
| Send | — | Platform sender, templates, cooldown, `Conversation` threading |

**Connected:** Backend integration on `phone_foundation` branch; **live SMS** not run in agent pass.

---

## 8. ElevenLabs greetings

| Surface | API | Env |
|---------|-----|-----|
| Auto attendant | `POST .../greeting-elevenlabs`, `GET /api/phone/elevenlabs/voices` | `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_APP_URL` or `APP_URL` for absolute audio URL |

**Sales / billing voices:** Curated in `lib/voice/elevenlabs-voice-catalog.ts` (Jessica → sales, Rachel → billing). Customers can still upload or record in the same greeting panel.

---

## Known gaps (honest)

1. **Full platform** — This audit covers **new-app Phone** stack, not legacy `/voice/*`, main-app Campaigns, or full MCTB `/mctb` rebuild pages.
2. **Voicemail builder** — No ElevenLabs tab on voicemail workspace yet (auto attendant has it).
3. **BullMQ** — Delayed MCTB uses DB `SCHEDULED` + webhook poller, not a dedicated queue worker.
4. **Inbound SMS → conversation** — Outbound recovery threads; inbound reply routing should be verified on live reply.
5. **Every feature in one pass** — Use this doc as the checklist; live PSTN remains the acceptance gate.

---

## Quick regression scripts (no PSTN)

```bash
npx tsx new-app/scripts/test-phone-mctb-integration.mjs
npx tsx new-app/scripts/test-single-provision-phone-architecture.mjs
PHONE_TEST_BASE_URL=https://<your-host> node new-app/scripts/test-phone-production-cert.mjs
```
