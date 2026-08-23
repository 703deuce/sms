# Transovo Phase 1 — Full Inventory & Gap Matrix

**Date:** 2026-08-23  
**Branch audited:** `master` (post Smart Routing nav restore)  
**Rule:** Read-only inventory. No functionality removed or modified during Phase 1.

---

## Executive summary

| Finding | Detail |
|---------|--------|
| **MCTB** | Mature multi-path implementation. Both `press_1` and `existing_consent` are first-class. Canonical runtime: `processMissedInboundCall` + SIP ingress for production voice. |
| **Smart Routing** | Full UI + compiler + Telnyx/Twilio runtimes. Hermetic tests pass. Not yet a purchasable entitlement. |
| **Voicemail** | Canonical stack exists (`VoicemailBox` / `VoicemailMessage`, Personal UI, marketplace `$4.99/mo`). Not packaged as `visual_voicemail` product. |
| **Callback** | Queue overflow callback in softphone (`callback_requested` on `HumanCall`). No standalone Callback Requests product. |
| **Billing** | Three layers: `ProductEntitlement` (voice/numbers/sms), `mctb/entitlement.ts`, marketplace per-number subs. No fine-grained product SKUs for MCTB/SR standalone. |
| **Risk** | Parallel legacy stacks (SolutionSetup, TeXML 571 paths, `/voice/conversations` vs `/inbox`, generic voice analytics). Extension required—not rewrite. |

---

## Part A — Route & component classification

### A1. MCTB (Missed Call Text Back)

| Route / surface | Page / component | API | Class | Notes |
|-----------------|------------------|-----|-------|-------|
| `/dashboard` | `mctb/dashboard-view.tsx` | `/api/mctb/setup`, `/api/mctb/missed-calls` | **Canonical** | MCTB home |
| `/onboarding/mctb` | `mctb/onboarding-wizard.tsx` | `/api/mctb/onboarding`, demo, live-test, tfv | **Canonical** | First-run |
| `/voice/setup` | `mctb/setup-view.tsx` | `/api/mctb/setup`, consent-prompt, setup-test | **Canonical** | Primary config |
| `/voice/missed-calls` | `mctb/missed-calls-view.tsx` | `/api/mctb/missed-calls` | **Canonical** | Event log |
| `/voice/missed-calls/[id]` | `mctb/missed-call-detail-view.tsx` | `/api/mctb/missed-calls/[id]` | **Canonical** | Timeline |
| `/voice/try-it` | `mctb/try-it-view.tsx` | `/api/mctb/try-it`, demo | **Canonical** | Conditional nav |
| `/voice/conversations` | inline page | `/api/voice/conversations` | **Duplicate** | Nav item; data is `voiceCall` not SMS |
| `/voice/numbers` | inline server page | SSR phone loaders | **Canonical** | MCTB numbers |
| `/voice/analytics` | inline page | `/api/voice/analytics` | **Shared** | Voice AI metrics; not MCTB KPIs |
| `/compliance` | compliance shell | registration APIs | **Shared** | One compliance stack |
| `/integrations` | integrations directory | connections/webhooks | **Shared** | |
| `/settings/business` | business settings | workspace APIs | **Canonical** | MCTB nav “Settings” |
| `/inbox` | `InboxView` | `/api/inbox` | **Canonical** | Real SMS threads |
| `/solutions/missed-call-text-back/setup` | redirect | — | **Legacy** | → `/voice/setup` |
| `/agents/john` | redirect | — | **Legacy** | → `/voice/missed-calls` |
| `/api/solutions/missed-call-text-back` | — | save/load SolutionSetup | **Legacy** | Ops script still uses |
| `/api/agents/john` | — | John admin | **Legacy** | Page redirects |
| `missed-call-text-back-wizard.tsx` | orphan component | — | **Legacy** | Not imported |
| `agents/missed-call-text-back/agent-detail.tsx` | orphan UI | — | **Legacy** | Stale links |

**MCTB runtime libs (Canonical):**

