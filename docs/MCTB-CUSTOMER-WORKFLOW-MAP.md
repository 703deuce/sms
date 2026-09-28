# MCTB customer workflow map (code-completeness pass)

Customer-facing Pure Opus surfaces under `/mctb/*` wired to existing MCTB APIs/runtime. Capabilities from `resolveMctbCapabilities()` — not hard-coded plan names.

## FREE

| Step | Customer location | Backend |
|------|-------------------|---------|
| Signup / workspace | Transovo shell | Auth, workspace |
| First MCTB entry | Modal onboarding (`mctb-first-run-wizard-host`) | `/api/mctb/onboarding`, `first-run-policy` |
| Phone & forwarding | Onboarding → Setup → Phone | `/api/mctb/setup`, forwarding guides, live test |
| Consent (Press 1) | Onboarding → Setup → Consent | `customFieldsConfig.mctb.consentMode` |
| Existing consent (locked) | Consent step / editor | `capabilities.recoveryPaid` |
| Platform templates | Onboarding recovery → Setup → Text Back | `platformRecoveryTemplateId` in workspace config |
| Recovery delay / cooldown / pause | Onboarding → Setup → Recovery | `/api/mctb/setup` schedule + runtime |
| Notifications | Onboarding → Setup → Notifications | `/api/mctb/handoff` |
| Voicemail greeting | Onboarding → Setup → Voicemail | `/api/phone/voicemail`, Smart Routing audio |
| Test & activate | Onboarding review → Setup → Test | See **Setup Test authority** below |
| Overview KPIs | `/mctb` | Overview API |
| Pause / resume | `/mctb` (compact) + Setup → Recovery | `enabled` / `pauseUntil` on setup POST |
| Usage limit | `/mctb` strip | `capabilities.monthlyRecoveriesUsed` / `monthlyRecoveryLimit` |
| Missed calls / detail | `/mctb/missed-calls` | MCTB missed-call APIs |
| Conversations (compose gated) | `/mctb/conversations` + shared `/conversations` | Inbox PATCH + `mctbCompose` on `/api/sms/send` when platform sender |
| Voicemail inbox | `/mctb/voicemail` | `/api/phone/voicemail` |
| Consent log | `/mctb/compliance/consent` | Compliance APIs |
| Analytics | `/mctb/analytics` | MCTB analytics API |

## RECOVERY (capability unlock)

| Step | Location | Notes |
|------|----------|-------|
| Unlock | Same workspace — controls enable via capabilities | `recoveryPaid` |
| Existing consent | Setup → Consent attestation | Attestation persisted; mode `existing_consent` |
| Booking / request link | Setup → Links | `defaultLinkUrl`, request form |
| Urgent rules | Setup → Notifications | `/api/mctb/handoff` test_urgent_rules |
| Higher usage limit | Overview usage strip | `resolveMctbMonthlyRecoveryLimit` |

## AI RECOVERY

| Field / control | UI | Save API | Runtime consumer |
|-----------------|-----|----------|------------------|
| Enable / disable | `/mctb/ai-recovery` master switch | `POST /api/mctb/ai-recovery/settings` | `lead-recovery/config` + handoff `responseMode` |
| Collect NAME, REASON, ADDRESS, URGENCY, CALLBACK_TIME | Information to collect toggles | same settings POST | `collectCapabilities` via `buildAiRecoverySavePatch` |
| Booking link + label/URL | Booking link panel | settings POST + optional `POST /api/mctb/booking-links` | `bookingLinkId` on lead recovery config |
| Scenario toggles (take message, booking, emergencies, …) | Conversation scenarios panel | `POST /api/mctb/lead-recovery/config` `enabledScenarios` | Intent routing in lead recovery runtime |
| Business context (read-only) | Business information panel | — (edit via Settings / Knowledge links) | Approved business brain / FAQ runtime |

**V1 launch scope:** Intent-level policy matrices, Text-to-Pay scenario, and AI_BOOK provider UI remain internal (`MCTB_LAUNCH_HIDE_*` flags). Customer-facing launch surface is simplified Opus page above — not the legacy full `AiLeadRecoveryPage` matrix.

### AI Recovery field matrix (launch vs API-only)

