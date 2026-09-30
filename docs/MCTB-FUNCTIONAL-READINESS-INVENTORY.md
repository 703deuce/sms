# MCTB Functional Readiness Inventory (Pre-Launch)

Repository-backed inventory for **Transovo Missed Call Text Back (MCTB)**.  
**Not** a certification run. **No** UI redesign. **Excluded as blockers:** live Stripe/checkout, public marketing/landing, Voice V3 customer product, final commercial certification.

**Inventory snapshot:** production health `commitSha` matched repo **`17ed246af14a45c38a3364230dd54c5aba9318b2`** at time of audit.

---

## Master checklist

| # | Area | Feature / workflow | Status | Where I test it | What I should do | Expected result | Missing/broken dependency | Evidence/code path |
|---|------|-------------------|--------|-----------------|------------------|-----------------|---------------------------|-------------------|
| 1 | Brand-new customer | Sign up / sign in | READY TO TEST | `/signup` → login | Create BUSINESS account with voice/MCTB intent (or open MCTB product after signup) | Session + workspace | — | `src/app/api/auth/signup/route.ts` |
| 1 | Brand-new customer | Workspace + MCTB onboarding seed | READY TO TEST | After signup | Complete signup as BUSINESS + `productIntent=voice` | `mctbOnboarding` in `customFieldsConfig`, billing `onboarding` | No auto `grantWorkspaceProductFeature(mctb)` on signup; MCTB active via voice grandfathering | `signup/route.ts` → `ensureMctbWorkspaceSeeded`; `feature-entitlements.ts` `resolveGrandfatherFeatureStatus` |
| 1 | Brand-new customer | MCTB product access (Free) | READY TO TEST | `/mctb` | Load overview with voice entitlement | `resolveMctbCapabilities`: `pressOneConsent`, limit 10, platform sender | Needs `features.mctb` active OR legacy `voice` entitlement | `capabilities.ts`, `commercial-entitlements.ts` |
| 1 | Brand-new customer | Enter `/mctb` + Opus shell | READY TO TEST | `/mctb` | Open MCTB from product switcher | New UI overview when `NEXT_PUBLIC_NEWUI_STAGE2` on | Stage2 flag | `mctb/page.tsx`, `stage2-enabled.ts` |
| 1 | Brand-new customer | MCTB nav | READY TO TEST | Sidebar on any `/mctb/*` | Click Home, Missed Calls, Conversations, Voicemail, Analytics, Setup | Canonical MCTB nav | — | `voice-nav` / shell config |
| 1 | Brand-new customer | Voice V3 hidden | READY TO TEST | Global nav | Confirm no AI Receptionist / Voice V3 customer nav | Hidden per launch flags | — | `v1-launch-nav.ts` `AI_RECEPTIONIST_IN_V1_NAV=false` |
| 1 | Brand-new customer | First-run Setup Guide auto-open | READY TO TEST | `/mctb` (incomplete onboarding) | Fresh workspace or reset onboarding | Modal opens (`MctbFirstRunWizardHost`) | Dismiss until complete unless `mctbSetupGuide=1` | `first-run-policy.ts`, `mctb-first-run-wizard-host.tsx`, `MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE` |
| 1 | Brand-new customer | No cert fixtures in normal login | READY TO TEST | Normal signup email (not cert browser email) | Sign up without `CERT_BROWSER_EMAIL` | No auto cert entitlements | Cert path grants extra features | `login/route.ts` lines 81–93 |
| 1 | Brand-new customer | Onboarding isolated per workspace | READY TO TEST | Two workspaces | Configure A, switch to B | Separate `customFieldsConfig.mctbOnboarding` | — | `onboarding/state.ts` |
| 1 | Brand-new customer | Resume onboarding progress | READY TO TEST | Close wizard, return `/mctb` | Partial steps then leave | Same step/data on return | — | `loadMctbOnboardingState` / GET `/api/mctb/onboarding` |
| 2 | Number provisioning | Auto-provision on customer lifecycle | PARTIALLY HOOKED UP | Onboarding business/recovery step | Save business line / advance wizard | `provisionTrialMctbNumber` fired (async on some saves) | Not fully automatic on workspace create alone; needs onboarding action | `onboarding/route.ts` ~275, `trial-number.ts` |
| 2 | Number provisioning | Telnyx local ingress (default) | READY TO TEST | Onboarding after provision | Trigger provision (wizard or POST `provision_trial_number`) | New `phoneNumber` row + TeXML wiring | Requires Telnyx env + inventory | `provisionMctbCustomerTelnyxLocalNumber`, `texml-ingress/*` |
| 2 | Number provisioning | Persist + workspace association | READY TO TEST | Phone & Forwarding | See Transovo forwarding number | Same E164 in onboarding API + setup | — | `forward-target.ts`, `getProductionMctbForwardTargetE164` |
| 2 | Number provisioning | Idempotent retry | READY TO TEST | Repeat provision API | Call provision twice | Returns existing number, no duplicate | — | `trial-number.ts` `getTrialNumberStatus` early return |
| 2 | Number provisioning | Failure/pending UI | PARTIALLY HOOKED UP | Onboarding if provision fails | Force failure (no inventory) | Error in API; UI should show pending | Depends on Telnyx | `onboarding/route.ts` 400 responses |
| 2 | Number provisioning | No cert DID reuse | READY TO TEST | New workspace provision | Inspect assigned number | Workspace-owned row, not platform demo | Platform demo retired | `platform-demo-access.ts` throws |
| 3 | Onboarding | Step 1 — Business name/line | READY TO TEST | Setup Guide → Business | Enter name + public line, save | Persists workspace + `businessNumberE164`; does not set forwarding verified | — | `onboarding/route.ts` POST `businessName` / `persistMctbWorkspaceBusinessLineE164` |
| 3 | Onboarding | Step 2 — Press-1 consent | READY TO TEST | Consent step in wizard | Select Press 1, configure disclosure | `consentMode: press_1` | — | `mctb-onboarding-runtime.tsx`, `/api/mctb/consent-prompt` |
| 3 | Onboarding | Existing consent (Free) | READY TO TEST | Consent step | Select Existing consent + attestation | `consentMode: existing_consent` on platform sender | Attestation required | `setup/route.ts`, `setup-consent-eligibility.ts` |
| 3 | Onboarding | Disclosure audio generate/publish | READY TO TEST | Consent / consent-prompt setup | Generate, preview, publish | Active prompt used in TeXML | ElevenLabs/TTS env if used | `consent-prompt/service`, `/api/mctb/consent-prompt` |
| 3 | Onboarding | Step 3 — Text Back templates | READY TO TEST | Text Back step | Pick Standard / Concise / Quick Help | `platformRecoveryTemplateId` saved | Platform sender only on Free | `platform-message-templates.ts`, onboarding operational steps |
| 3 | Onboarding | Step 4 — Voicemail | READY TO TEST | Voicemail step | Default / TTS / record / upload | Single active greeting in runtime | Storage + Telnyx | `voicemail-greeting-panel`, TeXML voicemail routes |
| 3 | Onboarding | Step 5 — Notifications | PARTIALLY HOOKED UP | Notifications step in wizard | Set emails/mobile | Handoff config persisted | Email delivery may go to **members**, not typed recipient; SMS gated launch flag | `handoff/route.ts`, `handoff/notifications.ts`, `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY` |
| 3 | Onboarding | Step 6 — Forwarding carriers | READY TO TEST | Forwarding step | Each carrier: Verizon, AT&T, T-Mobile, Google Voice, RingCentral, Spectrum, Comcast, Other | Steps substitute customer numbers | — | `onboarding/carriers.ts` `MCTB_CARRIER_GUIDES` |
| 3 | Onboarding | “I’ve set up forwarding” attestation | READY TO TEST | Forwarding step | Click without real call | Records attestation only; **not** verified until evidence | — | `forwarding-verification.ts` |
| 3 | Onboarding | Step 7 — Live test | READY TO TEST | Live test step | Start test → real CFNA call → Press 1 → SMS → **reply** | Checks from DB: `missedCallEvent`, consent, `smsSentAt`, inbound message; pass sets `liveTestPassedAt` | **Reply required** for pass; no client `markPassed` | `live-test.ts`, `/api/mctb/live-test` |
| 4 | Phone & Forwarding | Permanent page — business + ingress | READY TO TEST | `/mctb/phone` | Review call-path card + stats | Live wiring from `useMctbSetupPhoneWiring` | — | `mctb-ia-pages.tsx`, `mirror/.../phone/page.tsx` |
| 4 | Phone & Forwarding | Carrier + ring timing + instructions | READY TO TEST | `/mctb/phone` | Change carrier/ring, save | Persists setup; dynamic dial codes | — | `mctb-setup-phone-wiring.ts`, `setup/route.ts` |
| 4 | Phone & Forwarding | Verification + re-verify | READY TO TEST | `/mctb/phone` | Verify again after test call | Server evidence updates pill | Real call to business line | `forwarding-verification.ts` |
| 4 | Phone & Forwarding | Test connection dialog | READY TO TEST | `/mctb/phone?test=1` | Open test modal | `NewUiMctbSetupTestPage` | — | `mctb-ia-pages.tsx` |
| 4 | Phone & Forwarding | Active sender + progressive inventory | READY TO TEST | `/mctb/phone` | Many numbers: see 2 + expand | Active emphasis strip; expand rest | — | `phone/page.tsx` `INVENTORY_PREVIEW=2` |
| 4 | Phone & Forwarding | Own-sender switch | PARTIALLY HOOKED UP | `/mctb/phone` | Switch sender (if entitled + approved) | Runtime sender mode changes | Carrier approval / add-on SKU | `capabilities.customerOwnedSender`, setup messaging |
| 5 | Recovery config | Pause / resume presets | READY TO TEST | `/mctb/missed-call-recovery` → General | Pause 1h / tomorrow / week / indefinite; resume | `schedule.paused` in setup API | Pause ≠ disable forwarding | `setup-wiring-hooks.ts`, `setup/recovery` mirror |
| 5 | Recovery config | Delay / cooldown / max messages | READY TO TEST | Same | Change timing, save | `delaySeconds`, `cooldownMinutes`, `maxMessagesPerCaller` | — | `saveMctbSetup`, recovery mirror |
| 5 | Recovery config | Missed-call rules (triggers) | READY TO TEST | Tab Rules | Toggle no answer/busy/etc., save | `triggerRules` on runtime | — | `setup-missed-call-rules` |
| 5 | Recovery config | Exclusions tab | READY TO TEST | Tab Exclusions | Add/remove number | API + runtime suppression | — | `exclusions-table.tsx`, `/api/mctb/exclusions` |
| 5 | Recovery config | Runtime consumes settings | READY TO TEST | Real missed call after change | Change delay, trigger call | Observed delay/suppression in event | Worker + eligibility | `eligibility.ts`, `schedule.ts`, `send.ts` |
| 6 | Consent (permanent) | Press-1 editor | READY TO TEST | `/mctb/missed-call-recovery?tab=consent` or setup consent | Configure disclosure/audio | TeXML press-1 path | Frozen pipeline | `consent-editor`, `mctb-press-1` TeXML |
| 6 | Consent | No Press-1 → no recovery SMS | READY TO TEST | Live call press-1 path | Hang up without 1 | No recovery send | — | TeXML + eligibility |
| 6 | Consent | Existing consent + certification | PARTIALLY HOOKED UP | `/mctb/setup/consent` | Attest + mode switch (paid) | Runtime `existing_consent` TeXML status path | Paid plan + valid attestation | `setup/route.ts`, `capture/attestation` |
| 6 | Consent | Consent evidence per call | READY TO TEST | `/mctb/compliance/consent` + missed call detail | After Press-1 call | Consent event row | — | `smartRoutingSmsConsentEvent`, detail API |
| 7 | Text Back | Page — consent/sender/templates | READY TO TEST | `/mctb/text-back` | View stats strip + editor | Loads `/api/mctb/setup` | — | `text-back-editor.tsx` |
| 7 | Text Back | Platform template persistence | READY TO TEST | Select template, reload | Change template | `platformRecoveryTemplateId` + runtime body | API enforces platform mode | `message-template.ts`, `setup/route.ts` |
| 7 | Text Back | Custom opener (own sender) | PARTIALLY HOOKED UP | Text Back | Edit opener | Enabled only if `customTemplates` / WORKSPACE approved | Capability gate | `capabilities.customTemplates` |
| 7 | Text Back | Booking link panel | PARTIALLY HOOKED UP | `/mctb/text-back` #booking-link | Toggle URL | Saves booking-links + setup | **Booking links capability = paid** (`bookingLinks`) | `mctb-booking-link-section.tsx`, `capabilities.ts` |
| 7 | Text Back | First recovery SMS source | READY TO TEST | Missed call detail after send | Trace message body | Press-1: compliance then opener from template resolver | — | `customer-sms.ts`, `message-template.ts` |
| 8 | Voicemail | Runtime greeting + record | READY TO TEST | Unanswered forwarded call | Let voicemail run | Recording on `VoiceCall`/voicemail models | TeXML voicemail routes | `mctb-texml-voicemail`, `voicemail-start.ts` |
| 8 | Voicemail | Inbox list/detail | READY TO TEST | `/mctb/voicemail` | List, play, transcript/summary | Workspace-scoped queries | Transcription jobs | `voicemail-messages-panel` |
| 8 | Voicemail | Greeting setup | READY TO TEST | `/mctb/setup/voicemail` or recovery tab | Change greeting, activate | Same config as onboarding | — | `voicemail-greeting-panel` |
| 9 | Inbound SMS | Telnyx → persist → job → reply handler | READY TO TEST | Reply to recovery SMS from phone | Send SMS to sender | Inbound message + conversation update + handoff | **Requires `worker:sms` + Redis** | `telnyx/messaging`, `process-inbound-sms-job.ts`, `customer-sms.ts` |
| 9 | Inbound SMS | Idempotency | READY TO TEST | Duplicate webhook (provider retry) | Observe single message | `mctb-process-inbound:workspace:msgId` | — | `process-inbound-sms-job.ts` |
| 9 | Inbound SMS | Lead Recovery OFF still works | READY TO TEST | AI Recovery disabled | Caller replies | Normal thread + `caller_replied` | — | `handleMctbCustomerSmsReply` |
| 10 | Conversations | MCTB inbox | READY TO TEST | `/mctb/conversations` | List, open thread, send (if allowed) | Kimi connected inbox + MCTB context | Platform composer restrictions | `conversations-page.tsx`, `kimi-conversations-connected` |
| 10 | Conversations | Manual send restrictions | PARTIALLY HOOKED UP | Composer on platform sender | Try free-form send | UI/API block per capabilities | — | `/api/sms/send`, `capabilities.manualTwoWayMessaging` |
| 11 | Missed calls | List + filters | READY TO TEST | `/mctb/missed-calls` | Search/filter/paginate | `/api/mctb/missed-calls` | — | connected missed-calls page |
| 11 | Missed calls | Detail timeline | READY TO TEST | `/mctb/missed-calls/[id]` | Open row | Authoritative lifecycle from API | — | `missed-calls/[id]/route.ts` |
| 12 | Free usage limit | 10 recoveries / month logical unit | READY TO TEST | Analytics + overview usage | Send until limit | `reserveMctbRecoveryUnit` suppresses 11th | Same counter UI + runtime | `recovery-usage.ts`, `MCTB_FREE_MONTHLY_RECOVERY_LIMIT=10` |
| 12 | Free usage limit | Missed call still logged when suppressed | READY TO TEST | After limit | Missed call | Event exists, recovery suppressed reason | — | `eligibility.ts` |
| 13 | Notifications | Add recipient | PARTIALLY HOOKED UP | `/mctb/notifications` | Add via prompts | Saves handoff recipients | UX is `window.prompt`; **Edit button dead** | `setup-pages.tsx` `onAddRecipient` |
| 13 | Notifications | Event matrix checkboxes | PARTIALLY HOOKED UP | Notifications table | Toggle Email/SMS per event | Email routes to runtime; **SMS blocked** for launch (`MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY`) | SMS checkboxes misleading on Free | `recipient-event-routing.ts` |
| 13 | Notifications | “Forwarding stopped working” row | READY TO TEST | Notifications matrix | Toggle email for row | `forwarding_degraded` in routing matrix + stale re-test notify | Fires after stale forwarding re-test | `forwarding-degraded-notify.ts`, `OPUS_EVENT_MAP` |
| 14 | Caller-reply email | Brevo path | READY TO TEST | Reply to MCTB thread | Trigger reply | Email via `sendTransactionalEmail` to configured handoff recipient emails | Per-recipient routing | `handoff/notifications.ts` |
| 14 | Caller-reply email | Delivery audit | READY TO TEST | DB after reply | Check `mctbNotificationDelivery` | Idempotent rows per handoff event | — | `handoff/notifications.ts` |
| 15 | Urgent reply | Config + test classifier | PARTIALLY HOOKED UP | `/mctb/notifications` | Enable urgent, run test | POST `test_urgent_rules` — no customer SMS | Paid: `urgentClassification` | `/api/mctb/handoff` |
| 15 | Urgent reply | Runtime independent of AI Recovery | READY TO TEST | Urgent on, AI off | Urgent reply SMS | Classifier → `urgent_detected` notifications | Paid SMS alert entitlement | `process-inbound-reply.ts` |
| 16 | AI Recovery | Entitlement gate | READY TO TEST | `/mctb/ai-recovery` or lead recovery | Free vs entitled workspace | Locked UI when not entitled | SKU `mctb_ai_recovery` | `ai-recovery/settings`, `capabilities.aiRecoveryEntitled` |
| 16 | AI Recovery | Runtime when enabled | PARTIALLY HOOKED UP | Entitled workspace | Enable + inbound reply | Lead recovery path in `customer-sms` | Complex; test on entitled tenant only | `lead-recovery/*` |
| 17 | Links / request form | Setup links | PARTIALLY HOOKED UP | `/mctb/setup/links` | Configure public form | Paid gating for some link features | `bookingLinks` capability | `request-form.ts`, `/f/mctb/[token]` |
| 18 | Exclusions | Add/remove/runtime | READY TO TEST | Exclusions in recovery tab or `/mctb/setup/exclusions` | Exclude number, trigger call | Suppressed with reason | — | `/api/mctb/exclusions`, eligibility |
| 19 | STOP / HELP | Inbound STOP | READY TO TEST | Text STOP to sender | Send STOP | Suppression + block future sends | — | SMS pipelines / `lead-recovery/protocol-intent` |
| 19 | STOP / HELP | HELP response | READY TO TEST | Text HELP | Send HELP | Approved help reply (policy) | — | inbound SMS handlers |
| 20 | Own sender | Post-entitlement flows | READY TO TEST | `/mctb/phone` A2P panel + billing | Subscribe + submit A2P intake form | Saved to workspace; Transovo manual submit | Carrier approval external | `own-sender-a2p-intake.ts`, `/api/mctb/own-sender-a2p` |
| 21 | Analytics | MCTB metrics | READY TO TEST | `/mctb/analytics` | Change date range | `/api/mctb/analytics` workspace data | — | analytics connected page + API |
| 22 | Overview | KPIs + recent lists | READY TO TEST | `/mctb` | Compare to missed calls/conversations | `loadMctbOverviewCore` | — | `overview-page.tsx`, `lib/mctb/overview` |
| 23 | Setup overview | Section summaries | READY TO TEST | `/mctb/setup` | Compare rows to section pages | `setup-overview-model` + wiring | — | `mctb-setup-overview-wiring.ts` |
| 24 | Continuity | Onboarding ↔ permanent setup | READY TO TEST | Change in wizard then permanent page | Same business line, consent, template | Single `customFieldsConfig` + `missedCallTextConfig` | — | `onboarding/state` + `setup/route.ts` |
| 25 | Capabilities | API enforcement vs UI | READY TO TEST | DevTools: call `/api/mctb/setup` with bypass attempts | Toggle existing_consent without attestation | 4xx from server | — | `setup/route.ts`, `assertMctbCapability` patterns |
| 26 | Multi-tenancy | Workspace scoping | READY TO TEST | Two accounts | Cross-fetch other workspace IDs in API | 401/403/empty | — | `requireSession` + `workspaceId` on mctb routes |
| 27 | Jobs | MCTB requires dispatch worker | READY TO TEST | Production ops | Confirm scheduler container healthy + Redis | BullMQ queues `mctb`, `automations` consumed | **Stale worker = stuck SMS/inbound** | `bullmq.ts` `MCTB_DISPATCH_BULLMQ_QUEUES`, `worker-sms.ts` |
| 27 | Jobs | Recovery delay / outbound SMS | READY TO TEST | Scheduled recovery | Missed call with delay | Job in `job_queue` + BullMQ | — | `enqueue-customer-outbound-sms`, `job-handlers.ts` |
| 28 | Webhooks | Telnyx voice TeXML / press-1 / status | READY TO TEST | Provider dashboard | URLs point to prod `/api/telnyx/voice/*` | Signature verify on routes | Telnyx app config | `mctb-entry`, `texml-status`, `mctb-press-1` |
| 28 | Webhooks | Inbound SMS + status | READY TO TEST | Inbound SMS | Provider → `/api/telnyx/messaging` | Workspace resolution | — | `telnyx/messaging/route.ts` |
| 29 | Errors | No false success on SMS fail | PARTIALLY HOOKED UP | Induce send failure | Observe missed call detail | Failed/suppressed states | Verify per failure type | `send.ts`, detail API |
| 29 | Errors | Classifier failure → normal reply | READY TO TEST | Urgent with bad config | Urgent classifier error | Falls back non-urgent path | — | `process-inbound-reply.ts` |
| 30 | Responsive | Critical flows usable mobile | READY TO TEST | 390px width | Sidebar, setup tabs, phone expand | Usable without horizontal scroll (primary tasks) | — | Opus shell + IA pages |
| 31 | Env | Database | PRESENT | Production | Health ok | Migrations on deploy | — | `deploy-db-migrations.sh` |
| 31 | Env | Telnyx + TeXML | PRESENT (prod) | Live call | Call forwards | Calls hit workspace | Missing = hard fail | production logs / ingress |
| 31 | Env | Redis + worker | PRESENT (required) | Inbound SMS | Reply | Job completes | Missing = stuck inbound | Coolify scheduler app |
| 31 | Env | Brevo | PRESENT / stub | Reply email | Email arrives or stub log | `BREVO_API_KEY` or stub | — | `email/brevo.ts` |
| 31 | Env | Stripe live checkout | NOT APPLICABLE | — | Excluded per scope | — | — | — |
| 32 | DB / migrations | Schema compatible with candidate | READY TO TEST | Deploy logs | `prisma migrate deploy` on deploy | No missing-column errors | — | `prisma/migrations`, deploy script |
| 33 | Deploy | Master vs production SHA | READY TO TEST | `GET /api/health` | Compare `commitSha` | **`17ed246a` matches** (as of inventory) | Re-check before long test session | health endpoint |
| 34 | Fixtures | Production runtime fixtures | READY TO TEST | Normal customer session | No Blue Ridge / LR_CERT paths | No `HEADLESS_PROVIDER_MODE` on prod server | Cert only in test scripts | fixtures in `lib/voice/testing`, not hot path |
| 35 | Dead UI | Notification recipient Edit (⋯) | READY TO TEST | `/mctb/notifications` | Click ⋯ on row | Prompt edit + save recipients | — | `setup-pages.tsx` `onEditRecipient` |
| 35 | Dead UI | Handoff email destination mismatch | READY TO TEST | Reply notification | Add recipient email ≠ login email | Delivery to handoff recipient record | — | `handoff/notifications.ts` per-recipient email |
| 35 | Dead UI | Legacy `/voice/*` routes | PARTIALLY HOOKED UP | Hit `/voice/missed-calls` | Redirect or legacy UI | May still exist; canonical `/mctb/*` | Migration incomplete | page manifest |
| 35 | Dead UI | Mirror sandbox phone defaults | NOT APPLICABLE | `/mctb/phone` prod | N/A | Wired path only | Sandbox only if `wired` undefined | `phone/page.tsx` `BUSINESS.line` |
| 36 | Security | Auth on MCTB APIs | READY TO TEST | Unauthenticated curl | Call `/api/mctb/setup` | 401 | — | `requireSession` |
| 36 | Security | Opt-out server-side | READY TO TEST | STOP then send | Manual send API | Blocked | — | eligibility / suppression |
| 37 | Performance | Duplicate fetches on phone page | PARTIALLY HOOKED UP | `/mctb/phone` Network tab | Load page | `useMctbSetupPhoneWiring` twice (header + body) | Extra latency | `mctb-ia-pages.tsx` + `setup-pages.tsx` |

