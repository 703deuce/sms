# MCTB — Final product-direction audit (simplified launch)

**Purpose:** Trace the areas you specified against current `master` before a scoped implementation prompt. This complements:

- `docs/MCTB-SETUP-SCREEN-INVENTORY.md` (UI inventory)
- `docs/MCTB-SETUP-CONNECTIVITY-AUDIT.md` (setup screen wiring)

**Product intent (summary):** Fast recovery SMS, one clear next action, inbound **ownership selector** (AI Receptionist vs MCTB), pause = stop texts not kill ingress, controlled templates for platform senders, email-only team notifications for launch, internal caps/stop conditions, no conversational booking in launch AI replies.

**Date:** 2026-09-22 · **Baseline:** `master`

---

## 1. Inbound ownership (AI Receptionist ↔ MCTB)

### What exists today

| Piece | Location | Behavior |
|-------|----------|----------|
| Canonical mode enum | `src/lib/mctb/inbound-handling/types.ts` | `MCTB_RECOVERY` \| `VOICE_AGENT` |
| Persisted per line | `phoneNumber.settingsJson.mctbInbound` | `inboundHandlingMode`, `voiceAgentId`, `voiceAgentEnabled`, `mctbTexmlAppId`, `voiceTexmlAppId`, `configRevision` |
| Policy router | `resolveInboundHandlingDecision()` in `router.ts` | If `VOICE_AGENT` + `voiceAgentEnabled` + agent readiness → `primaryHandler: voice_agent`; else fallback to `mctb_recovery` |
| Telnyx mutation | `setInboundHandlingMode()` in `switch-mode.ts` | **MCTB:** `routePhoneToTexmlApp` → frozen MCTB TeXML app. **Voice:** `routePhoneToTexmlAssistant` → Telnyx AI assistant TeXML URL |
| API | `GET/PATCH /api/mctb/inbound-handling` | Load line + decision; PATCH switches mode |
| UI | `CallHandlingModeSwitch` on **MCTB Voice Agent** page only (`mctb-voice-agent-page.tsx`) | Not on Setup overview or onboarding |

### Configuration preservation

- Switching **does not** delete `MissedCallTextConfig`, consent mode, voice agent draft/published config, or MCTB onboarding state.
- Switching to MCTB sets `voiceAgentEnabled: false` but **retains** `voiceAgentId` and `mctbTexmlAppId` / `voiceTexmlAppId` on the line block.
- Switching to Voice Agent updates `voiceAgent.phoneNumberId` and stores assistant TeXML app id; MCTB TeXML app id is preserved on the line for re-switch.
- Appointment Receptionist wizard can auto-call `setInboundHandlingMode(VOICE_AGENT)` on live publish when `isMctbV1Primary()` (`appointment-receptionist/route.ts`) — can flip ingress without customer using the explicit switch UI.

### DID / route ownership

- **MCTB selected:** Ingress E164 → **MCTB TeXML application** (`mctb_texml_final_v1` pipeline). Not LiveKit FQDN for certified path.
- **Voice Agent selected:** Ingress E164 → **Telnyx AI Assistant** via TeXML direct URL (`routePhoneToTexmlAssistant`). This is the legacy/Telnyx-assistant path, **not** automatically the Voice V3 Call Control → GPT-Live path.
- **Voice V3 note:** `getInboundRoutingMode()` in `texml-direct-route.ts` returns `call_control` for `capabilityPack === "appointment_receptionist"` (Voice V3). `setInboundHandlingMode(VOICE_AGENT)` still calls `routePhoneToTexmlAssistant` only — **no branch** to `startAppointmentReceptionistVoiceV3OnCall`. Risk: published Voice V3 agents may be mis-routed at the number connection layer until ingress aligns with V3 PSTN contract.

### MCTB recovery paused vs telephone endpoint

- Pause / `enabled: false` is **`isMctbSchedulePaused`** → `isMctbAutomationActive` false (`schedule-shared.ts`).
- Cached routing profile exposes `automationActive` (`config-cache.ts` / `routing-profile.ts`).
- Instant inbound TeXML (`inbound-texml.ts`): when not cert-forced press-1, **existing consent** OR **`!automationActive`** → branch `existing_consent` or **`paused_voicemail`** → `buildInstantVoicemailTexml` (Play greeting + Record). **Calls still answer; SMS eligibility returns `MCTB_DISABLED`** (`eligibility.ts`).
- Press-1 cert modes (B/C) always gather first — pause semantics apply on non-cert paths and post-gather flows per frozen pipeline docs.

### Gaps vs product intent