- `src/lib/agents/missed-call-text-back/` — classify, eligibility, process, schedule, send, customer-sms, intelligence
- `src/lib/mctb/` — config, ingress, consent-prompt, event-only, onboarding, provisioning, sip-ingress, try-it, tfv

**Dual-write persistence (Shared, not separate product path):**

- `MissedCallTextConfig` — **canonical runtime config**
- `saveMissedCallTextBack()` → `SolutionSetup` + `AutomationFlow` — called from `/api/mctb/setup` (Shared automation link)
- `syncConfigFromSolutionSetup()` in `config.ts` — **Legacy** (never called)

### A2. MCTB voice ingress paths

| Path | Route / entry | Mode | Provider / use | Class |
|------|---------------|------|----------------|-------|
| **SIP → LiveKit → Python** | Telnyx FQDN → `mctb_sip_production.py` → `/api/internal/voice-runtime` | both | Customer DID + demo 571 | **Canonical** |
| `mctb-consent` TeXML | `/api/telnyx/voice/mctb-consent` | `press_1` | Platform 571 on TeXML app | **Legacy** |
| `mctb-event-only` | `/api/telnyx/voice/mctb-event-only` | `existing_consent` | Platform 571 EVENT_ONLY CC | **Legacy** |
| `mctb-call-control` | `/api/telnyx/voice/mctb-call-control` | — | 571 diagnostic speak | **Legacy** |
| Voice bridge | `mctb-voice-bridge` + Twilio `mctb-ingress` | — | Telnyx→Twilio experiment | **Legacy** |
| Main Telnyx webhook 571 fast-path | `/api/telnyx/voice` | `press_1` | SR gather before DB | **Legacy** when CC+SR |
| Post-call trigger | `voice-missed-trigger.ts`, texml-status | both | Hangup on `VoiceCall` | **Shared** (not first-hop) |
| `processMissedInboundCall` | `process.ts` | both | All SMS entry | **Canonical** |

**Per-provider canonical:**

| Provider | Canonical ingress |
|----------|-------------------|
| Telnyx production customer DID | SIP ingress (`provisionMctbTelnyxSipIngress` from setup POST) |
| Telnyx Try It / demo 571 | Same SIP (`ensurePlatformDemoSipIngress`) |
| Telnyx 571 if still TeXML | Legacy `mctb-consent` |
| Twilio MCTB voice | Legacy bridge only; SMS uses TFN separately |

### A3. Smart Routing

| Route | Component | API | Class |
|-------|-----------|-----|-------|
| `/smart-routing` | `overview-view.tsx` | `/api/smart-routing/flows` | **Canonical** |
| `/smart-routing/new` | `new-flow-view.tsx` | POST flows, templates | **Canonical** |
| `/smart-routing/audio` | `audio-view.tsx` | audio APIs | **Canonical** |
| `/smart-routing/[flowId]` | `builder-view.tsx` | flows CRUD, publish, forwarding | **Canonical** |
| `/smart-routing/[flowId]/test` | `test-view.tsx` | validate, simulate, test-call | **Canonical** |
| `/smart-routing/[flowId]/activity` | `activity-view.tsx` | activity, sessions | **Canonical** |
| `smart-routing-subnav.tsx` | in-page tabs | — | **Canonical** (Flows/Audio/Builder/Test/Activity) |
| `nav-children.ts` | sidebar children | — | **Canonical** |

**Runtime (Canonical):**

- Telnyx: `flow-runtime.ts`, `webhook-handler.ts` (via `voice/telnyx/webhook-handlers.ts`)
- Twilio: `twilio-flow-runtime.ts`, `/api/webhooks/twilio/voice/smart-routing`
- Compiler/validator: `flow-compiler.ts`, `flow-validator.ts`, `templates.ts`