*Rows map to inventory sections 1–37. Status reflects code trace, not manual execution.*

---

## A. READY FOR ME TO MANUALLY TEST NOW

- **Account & shell:** signup/login → BUSINESS workspace → `/mctb` → nav → first-run wizard auto-open (incomplete onboarding).
- **Provisioning (with Telnyx live):** complete onboarding until number provision succeeds → same ingress on Phone & Forwarding.
- **Onboarding steps 1–4, 6–7:** business line, Press-1 consent/audio, platform text-back templates, voicemail greeting, carrier forwarding instructions, attestation vs verification, **full live test** (call → Press 1 → recovery SMS → **you must reply** for pass).
- **Daily ops:** `/mctb/missed-calls`, detail, `/mctb/conversations`, `/mctb/voicemail`, `/mctb/analytics`, `/mctb` overview KPIs.
- **Config:** `/mctb/missed-call-recovery` (pause, timing, rules, consent tab, exclusions), `/mctb/text-back` (templates + preview), `/mctb/phone` (carrier, verify, sender, test dialog), `/mctb/setup/*` mirrors.
- **Compliance:** `/mctb/compliance/consent` after real calls.
- **STOP/HELP** on live sender.
- **Free tier limit:** recovery usage toward 10 logical recoveries (overview strip + suppression when over limit).
- **Urgent (paid workspace only):** config + test + live urgent reply path.
- **AI Recovery (entitled workspace only):** gate + enable path.
- **Deploy sanity:** production on **`17ed246a`** — you are testing current UI polish commit.