| Gap | Severity |
|-----|----------|
| No single **Setup / onboarding** “who answers forwarded calls?” control; switch buried on Voice Agent page | High (discoverability) |
| Voice V3 GPT-Live ingress not wired into `setInboundHandlingMode` | High (wrong runtime if V3 is “AI Receptionist”) |
| Auto switch to VOICE_AGENT on receptionist publish may surprise MCTB-only customers | Medium |
| Separate legacy **`/numbers/[id]/call-handling`** (`call-handling-mode.ts`) can coexist with `mctbInbound` — two mental models | Medium |

**Scripts:** `scripts/test-mctb-inbound-handling-mode.ts` (parse only, no Telnyx).

---

## 2. Voicemail (onboarding + runtime)

### Reusable machinery (already connected)

| Capability | UI | Backend |
|------------|-----|---------|
| Transovo default / platform ElevenLabs asset | Setup + inbox links | `voicemail-greeting-defaults.ts`, `resolveStableVoicemailGreetingPlayUrl` |
| Write script → ElevenLabs TTS | `PersonalGreetingControls` (`create` tab + `GreetingVoicePicker`) | Phone voicemail APIs used by `mctb-voicemail-greeting-studio.tsx` |
| Record microphone | Same component | Upload/save URL |
| Upload audio | Same component | Upload/save URL |
| Explicit activate | `activationMode: "explicit"` on studio | Preview before active greeting swap |

**Setup route:** `/mctb/setup/voicemail` → full studio. **Onboarding:** `/onboarding/mctb` voicemail step is **checklist only** (`mark_voicemail_configured`) — does not embed `PersonalGreetingControls`.

### MCTB call-ending paths → voicemail

- **Existing consent / paused automation:** Instant TeXML → voicemail Play + Record (`instant-voicemail-texml.ts`).
- **Press-1:** Gather tree + status callbacks (frozen pipeline); gather failure / no-DTMF paths documented in `MCTB_FINAL_PRODUCTION_PIPELINE.md` (not re-audited PSTN here).
- Greeting audio resolved from active greeting token per ingress E164 — same engine for MCTB TeXML and public play URL.

### Gaps vs product intent

| Gap | Severity |
|-----|----------|
| Onboarding should offer default \| AI voice \| record \| upload **inline** | High (UX) |
| Onboarding “Use default” does not distinguish “platform default already active” vs “step completed” | Low |

---

## 3. Recovery sequences (initial, follow-up, caps, stops)

### Initial recovery SMS