**Node types (existing):** `ENTRY`, `PLAY_PROMPT`, `GATHER_DTMF`, `MENU`, `TRANSFER_EXTERNAL`, `RING_GROUP` (sequential + simultaneous), `CALL_WHISPER`, `BUSINESS_HOURS`, `VOICEMAIL`, `AI_RECEPTIONIST`, `SMS_CONSENT`, `SEND_SMS`, `PLAY_CONFIRMATION`, `HANGUP`, `SUBFLOW`

**No `CALLBACK` node type** — gap for callback-request add-on in SR tree.

### A4. Voicemail

| Surface | Path | Class |
|---------|------|-------|
| Personal visual inbox | `/personal/voicemail` + `personal-voicemail-ui.tsx` | **Canonical** (product UX) |
| API | `/api/phone/voicemail`, recording route | **Canonical** |
| Runtime | `phone/voicemail-service.ts` | **Canonical** (Telnyx) |
| Twilio pipeline | `twilio-voicemail-pipeline.ts` + transcription webhook | **Shared** |
| Whisper fallback | `voicemail-transcribe.ts` | **Shared** |
| Marketplace product | `voicemail` in `marketplace-billing-catalog.ts` ($4.99/mo) | **Canonical** (billing) |
| Business softphone VM tab | `/phone/settings` | **Legacy** |
| SR `VOICEMAIL` node | `flow-runtime.ts`, `twilio-flow-runtime.ts` | **Shared** |
| Prisma | `VoicemailBox`, `VoicemailMessage` | **Canonical** |

**Duplicate:** Email notify HTML in both `twilio-voicemail-pipeline.ts` and `voicemail-service.ts`.

### A5. Callback (existing, not “Callback Requests” product)

| Surface | Path | Class |
|---------|------|-------|
| Queue overflow | `phone/queue-runtime.ts` | **Canonical** (softphone) |
| Job | `phone_queue_callback` in `job-handlers.ts` | **Canonical** (records only; no auto-dial) |
| UI | `softphone-panel.tsx`, `/phone/calls` | **Canonical** |
| AI builder disposition | `voice-agent-builder.tsx` voicemail action `callback` | **Legacy** |
| Outbound qualification | `CALLBACK_REQUESTED` in outbound qualify | **Legacy** |

**Gap:** No `CallbackRequest` model, no SR menu callback node, no purchasable `callback_requests` entitlement.

### A6. Billing & entitlements

| Layer | Path | Scope | Class |
|-------|------|-------|-------|
| `ProductEntitlement` | `products/entitlements.ts`, Prisma `ProductKey: SMS\|NUMBERS\|VOICE` | Workspace platform access | **Canonical** (coarse) |
| MCTB service | `mctb/entitlement.ts` | Trial limits, service status | **Canonical** (MCTB only) |
| SMS credits | `billing/entitlements.ts` | Outbound credit gate | **Shared** (different concept) |
| Marketplace catalog | `marketplace-billing-catalog.ts` | vault, voicemail, forwarding_200 | **Canonical** (per-number) |
| Stripe webhooks | `stripe-webhook-handler.ts`, billing + service subs | SaaS + marketplace | **Canonical** |
| Personal checkout | `/api/personal/billing/checkout` | Per-number services | **Canonical** |
| Settings billing | `/api/settings/billing`, `settings/billing.ts` | Workspace SaaS | **Canonical** |

**Gap:** No Stripe SKUs for standalone `mctb`, `smart_routing`, `visual_voicemail`, `callback_requests`, or bundle.

### A7. AI Receptionist (out of launch nav — preserve)

| Route | Class | Notes |
|-------|-------|-------|
| `/voice/agents/**` | **Legacy** (launch) / **Canonical** (generic agent product) | Per AGENTS.md; not in MCTB nav |
| `/voice/overview`, `/voice/calls`, `/voice/knowledge`, etc. | **Shared** / **Legacy** | Full `appNav` remnants |
| `/voice/receptionist` | **Legacy** | Redirects to `/voice/setup` (MCTB) |

### A8. Shared telephony