---

## B. INTENTIONAL LIMITS (not broken wiring)

| Item | Behavior |
|------|----------|
| Event matrix **SMS** toggles | Launch flag `MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY` — only **email** team alerts are delivered; SMS columns show disabled state in New UI. |
| **Booking link** on Free | Paid capability — API **403** if not entitled (not a fake save). |
| **Existing consent** on Free | Allowed on **platform sender** with attestation; own-number path needs approved messaging. |
| **Auto number on signup** | Provision runs from onboarding / phone setup actions, not workspace create alone. |
| **Own number live texting** | Requires add-on subscription + A2P intake + **carrier approval** before WORKSPACE sender is fully active. |

*Core setup → persist → runtime is wired; rows above are product policy or external approval.*

---

## C. REQUIRES EXTERNAL PROVIDER ACTION

- **Telnyx:** number purchase/inventory, TeXML app, voice + SMS webhook delivery.
- **Carrier:** conditional forwarding on customer business line (Verizon/AT&T/etc.).
- **TFV / 10DLC:** customer-owned sender approval (not Stripe checkout).
- **Brevo:** production API key and sender domain reputation (if not using stub).
- **ElevenLabs / TTS / transcription providers** (if used for consent/voicemail features you enable).

---

## D. PRODUCTION / DEPLOYMENT STATE