- Body/delay/triggers: `missedCallTextConfig` + `POST /api/mctb/setup`.
- Send gate: `evaluateMissedCallTextEligibility()` (triggers, consent, suppression, cooldown/**`maxMessagesPerCaller`**, pause, send window).
- Default `maxMessagesPerCaller: 1` (`types.ts`); enforced in eligibility via recent `smsSentAt` count vs cooldown window.

### Follow-up automation (Solution graph)

- `buildMissedCallTextBackDefinition()` (`graph.ts`): initial wait → send SMS → wait for reply → condition → optional follow-up SMS with **`stopOnReply: true`** on nodes.
- Persisted via `saveMissedCallTextBack()` → linked `AutomationFlow`; `stopExecutionsOnReply()` (`automations/stop-on-reply.ts`) completes executions with `stopOnReplyActive` on inbound SMS (generic automation metadata path).

### UI vs runtime

| Control | Setup UI | Persisted | Runtime |
|---------|----------|-----------|---------|
| Cooldown / repeat caller | Recovery editor | Yes | Eligibility |
| Pause recovery | Overview + Recovery | Yes (`enabled` / `pauseUntil`) | Eligibility + `automationActive` for TeXML |
| **Max attempts** | Recovery — **read-only display** | Defaults in DB; **no POST field** in `/api/mctb/setup` | Enforced |
| **Follow-up on/off** | Recovery — **read-only display** | `SolutionSetup` config (`followUpEnabled`, etc.) | Graph if enabled in solution config |
| Recovery goal templates (reply / callback / form / book) | **Not present** | — | — |

### Stop conditions (reply, opt-out, booking/resolution)

| Condition | Mechanism | MCTB launch relevance |
|-----------|-----------|------------------------|
| **Opt-out / STOP** | Suppression + contact status in eligibility; LR `OPT_OUT` intent; `handleMctbCustomerSmsReply` carrier STOP | **Works** |
| **Reply stops automation graph** | `stopOnReply` on send_sms blocks + `stopExecutionsOnReply` | **Works** when solution follow-up graph is active |
| **Reply stops LR follow-up** | `globalBehavior.followUpEnabled` (off by default); workflow invalidation / `END_AUTOMATION` actions | Partial — LR off by default |
| **Human takeover** | `mctbConversationAutomationState` `human_active` / `resolved` skips automation in `customer-sms.ts` | Works when staff takes over |
| **Booking / resolution** | LR `appointment_booked` state; handoff follow-up status API | Partial — tied to LR/handoff, not simple template flows |

### Platform sender vs customer A2P

- No dedicated “platform sender = locked template” flag in setup UI.
- Platform/demo phones classified via `isPlatformDemoPhoneRecord` (`outbound-sms-route.ts`) for routing/compliance — **not** a template editor lock.
- Full message editing remains in Text Back for all senders today.

---

## 4. Request form

### Schema & persistence

- Fields: `MctbRequestFormField[]` — `id`, `label`, `type: text|email|phone|textarea`, `required?`, `placeholder?` (`request-form-shared.ts`).
- Stored: `missedCallTextConfig.requestFormFieldsJson`; default when empty = name + phone + message.
- Token: `requestFormToken`; public path `/f/mctb/:token`.
- Enable: `requestFormEnabled`; SMS link via `resolveMctbLinkDestinationUrl` / `{{link}}`.

### Validation & public behavior

- Load: `loadMctbRequestFormByToken` — requires `requestFormEnabled: true`.
- Submit: `createMctbRequestFormSubmission` — required field validation; optional contact upsert when `leadCaptureEnabled`.
- Public page: `src/app/f/mctb/[token]/page.tsx` + `/api/public/mctb-request-form`.

### Presets vs form builder

- Setup **Links** editor: toggle form, lead capture, default URL — **field list saved** but UI is not a full builder (inventory audit: partial).
- **No** preset enum (callback vs intake vs booking) — would be a thin mapping layer: preset → `requestFormFieldsJson` + opener template + optional `defaultLinkUrl`.

---

## 5. AI handoff / replies (`AI_TEXT_CONVERSATION` and what actually runs)

### Setup UI (Notifications & handoff)

- `responseMode` includes `ai_conversation`, `guided_collection`, `immediate_handoff`, `notify_only` (`handoff/types.ts`).
- Defaults: `ai_conversation` (`handoff/defaults.ts`).
- Saved via `/api/mctb/handoff` (setup notifications view).

### SMS runtime path (authoritative)

```
Inbound SMS → handleMctbCustomerSmsReply (customer-sms.ts)
  → requires leadRecoveryConfig.enabled && policyHealth !== DISABLED
  → handleMctbLeadRecoveryInboundSms (conversation-runtime.ts)
  → intent agent + policy engine + action-runtime (AI_BOOK, SEND_BOOKING_LINK, …)
```

- **`processMctbInboundReply()` is not called from any inbound path** (only defined). Legacy handoff modes are **not** driving SMS replies.
- **Lead Recovery default:** `enabled` is false unless `customFieldsConfig.mctb.leadRecovery.enabled === true` **or** legacy auto-migrate when `aiBooking.enabled` (`config.ts`). Typical new MCTB workspace: **no AI SMS replies at all** (`lead_recovery_not_enabled`).

### Knowledge & tools (when LR is on)

- **Intent:** Semantic LLM (`intent-agent.ts`) with thread context (`semantic-conversation-context.ts`) — not a simple FAQ blob; structured intents and policies.
- **Actions:** Registry includes `SEND_BOOKING_LINK`, **`AI_BOOK`**, callback, text-to-pay, escalate, etc. (`action-runtime.ts`).
- **Booking mode:** Derived from `mctb.aiBooking` — if `aiBooking.enabled` → policies default to **`AI_BOOK`**; else with fallback link → **`SEND_BOOKING_LINK`** (`config.ts` + `policy-defaults.ts`).
- **Guards:** `john-policy-guard.ts` blocks disallowed actions when LR enabled; John LLM loop is deprecated for MCTB SMS.

### Conversational booking vs booking link (launch intent)

| Path | State |
|------|--------|
| `SEND_BOOKING_LINK` | Implemented in LR; cert scripts exist |
| `AI_BOOK` + session store | **Fully implemented** behind `aiBooking.enabled` / LR policies — **not dormant** |
| MCTB AI Booking config API | `/api/mctb/ai-booking/*` preserved |
| Setup “booking” blocks on Recovery | Separate from simple “recovery goal” product |

**Launch alignment:** Need explicit **policy default** `SEND_BOOKING_LINK` only + `aiBooking.enabled` false + hide `AI_BOOK` in UI — code preserved, runtime gated.

---

## 6. Notifications (recipients, events, email-only launch)

### Models

- **Workspace matrix:** `MctbHandoffConfig.routingMatrix` — per `MctbHandoffEventType`, channels `{ email, sms, in_app }` + optional `recipientIds`.
- **Recipients:** `MctbNotificationRecipient` with `eventChannelsJson` (per-event channel prefs).

### Delivery runtime (`deliverMctbHandoffNotifications`)

- Uses **workspace `routingMatrix` only** for channel toggles.
- Sends email via `notifyWorkspaceByEmail` to recipients with email when `channels.email`.
- SMS to `mobileE164` when `channels.sms`.
- In-app workspace broadcast when `channels.in_app`.
- **`recipient.eventChannels` is persisted but not consulted** in delivery (setup overview checks it for display health only).

### Gaps vs launch (email-only, per-recipient events)

| Gap | Work |
|-----|------|
| Per-recipient event matrix not wired to delivery | FINISH: intersect `routingMatrix` with `recipient.eventChannels[event]` |
| SMS/in-app exposed as equal choices in Setup | HIDE for launch (keep models) |
| Test notification API | Exists; needs provider for real send — LIVE-CERTIFY |

---

## 7. Testing (Try It vs setup test vs live test)

| Surface | Entry | Consent / config mutation | Purpose |
|---------|-------|---------------------------|---------|
| **Try It / demo** | `/api/mctb/try-it`, onboarding `start_demo` | **`applyTryItConsentMode` writes `workspace.customFieldsConfig.mctb.consentMode`**; **skips `syncMctbConsentRouting` when `context === "try_it"`** (`try-it/start-session.ts`) | Marketing/demo call+SMS |
| **Onboarding demo** | Same with `context: "onboarding"` | Syncs consent routing | Wizard demo |
| **Live test** | `/api/mctb/live-test` | Uses real workspace consent/runtime | Post-setup verification |
| **Setup test** | `/api/mctb/setup-test` | Checklist against DB/events | Diagnostics |

**Demo consent bug (confirmed):** Try It can change production consent mode in workspace JSON without TeXML sync — inbound press-1 vs existing-consent can **diverge** from UI until next real consent save. **Recommended fix:** session-scoped demo consent (Try It session row only), never `workspace.customFieldsConfig.mctb.consentMode` for `try_it`.

**Eligibility:** `demoMode` on eligibility skips schedule pause checks — demos can send when production pause would block (intentional for demo path; document for cert).

---

## 8. Additional UI → runtime gaps (vs screen inventory)

| Area | Inventory / connectivity finding | This audit |
|------|----------------------------------|------------|
| Inbound ownership selector | Not in setup inventory | Exists backend + Voice Agent UI only; V3 ingress gap |
| Recovery goals / templates | Text Back single opener | No goal enum; solution graph is separate |
| AI replies | Notifications mode `ai_conversation` looks connected | SMS uses LR only; LR off by default |
| Handoff guided collection | Partial in connectivity audit | Superseded by LR for SMS; handoff processor unused on SMS |
| Max attempts / follow-up rows | Partial (display-only) | Confirmed — cap enforced, UI should HIDE not edit |
| Request form builder | Partial | Schema ready; presets FINISH |
| Voicemail onboarding | Partial | Studio exists; onboarding FINISH |
| Booking in Recovery setup | Partial | AI booking + LR — PRESERVE/HIDE for launch |

---

## 9. Disposition list (implementation planning)

Legend: **KEEP** = ship as-is or minor copy; **FINISH** = real engineering to match launch spec; **HIDE** = keep code, remove/gray UI; **PRESERVE** = dormant but intact; **LIVE-CERTIFY** = needs PSTN/SMS/provider proof.

### KEEP + already connected

- MCTB TeXML ingress + press-1 / existing-consent split (frozen pipeline).
- Forwarding verification + phone/onboarding save paths.
- Consent editor + `syncMctbConsentRouting` (non-demo).
- Text Back opener + delay + template renderer preview.
- Recovery pause (`enabled` / `pauseUntil`) + **pause → voicemail, not dead endpoint**.
- Cooldown + internal **`maxMessagesPerCaller`** enforcement (default 1).
- Exclusions → eligibility `BLOCKED_NUMBER`.
- Voicemail setup studio (default / ElevenLabs / record / upload).
- Request form public URL, validation, submissions, `{{link}}` resolution.
- Inbound handling **persistence model** + API (`setInboundHandlingMode` preserves both sides’ ids).
- Opt-out / STOP on SMS reply path.
- Automation graph **`stopOnReply`** + `stopExecutionsOnReply` for managed MCTB flow.
- Email notification sending path (`notifyWorkspaceByEmail` + templates).

### FINISH

1. **Inbound ownership selector** in Setup (and copy in onboarding): MCTB vs AI Receptionist; link to Voice V3 readiness; no destructive overwrite.
2. **Voice V3 PSTN ingress** when `VOICE_AGENT` + appointment receptionist agent — route via Call Control / `startAppointmentReceptionistVoiceV3OnCall`, not only TeXML assistant URL.
3. **Onboarding voicemail** embed `PersonalGreetingControls` (or deep link with return) — four choices.
4. **Recovery goal templates** (4 goals) mapping to opener + optional form preset + booking link — platform sender locked variants.
5. **Try It session-scoped consent** — stop mutating workspace `consentMode` without TeXML sync.
6. **Notifications:** wire `recipient.eventChannels`; launch UI = email only; workspace matrix defaults email on.
7. **AI replies for launch:** enable a **minimal** LR profile (FAQ-style) with **`SEND_BOOKING_LINK` only**, explicit `leadRecovery.enabled` from setup — replace false impression that `responseMode` alone enables AI.
8. **Request form field presets** (callback / intake / book) instead of builder UX.
9. Reconcile **`/numbers/.../call-handling`** with `mctbInbound` (single customer-facing control).

### HIDE for launch

- Notifications matrix **SMS** and **in-app** columns (keep persistence).
- Recovery UI **Maximum attempts** and **Follow-up** read-only rows (or move to internal admin).
- MCTB Recovery **booking / AI booking** advanced blocks unless customer on own A2P “advanced” tier.
- Legacy handoff **response mode** picker if LR becomes the single customer-facing “AI replies” switch (or rename and bind to LR).
- Massive LR scenario toggles / cert-only admin surfaces.

### PRESERVE dormant

- Full **AI_BOOK** pipeline + `mctb.aiBooking` config + cert suites (`scripts/mctb-lead-recovery-*`).
- `processMctbInboundReply` + guided collection / notify_only paths (inbox or future modes).
- Solution graph **follow-up** message editing for future A2P customers.
- `maxMessagesPerCaller` / follow-up **API fields** for future automation SKU.
- John LLM / runtime-gateway (deprecated entrypoints).
- SMS team notification channel code paths.

### LIVE-CERTIFY

- Inbound switch **MCTB ↔ Voice** on same ingress E164 (forwarding unchanged) — both directions.
- **Pause recovery:** call still hits voicemail; **no** recovery SMS.
- Press-1 + existing-consent E2E (existing `npm run verify:mctb-final-pipeline`).
- Try It / live test / setup test on staging with real SMS.
- Voice V3 receptionist answering when selected (after FINISH #2).
- Email notifications to multiple recipients with different event subsets (after FINISH #6).
- Platform-sender template restrictions under real TFV trial number.

---

## 10. Suggested implementation sequence (for your scoped prompt)

1. Inbound ownership UI + Voice V3 ingress correctness (protect configs).
2. Demo consent isolation (Try It).
3. Launch notifications (email-only + per-recipient events).
4. Recovery goals + form presets + platform template locks.
5. Onboarding voicemail studio embed.
6. LR launch profile (link-only booking, no conversational book).
7. Hide launch-inappropriate setup rows.

This order avoids duplicating voicemail, form, or notification systems already in the repo.

---

## Appendix — Key file index

| Topic | Files |
|-------|--------|
| Inbound switch | `src/lib/mctb/inbound-handling/switch-mode.ts`, `router.ts`, `src/app/api/mctb/inbound-handling/route.ts` |
| Pause → VM | `src/lib/mctb/texml-ingress/inbound-texml.ts`, `src/lib/mctb/schedule-shared.ts` |
| SMS eligibility | `src/lib/agents/missed-call-text-back/eligibility.ts` |
| LR replies | `src/lib/agents/missed-call-text-back/customer-sms.ts`, `src/lib/mctb/lead-recovery/conversation-runtime.ts` |
| Handoff (legacy) | `src/lib/mctb/handoff/process-inbound-reply.ts` (unused on SMS) |
| Notifications | `src/lib/mctb/handoff/notifications.ts`, `src/lib/mctb/handoff/config.ts` |
| Try It consent | `src/lib/mctb/try-it/start-session.ts` |
| Request form | `src/lib/mctb/request-form.ts`, `src/lib/mctb/request-form-shared.ts` |
| Voicemail UI | `src/components/personal/personal-greeting-controls.tsx`, `src/components/mctb/voicemail/mctb-voicemail-greeting-studio.tsx` |
| Follow-up graph | `src/lib/solutions/missed-call-text-back/graph.ts`, `src/lib/automations/stop-on-reply.ts` |