| Area | Canonical paths |
|------|-----------------|
| Telnyx voice hub | `src/lib/voice/telnyx/webhook-handlers.ts` |
| Number routing owner | `numbers/inbound-number-routing.ts` (`routingOwner: smart_routing`) |
| `hasActiveSmartRoutingOnNumber` | `smart-routing/flow-service.ts` |
| Human call ledger | `HumanCall` model, `human-call-bridge.ts` |
| Provider abstraction | Telnyx + Twilio personal voice handlers |

---

## Part B — SR ↔ MCTB integration (existing)

```
Inbound on DID
  → hasActiveSmartRoutingOnNumber?
      YES + press_1 managed flow: SR IVR → SMS_CONSENT → triggerMissedCallTextFromConsent → processMissedInboundCall
      YES + other SR types: SR owns call; voice-missed-trigger blocked (reason: smart_routing_active)
      NO: voice-missed-trigger / event-only / SIP capture → processMissedInboundCall

syncMctbConsentRouting (consent-prompt/service.ts):
  existing_consent → pause managed missed_call_recovery SR flow
  press_1 → publish managed missed_call_recovery flow (mctbManaged: true)
```

**Extend (not replace):** `consent-service.ts`, `voice-missed-trigger.ts`, `flow-service.ts`, `syncMctbConsentRouting`.

---

## Part C — Master directive gap matrix (§1–91)

Status key: **W** Working | **P** Partial | **M** Missing | **MT** Manual test required