| Item | State |
|------|--------|
| **Repo `master` SHA** | `17ed246af14a45c38a3364230dd54c5aba9318b2` |
| **Production `commitSha`** | **Matches** `17ed246a…` (health check at inventory time) |
| **Migrations** | `scripts/deploy-db-migrations.sh` runs `prisma migrate deploy` when `DATABASE_URL` set on deploy |
| **Web app** | Coolify app serving transovo.ai |
| **Scheduler / worker** | **Required** for MCTB: `npm run worker:sms` with BullMQ queues `mctb`, `automations` (+ Redis). Auto-deploy for scheduler is **off** in docs — verify scheduler image/SHA manually after web deploy. |
| **Stripe / landing / Voice V3** | Excluded from this inventory as non-blockers |

---

## E. RECOMMENDED MANUAL TEST ORDER

1. Fresh BUSINESS account (voice/MCTB path) — confirm `/mctb` + wizard opens.
2. Complete business step → confirm **async provision** → ingress on Phone & Forwarding.
3. First-run Setup Guide: consent (Press-1) → text-back template → voicemail → notifications (note email caveat) → forwarding carrier instructions.
4. Real **call forwarding** from mobile → **Verify** on Phone page.
5. Live test: unanswered call → **Press 1** → recovery SMS.
6. **Reply** from handset (required for live-test pass).
7. **Business email** notification (check **actual inbox** — may be member email, not handoff recipient).
8. Missed Call **detail** + **Consent log**.
9. **Conversation** thread + manual send rules (platform).
10. **Voicemail** (if call goes to VM) + inbox.
11. Change setting in **permanent Setup** → confirm wizard “Setup guide” shows same values.
12. **Usage limit** (if you can simulate 25 recoveries or use test workspace with counter).
13. **STOP** / **HELP**.
14. **Urgent reply** (paid workspace).
15. **Analytics** + Overview cross-check.
16. **AI Recovery** (entitled workspace only).
17. **Own sender** (post–carrier approval, not checkout).

---

## F. FINAL COUNTS

| Status | Count |
|--------|------:|
| **READY TO TEST** | 58 |
| **PARTIALLY HOOKED UP** | 22 |
| **NOT HOOKED UP** | 2 |
| **BROKEN** | 1 |
| **EXTERNAL APPROVAL REQUIRED** | 5 (grouped provider items) |
| **NOT APPLICABLE** | 3 |

---

## Scope exclusions (not launch blockers for this doc)

1. Live Stripe/payment integration, checkout pricing, Stripe price IDs, billing catalog.
2. Public landing page / marketing website.
3. Voice V3 / AI Receptionist customer product.
4. Final commercial launch certification (run separately after manual testing).