| Field | Opus UI | Save path | Runtime | Notes |
|-------|---------|-----------|---------|-------|
| `enabled` | Master switch | `ai-recovery/settings` | `lead-recovery/config`, handoff | |
| `collectCapabilities` (5 simplified fields) | Information toggles | `ai-recovery/settings` | SMS reply collection | Via `buildAiRecoverySavePatch` |
| `bookingLinkId` | Booking link panel | settings + `booking-links` | Booking link sends | |
| `enabledScenarios` | Scenario toggles | `lead-recovery/config` POST | Intent routing | Payments hidden at launch |
| `globalMode`, `intentPolicies`, `globalBehavior`, `paymentPolicy`, `serviceAreaPolicy`, `existingCustomerPolicy`, `faqPolicy`, `handoffTriggers`, `actionCapabilities` | **No** (launch defaults) | `lead-recovery/config` if posted | Policy engine | Set by `applyLaunchAiRepliesSetting` / legacy matrix UI |
| `version`, provider diagnostics | **No** | internal | concurrency | |

Business brain / hours / services: read-only on Opus; edited outside MCTB (Settings / Knowledge).

## OWN SENDER (product workflow — not pricing)

| Stage | Customer control | API / runtime |
|-------|------------------|---------------|
| Locked | Setup → Phone shows hint; workspace numbers not selectable | `capabilities.ownSenderAddOnEntitled` |
| Entitled | Lifecycle steps + **Messaging registration** → `/compliance` | Compliance registration + TFV |
| Choose path | Setup → Phone **Manage messaging numbers** / **Add toll-free or local** (`MctbNumberDrawerOpus`; `/mctb/numbers` redirects here with `?open=manage`) | `/api/mctb/numbers`, search/provision |
| Pending / rejected | Compliance surfaces + number row status labels | `messagingStatus` on setup phone options |
| Approved | Appears in Setup → Phone sender radio list (`selectable: true`) | `phoneNumbers` on `/api/mctb/setup` |
| Activate | Select own number (WORKSPACE) | `senderMode` + `smsPhoneNumberId` on setup POST |
| Runtime | Sends from workspace sender; custom opener + manual two-way unlock | `resolveMctbCapabilities`, eligibility engine |
| Revert to Platform | Select Transovo Platform | `senderMode: PLATFORM` — policy reverts immediately |

## VOICEMAIL (studio + runtime — traced)

**Authoritative active greeting:** `voicemailBox.greetingUrl` on the MCTB ingress number’s box. On `update_box` with a new URL, `provisionActiveVoicemailGreeting` copies audio to the stable token URL (`greetingTokenForE164` → `active.mp3` / Supabase). TeXML existing-consent path plays `resolveStableVoicemailGreetingPlayUrl(greetingToken)` — see `routing-profile.ts`.

| Workflow | UI | Persist | Activate | Runtime |
|----------|-----|---------|----------|---------|
| ElevenLabs / TTS | PersonalGreetingControls → Generate | `/api/smart-routing/audio/generate` → `processedUrl` | explicit: **Use this greeting** → `update_box` `greetingUrl` | `provisionActiveVoicemailGreeting` |
| Record | MediaRecorder → blob | `/api/smart-routing/audio/upload` | same | same |
| Upload | file picker | same upload API | same | same |
| Default fallback | (no custom URL) | — | — | platform default bytes in `provisionActiveVoicemailGreeting` |

**Verified (automated):** `npx tsx scripts/test-voicemail-active-greeting.ts` — stable play URL + atomic `active.mp3` provision.

**UI authority:** Opus `greetingActive` pill reflects `greetingUrl` only (not script-only `greetingText`).

**Paused MCTB / existing consent:** TeXML plays stable greeting URL from `routing-profile.ts` + `instant-voicemail-texml.ts` — same `greetingTokenForE164` chain.

**Not voicemail:** Press-1 consent disclosure audio (`/api/mctb/consent-prompt`) — separate asset and TeXML press-1 play URL.

## PRESS-1 VOICE DISCLOSURE (compliance-sensitive)

| Layer | Customer editable? | Where |
|-------|-------------------|--------|
| Approved wording | **No** — canonical script from business display name only | `resolveCanonicalMctbConsentScript` / Settings → Business |
| Voice + speed | **Yes** | Consent panel `GreetingVoicePicker` |
| Generate / publish audio | **Yes** | `/api/mctb/consent-prompt` generate + publish |
| SMS compliance confirmation (Press-1 mode) | **No** (platform template / locked copy) | Text Back editor when `senderMode === PLATFORM` |

Frozen TeXML press-1 branch (`mctb_texml_final_v1`) is unchanged; disclosure audio is the published consent prompt asset.

## SETUP TEST AUTHORITY