| § | Topic | Status | Existing implementation to extend |
|---|-------|--------|-------------------------------------|
| 1 | Product direction (MCTB + SR standalone + add-ons) | **P** | `platform-launch.ts`, `voice-nav.ts`; billing not aligned |
| 2 | Not a PBX/CRM/SMS marketing platform | **W** | Nav already focused; legacy routes preserved behind flags |
| 3 | Both MCTB modes | **W** | `consent-mode.ts`, setup/onboarding/try-it UI, divergent ingress |
| 4 | Product entitlements | **M** | Extend `ProductEntitlement` + Stripe; don't duplicate `mctb/entitlement.ts` logic |
| 5 | MCTB preserve core | **W** | Entire `mctb/` + `missed-call-text-back/` stacks |
| 6 | Keep existing number | **W** | `ingress.ts`, onboarding carriers, forward-target, setup UX |
| 7 | Carrier setup | **W** | `onboarding/carriers.ts`, `carrier-capabilities.ts`, wizard + setup |
| 8 | MCTB forwarding test | **W** | `forwarding-verification.ts`, live-test, setup-test APIs |
| 9 | Business hours / after hours (MCTB) | **P** | `eligibility.ts` send windows; **M** separate BH/AH SMS templates |
| 10 | Custom voice greetings | **W** | consent-prompt, SR `media-service`, GreetingVoicePicker, try-it demo voice |
| 11 | Custom SMS | **P** | `MissedCallTextConfig.messageTemplate`; **M** merge vars, BH/AH variants |
| 12 | SMS links + click tracking | **P** | Short links may exist in messaging; **M** MCTB-specific click attribution |
| 13 | Two-way SMS | **W** | `customer-sms.ts`, `/inbox`, inbound-process |
| 14 | Conversation view | **P** | `/inbox` canonical; `/voice/conversations` misaligned |
| 15 | Repeat caller tracking | **M** | Cooldown in `eligibility.ts`; no “called 3x today” UI |
| 16 | Exclusion / do-not-text list | **P** | `Suppression` model, compliance + personal blocked; **M** MCTB-specific exclusion UX |
| 17 | Suppression reasons | **W** | `MctbSuppressionReason` in types; displayed in missed-calls-view |
| 18 | Owner/team notifications | **P** | `notifications/in-app.ts`, settings prefs; **M** MCTB event matrix |
| 19 | Team alerts (multi-recipient) | **P** | Team settings exist; **M** per-event routing |
| 20 | Hidden recovery number callback | **P** | Ingress detects direct vs forwarded; **M** `NOT_FORWARD_EVENT` never enforced |
| 21 | Lightweight lead details | **P** | Contact model; **M** optional structured capture on missed call |
| 22 | Optional request form | **M** | Could extend public form + link in SMS |
| 23 | MCTB analytics | **P** | Dashboard summary + missed-calls API; **M** dedicated recovery KPIs page |
| 24 | MCTB activity feed | **P** | Dashboard + missed-calls list; **M** unified activity stream |
| 25 | SR preserve | **W** | Full `lib/smart-routing/**` |
| 26 | SR standalone product | **M** | Runtime works; no entitlement/checkout |
| 27 | Standalone SR flow (forward → menu → route) | **W** | SR runtime + forwarding-service |
| 28 | SR greeting | **W** | Builder greeting, audio library, TTS/record/upload |
| 29 | Phone tree / DTMF | **W** | MENU, GATHER_DTMF, timeout/invalid edges |
| 30 | Menu send SMS | **W** | `SEND_SMS` node + `consent-service` for SMS_CONSENT |
| 31 | Routing destinations | **W** | TRANSFER_EXTERNAL, destinations model, labels in builder |
| 32 | Sequential ring | **W** | RING_GROUP `mode: sequential` in both runtimes |
| 33 | Simultaneous ring | **W** | RING_GROUP simultaneous + race handling in runtimes |
| 34 | Business hours SR | **W** | `BUSINESS_HOURS` node + `schedule-engine.ts` |
| 35 | After-hours routing | **W** | `after_hours` template, schedule branches |
| 36 | Holiday / special hours | **P** | schedule-engine may support; verify + UI |
| 37 | Routing fallback | **W** | timeout/invalid/no_answer/failed edges in runtimes |
| 38 | SR + MCTB combined | **W** | consent-service + voice-missed-trigger gating + syncMctbConsentRouting |
| 39 | SR without MCTB | **P** | Fallback nodes exist; **M** entitlement gate + upgrade CTA |
| 40 | Visual Voicemail add-on | **P** | Personal VM UI + marketplace `voicemail` product exists |
| 41 | Voicemail transcription | **W** | Twilio transcription webhook + Whisper fallback |
| 42 | Voicemail translation | **M** | No original+translation UI |
| 43 | Voicemail AI summary | **M** | Optional; check if AI infra can extend |
| 44 | Voicemail notifications | **P** | Email (Brevo); **M** in-app/push on VM received |
| 45 | Voicemail notes | **M** | Check VoicemailMessage fields |
| 46 | Voicemail team assignment | **M** | Unless inbox assignment infra reusable |
| 47 | Callback request add-on | **M** | Queue callback only; no product |
| 48 | Callback statuses | **P** | `callback_requested` on HumanCall; **M** New/Contacted/Completed workflow |
| 49 | Callback notifications | **M** | Softphone banner only |
| 50 | Callback UI | **P** | Softphone + phone/calls filter; **M** dedicated activity page |
| 51 | Phone numbers page | **P** | `/voice/numbers` + personal vault; **M** operational focus per spec |
| 52 | Shared compliance | **W** | `/compliance` + registration + suppression |
| 53 | Settings consolidation | **P** | `/settings/*` spread; product config in setup |
| 54 | Product navigation | **P** | MCTB nav good; SR restored; **M** entitlement-conditional nav |
| 55 | Do not remove useful pages | **W** | Policy documented; redirects not deletes |
| 56 | Overview dashboard | **P** | `/dashboard` MCTB-specific; **M** multi-product conditional cards |
| 57 | Recent activity (unified) | **M** | Split across dashboard, missed-calls, SR activity |
| 58 | Routing analytics | **P** | SR activity view; **M** aggregate analytics API/page |
| 59 | Supportable routing logs | **W** | `SmartRoutingCallSession`, `NodeExecution`, events |
| 60 | Caller ID preservation | **W** | forwardedFrom capture SIP/event-only/bridge |
| 61 | Loop prevention | **P** | Some idempotency keys in SR; **M** explicit loop validation |
| 62 | Provider abstraction | **W** | Telnyx primary, Twilio secondary paths |
| 63 | Optional integrations | **W** | `/integrations` preserved |
| 64 | Billing (Stripe) | **P** | Stripe wired; **M** product SKUs for launch lineup |
| 65 | Trials | **P** | MCTB trial in `mctb/entitlement.ts`; **M** cross-product trials |
| 66 | Cross-selling | **M** | No contextual upgrade CTAs |
| 67 | Admin inspect | **P** | `/api/admin/mctb/[workspaceId]`; **M** full admin console per spec |
| 68 | Observability | **P** | Traces, SR events, MCTB traces; **M** structured log catalog |
| 69 | Webhook idempotency | **P** | SR telnyx idempotency, campaign keys; **M** audit all ingress |
| 70 | Workspace isolation | **W** | Tenant-scoped queries; preprod suites exist |
| 71 | Data model audit | **P** | Models exist; **M** entitlement extension only |
| 72 | Phone normalization | **W** | E.164 patterns across libs |
| 73 | Error states | **P** | Suppression reasons; **M** customer-facing failure copy audit |
| 74 | Fail-safe calling | **W** | SR fallback edges, VM nodes, say-only diagnostic |
| 75 | MCTB test matrix | **P** | Many hermetic scripts; **MT** live cert runbook |
| 76 | SR test matrix | **P** | preprod 7/7 hermetic; **MT** live PSTN |
| 77 | Combined test matrix | **P** | Logic exists; **MT** end-to-end live |
| 78 | Visual VM tests | **P** | VM APIs exist; **M** automated VM test suite |
| 79 | Callback tests | **M** | No callback product tests |
| 80 | Browser/UI tests | **M** | Script-based only |
| 81 | Build/type safety | **W** | `npm run build` passes on master |
| 82 | Migration/cleanup report | **M** | This document starts it; full report in Phase 2 prep |
| 83 | Customer-facing language | **P** | MCTB/SR UI mostly plain; audit technical terms |
| 84 | SR positioning copy | **P** | overview-view has positioning; refine per spec |
| 85 | MCTB positioning copy | **P** | dashboard/setup copy; refine per spec |
| 86 | Platform lifecycle flows | **P** | Runtime supports; **M** entitlement-gated UX |
| 87 | Do not add out-of-scope products | **W** | Reviews not on master; policy in AGENTS.md |
| 88 | Do not remove integrations | **W** | Integrations nav preserved |
| 89 | Final production review | **M** | Phase 1 inventory only |
| 90 | Required final report | **M** | Deliver at end of Phases 2–7 |
| 91 | Definition of done | **M** | Criteria documented in AGENTS.md |

