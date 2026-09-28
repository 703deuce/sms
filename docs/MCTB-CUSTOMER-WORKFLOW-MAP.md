# MCTB customer workflow map (post implementation pass)

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
| Voicemail greeting | Onboarding → Setup → Voicemail | `/api/phone/voicemail`, Smart Routing audio upload |
| Test & activate | Onboarding review → Setup → Test | `/api/mctb/live-test`, `/api/mctb/setup-test` |
| Overview KPIs | `/mctb` | Overview API |
| Pause / resume | `/mctb` (compact) + Setup → Recovery | `enabled` / `pauseUntil` on setup POST |
| Usage limit | `/mctb` strip | `capabilities.monthlyRecoveriesUsed` / `monthlyRecoveryLimit` |
| Missed calls / detail | `/mctb/missed-calls` | MCTB missed-call APIs |
| Conversations (read-only compose) | `/mctb/conversations` | Inbox APIs; `mctbCompose` + `manualTwoWayMessaging` |
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

| Step | Location | API |
|------|----------|-----|
| Enable / configure | `/mctb/ai-recovery` | `/api/mctb/ai-recovery/settings` |
| Caller conversation | `/mctb/conversations` | AI recovery runtime (unchanged) |
| Disable | AI Recovery settings | Settings POST |

## OWN SENDER

| Step | Location | API |
|------|----------|-----|
| Eligibility | Setup → Phone / Numbers drawer | Capabilities + compliance |
| Registration states | Numbers / compliance surfaces | Provider + `mctb.sender` metadata |
| Activate sender | Setup → Phone | `senderMode` WORKSPACE + `smsPhoneNumberId` |
| Custom recovery text | Setup → Text Back | `messageTemplate` when `customTemplates` |
| Manual two-way | Conversations composer | UI + `/api/sms/send` `mctbCompose` |
| Switch back to Platform | Setup → Phone | `senderMode` PLATFORM |

## VOICEMAIL

| Step | Location | Runtime |
|------|----------|---------|
| Default / TTS / ElevenLabs / record / upload | Setup → Voicemail (`MctbVoicemailGreetingStudio`) | `greetingUrl` / `greetingText` on voicemail box |
| Active greeting | Setup status pill + studio | TeXML / MCTB paused fallback |
| Paused MCTB fallback | Recovery pause | Certified `paused_voicemail` path |
| Caller leaves message | PSTN | Voicemail message rows |
| Inbox | `/mctb/voicemail` | Transcription / summary when available |

## Continuity

- Onboarding and Setup read/write the same APIs (`/api/mctb/setup`, handoff, exclusions, voicemail).
- Setup Guide (`mctbSetupGuide=1`) reopens wizard with current values.
- Platform template selection persists in `workspace.customFieldsConfig.mctb.platformRecoveryTemplateId` and resolves in `resolveMctbRecoveryOpenerTemplate` at send time.

---

## DISCOVERED DURING CODEBASE AUDIT (not from the original checklist)

These gaps were found by comparing legacy MCTB UI, `/api/mctb/*` routes, and config fields against Pure Opus — then fixed in the same pass.

| Discovery | Customer location | Backend / API |
|-----------|-------------------|---------------|
| Press-1 disclosure was preview-only in Opus; publish/generate lived only in legacy `consent-prompt-editor` | Setup → Consent → **Press-1 voice disclosure** panel | `/api/mctb/consent-prompt` (save, generate, publish) |
| `/api/mctb/booking-links` CRUD existed; Opus Links page showed demo data and dead “Add link” | Setup → Links → **MctbSetupLinksEditor** | `/api/mctb/booking-links`, setup `defaultLinkUrl` |
| `requestFormFieldsJson` + `leadCaptureEnabled` had no Opus editor (legacy `setup-links-view` only) | Setup → Links → request form fields | `/api/mctb/setup` POST |
| `/mctb/setup/missed-call-rules` incorrectly rendered full Recovery page (triggers duplicated) | Setup → **Missed-call rules** (dedicated page) | `triggerRules` on `/api/mctb/setup` |
| Recovery page duplicated triggers (spec 09 vs 12 split) | Setup → Recovery = pause + delay/cooldown/max only | schedule + runtime timing fields |
| `recoveryGoal` applied onboarding but not Text Back for own-sender workspaces | Setup → Text Back → recovery goal select | `recoveryGoal` on setup POST + goal config |
| Platform template ID persisted but not wired end-to-end initially | Text Back + send path | `platform-template-persistence.ts` |
| Manual inbox replies on platform sender (MCTB context) | `/mctb/conversations` composer lock + API | `mctbCompose` on `/api/sms/send` |

### APIs inventoried (customer-relevant)

`/api/mctb/setup`, `onboarding`, `consent-prompt`, `booking-links`, `handoff`, `exclusions`, `live-test`, `setup-test`, `missed-calls`, `analytics`, `consent-log`, `ai-recovery/*`, `lead-recovery/config`, `numbers`, `tfv`, `try-it` (Setup Test), `overview-enrichment` — plus shared `/api/phone/voicemail`, `/api/sms/send`, Smart Routing audio upload for greetings.

### Still system-only or out of scope (not exposed)

`debug/log`, `admin-test/bootstrap`, `lead-recovery/simulate` (internal test), pricing/checkout flows, frozen TeXML branch internals, `try-it` as standalone nav (canonical home: Setup → Test).