| Endpoint | Classification | Customer UX |
|----------|----------------|-------------|
| `POST/GET /api/mctb/live-test` | **Canonical** forward test session | Setup → Test **Start test** — detect real call to business line |
| `POST/GET /api/mctb/setup-test` | **Supporting** pipeline checkpoints | Armed together with live-test; checkpoints in Setup checklist (consent loaded, greeting, SMS queued, …) |
| `POST/GET /api/mctb/try-it` | **Legacy / onboarding-only** | Not in launch nav (`MCTB_LAUNCH_TRY_IT_ENABLED`); onboarding/demo synthetic path |

One coherent Setup → Test page:

- **Start test** → `POST setup-test` then `POST live-test` (same as legacy `setup-test-view`).
- **Setup readiness** checklist (business line, live test passed, sender, opener).
- **Recovery pipeline checkpoints** from `GET setup-test` (`buildSetupTestPipelineSteps`) while session armed — polls every 3s until verified.
- **Live forward test** panel with consent-mode-aware step 3 (Press-1 vs existing consent).

## Continuity

- Onboarding and Setup read/write the same APIs (`/api/mctb/setup`, handoff, exclusions, voicemail).
- Setup Guide (`mctbSetupGuide=1`) reopens wizard with current values.
- Platform template selection persists in `workspace.customFieldsConfig.mctb.platformRecoveryTemplateId` and resolves in `resolveMctbRecoveryOpenerTemplate` at send time.

---

## DISCOVERED DURING CODEBASE AUDIT (not from the original checklist)

| Discovery | Customer location | Backend / API |
|-----------|-------------------|---------------|
| Press-1 disclosure was preview-only in Opus; publish/generate lived only in legacy editor | Setup → Consent → Press-1 panel | `/api/mctb/consent-prompt` |
| Unrestricted Press-1 script textarea violated approved wording | Consent panel read-only script + server canonical script | `consent-prompt/script-policy.ts` |
| `/api/mctb/booking-links` CRUD existed; Opus Links showed demo data | Setup → Links → **MctbSetupLinksEditor** | booking-links + setup POST |
| `requestFormFieldsJson` + `leadCaptureEnabled` had no Opus editor | Setup → Links | setup POST |
| Missed-call rules page rendered full Recovery (duplicate triggers) | **Missed-call rules** | `saveTriggerRulesOnly` |
| `maxMessagesPerCaller` not persisted from setup POST | Setup → Recovery | `max_messages_per_caller` |
| Platform sender manual reply via shared inbox PATCH | `/conversations` + Kimi shell | inbox PATCH gate + client banner |
| AI Recovery scenarios API-only in Opus | `/mctb/ai-recovery` scenario toggles | `lead-recovery/config` POST |
| Own Sender lifecycle underspecified in UI | Setup → Phone lifecycle + Compliance link | capabilities + compliance |
| Own Sender drawer missing on Opus Setup → Phone | Manage / Add number buttons + `MctbNumberDrawerOpus` | `/api/mctb/numbers` |
| Setup → Test hid setup-test pipeline checkpoints | Pipeline panel + 3s poll | `setup-test-presentation.ts` |
| Legacy consent editor allowed free-text script | Read-only disclosure (legacy + Opus) | `script-policy.ts` + consent-prompt POST |
| Voicemail “Active” pill implied script-only saves | `greetingActive` = `greetingUrl` only | `useMctbVoicemailWiring` |

## Code-completeness gate (before browser/PSTN cert)

- [x] Voicemail: one authority (`greetingUrl` → `provisionActiveVoicemailGreeting`); shared Smart Routing upload/generate; explicit activate.
- [x] Press-1: canonical script server-side; voice/publish only; TeXML frozen.
- [x] Own Sender: lifecycle copy + drawer + sender selector + Platform revert.
- [x] AI Recovery: launch customer fields on Opus; advanced policy fields documented API-only.
- [x] Setup Test: live-test + setup-test wired; try-it gated off launch nav.
- [x] Reverse audit pass: discovered holes implemented (table above), not deferred.

### APIs inventoried (customer-relevant)

`/api/mctb/setup`, `onboarding`, `consent-prompt`, `booking-links`, `handoff`, `exclusions`, `live-test`, `setup-test`, `missed-calls`, `analytics`, `consent-log`, `ai-recovery/*`, `lead-recovery/config`, `numbers`, `tfv`, `try-it` (onboarding only), `overview-enrichment` — plus `/api/phone/voicemail`, `/api/sms/send`, Smart Routing audio upload/generate.

### System-only (not customer controls)

`debug/log`, `admin-test/bootstrap`, `lead-recovery/simulate`, `lead-recovery/config?providerDiagnostics=1`, pricing/checkout, frozen TeXML internals, full legacy lead-recovery policy matrix UI (hidden at launch).