---

## Part D — Recommended canonical implementation per area

| Area | Canonical (extend this) | Do not replace with |
|------|-------------------------|---------------------|
| MCTB config UI | `/voice/setup` + `/api/mctb/setup` | New setup wizard |
| MCTB runtime | `processMissedInboundCall` + `MissedCallTextConfig` | New SMS pipeline |
| MCTB voice ingress | SIP → LiveKit → Python (`mctb_sip_production.py`) | New TeXML-only path |
| MCTB Press-1 audio | `consent-prompt/service.ts` + SR flow sync | Parallel consent system |
| MCTB automatic mode | `event-only/handle.ts` + SIP `sip-capture.ts` | New event handler |
| SMS conversations | `/inbox` + `customer-sms.ts` | New inbox |
| Missed call log | `/voice/missed-calls` + `MissedCallEvent` | New event table |
| Smart Routing | `lib/smart-routing/**` + existing pages | New flow builder |
| SR Telnyx runtime | `flow-runtime.ts` + shared webhook-handlers | New Telnyx integration |
| SR Twilio runtime | `twilio-flow-runtime.ts` | Rewrite |
| Voicemail inbox | `/personal/voicemail` + `/api/phone/voicemail` | New VM product |
| Voicemail billing | Marketplace `voicemail` product | Second VM subscription system |
| Callback overflow | `queue-runtime.ts` + `HumanCall` | New callback runtime |
| Platform entitlements | Extend `ProductEntitlement` + `MarketplaceBillingProduct` | Fourth billing layer |
| MCTB service limits | Keep `mctb/entitlement.ts`; map to new `mctb` product flag | Duplicate trial logic |
| Compliance | `/compliance` + shared registration | Per-product compliance stacks |
| Analytics (MCTB) | New page/API feeding from `MissedCallEvent` + inbox | Replace `/api/voice/analytics` |
| Analytics (voice AI) | Keep `/voice/analytics` for voiceCall metrics | Delete |
| Conversations nav | Point to `/inbox` or hybrid view on `MissedCallEvent` + messages | New conversations system |
| Automation link | Keep `saveMissedCallTextBack` dual-write until automation decoupled | Delete SolutionSetup abruptly |
| Legacy 571 paths | Keep behind flags; document rollback scripts | Delete until SIP cert complete |

---

## Part E — Legacy / duplicate cleanup candidates (Phase 7 only)

| Item | Class | Phase 7 action |
|------|-------|----------------|
| `missed-call-text-back-wizard.tsx` | Legacy | Remove after confirming no imports |
| `agent-detail.tsx` (John) | Legacy | Remove or redirect links in hire flows |
| `/api/solutions/missed-call-text-back` | Legacy | Migrate ops scripts to `/api/mctb/setup` |
| `syncConfigFromSolutionSetup` | Legacy | Remove dead code |
| TeXML 571 ingress routes | Legacy | Deprecate after SIP cert LIVE_VERIFIED |
| `buildPersonalNav` unused | Duplicate | Remove or wire to numbers nav |
| VM email HTML duplication | Duplicate | Consolidate to one helper |
| `/voice/conversations` data mismatch | Duplicate | Fix view or redirect to inbox |

**Do not delete until:** replacement verified + tests pass + no deep links in registry (`outcomes/registry.ts`, `load-systems.ts`).

---

## Part F — Phase 2–7 execution plan (based on actual codebase)

### Phase 2 — Entitlements & billing (no runtime rewrites)

1. Extend Prisma: `WorkspaceProductEntitlement` or expand `ProductKey` with `MCTB`, `SMART_ROUTING`, `VISUAL_VOICEMAIL`, `CALLBACK_REQUESTS` (or JSON feature map on workspace — prefer fitting existing patterns).
2. Stripe: add catalog entries in `marketplace-billing-catalog.ts` **or** SaaS plan mapping in `stripe-billing-webhook.ts` for standalone MCTB, standalone SR, bundle, add-ons. Env: `STRIPE_PRICE_*` pattern from `settings/billing.ts`.
3. Bridge layers: map new flags to existing gates — `mctb/entitlement.ts`, `capabilities.ts` `smart_routing`, `marketplace-service-gate.ts` for VM.
4. Checkout UX: extend `personal-service-subscribe-banner.tsx` / settings billing for platform products (not only per-number).
5. Admin: extend `/api/admin/mctb/[workspaceId]` → workspace product snapshot.
6. **Tests:** entitlement unit tests; no telephony changes.

### Phase 3 — Navigation & overview consolidation

1. Conditional nav in `voice-nav.ts` based on entitlements (not `platform-launch` booleans alone).
2. Fix `/voice/conversations` → SMS-aware view or redirect to `/inbox` with MCTB filter.
3. Unified Overview `/dashboard`: conditional cards (MCTB, SR, VM, callback) from existing APIs.
4. Unified activity feed: aggregate `MissedCallEvent`, SR sessions, `VoicemailMessage`, `HumanCall` callback_requested.
5. Update stale links in `outcomes/registry.ts`, `load-systems.ts`.
6. **Do not delete** `/voice/agents`, `/integrations`, reports — feature-gate or deep-link only.

### Phase 4 — MCTB gaps (on existing runtime)

1. BH/AH SMS templates in `MissedCallTextConfig` + setup UI.
2. Merge variables in `send.ts` message builder.
3. Link click tracking: reuse messaging short-link infra if present.
4. Repeat caller badges: query `MissedCallEvent` by caller E164 in missed-calls + inbox detail.
5. MCTB exclusion list UI: extend personal blocked or compliance suppression with MCTB-specific reason.
6. Enforce `NOT_FORWARD_EVENT` in `eligibility.ts` (configurable).
7. Hidden-number routing policy: extend `ingress.ts` + setup docs.
8. MCTB analytics page: new `/voice/analytics` section or `/dashboard` deep metrics from `MissedCallEvent` — **keep** existing voice AI analytics at separate route if needed.
9. Notification matrix: extend `notifyWorkspace` for MCTB events.

### Phase 5 — Smart Routing gaps (on existing runtime)

1. Entitlement gates: hide publish/activate without `smart_routing` product.
2. Standalone onboarding: reuse `/smart-routing/new` + carrier forward instructions from MCTB onboarding components.
3. Routing analytics API from `SmartRoutingCallSession` aggregates.
4. Cross-sell CTA component when SR-only and call unanswered (no MCTB entitlement).
5. Verify combined SR→MCTB live path; document in cert runbook.
6. Optional: `CALLBACK` node type only if Phase 6 doesn't use softphone callback path.

### Phase 6 — Add-ons (audit-first, extend existing)

**Visual Voicemail:**

1. Feature-gate existing `/personal/voicemail` with `visual_voicemail` entitlement.
2. Map marketplace `voicemail` sub OR new platform add-on SKU.
3. Add in-app notification on VM received (`notifyWorkspace`).
4. Translation/summary: extend `voicemail-transcribe.ts` + UI only if provider supports.
5. Notes field on `VoicemailMessage` if missing.

**Callback Requests:**

1. Decide: thin `CallbackRequest` model **or** extend `HumanCall` with status workflow.
2. Reuse `queue-runtime` callback pattern for SR menu action (new node or SUBFLOW).
3. Dedicated `/voice/callback-requests` or tab under activity.
4. Email/SMS notifications via existing notification infra.
5. Entitlement gate `callback_requests`.

### Phase 7 — Test matrices, production hardening, cleanup

1. Run §75–79 matrices; document **MT** live smokes explicitly.
2. Workspace isolation: extend existing preprod suites.
3. Loop prevention audit on SR destinations + forward targets.
4. Webhook idempotency audit across MCTB ingress paths.
5. Customer language audit on setup/SR/overview.
6. Legacy cleanup from Part E (only after green tests).
7. Produce §90 final report.

---

## Part G — Manual tests required (cannot close in hermetic CI)

| Area | Procedure |
|------|-----------|
| MCTB Press-1 live | `mctb-certification-runbook.ts` Pass 2 + real forward to SIP ingress |
| MCTB automatic mode | Forwarded call → event-only/SIP capture → SMS without Press-1 |
| SR live IVR | `SMART_ROUTING_LIVE_TEST=1` in preprod suite |
| Combined SR→MCTB | Menu → ring no answer → MCTB recovery; verify ANI |
| VM transcription | Leave VM on Personal number; verify transcript webhook |
| Carrier forwarding | Human forward setup per carrier guide + verification poll |

---

## Part H — Production blockers (current)

1. **No purchasable standalone Smart Routing** (billing/entitlement gap).
2. **No fine-grained product entitlements** for launch lineup.
3. **Conversations nav misalignment** (voice calls vs SMS threads).
4. **MCTB analytics** not recovery-specific in primary nav surface.
5. **Live telephony certification** many items `MANUAL_HUMAN_TEST_REQUIRED` in launch matrix.
6. **`NOT_FORWARD_EVENT`** defined but not enforced for direct dial to recovery numbers.

---

*End of Phase 1 inventory. No code changes. Ready for Phase 2 upon approval.*
