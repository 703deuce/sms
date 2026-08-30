<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Transovo production build — preserve first, extend second

**This is an extension/consolidation job, not a rewrite.**

Missed Call Text Back and Smart Routing already work in this repo. **Do not remove, replace, rewrite, disable, or regress working telephony, SMS, compliance, or provider flows.**

Before creating replacements, **audit** existing routes, pages, components, APIs, Prisma models, and tests. Reuse working setup/testing flows. If something exists and is useful, preserve it unless it directly conflicts with the product structure.

### Non-negotiables

- Keep **both MCTB modes**: Press-1 consent (`press_1`) and automatic text-back (`existing_consent`). Never make Press-1 the only option.

### MCTB Final Production Pipeline (FROZEN — `mctb_texml_final_v1`)

**Read:** `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`

PSTN-certified TeXML ingress for CFNA. **Do not change** these behaviors without explicit sign-off and re-cert on both modes:

- **`press_1`:** `<Play>` press-1 consent audio → `<Gather>` DTMF 1 → SMS
- **`existing_consent`:** `<Play>` voicemail greeting → `<Hangup>` → auto SMS on `texml-status`

Do not route certified MCTB DIDs back to LiveKit FQDN, Call Control-only ingress, or AI assistant TeXML. Guards: `isMctbTexmlIngressLocked()`. Verify: `npm run verify:mctb-final-pipeline`.
- **Smart Routing** is a standalone purchasable product as well as a bundle with MCTB. Do not require MCTB to use Smart Routing.
- Customer keeps their **existing business number** — inbound layer only; no port-required launch.
- Do not turn this into a PBX, softphone, CRM, SMS marketing platform, AI receptionist, or vanity-number marketplace.
- Do not add Reviews, Realtor, or other out-of-scope products in this workstream.
- Optional existing integrations may remain; core value must work without external SaaS.

### Product entitlements (target)

Independent flags (fit existing billing architecture): `mctb`, `mass_texting`, `smart_routing`, `visual_voicemail`, `callback_requests`. One workspace/account can own any combination. Use Stripe for Transovo billing; env/config for price IDs.

**Mass Texting** uses `MASS_TEXTING` workspace feature entitlement — standalone from MCTB. Shared Inbox/Contacts may be reachable when either product is active.

### Mass Texting ↔ MCTB architecture boundary

Mass Texting is a **standalone SMS marketing product**. It must remain isolated from the MCTB live voice path.

**Mass Texting may share:** auth, workspace, billing, contacts, numbers, A2P infrastructure, SMS transport, provider adapters, inbound SMS, STOP/HELP, suppression store, inbox/conversations, usage/credits, observability.

**Mass Texting must NOT import from, modify, depend on, or call:**

- `lib/mctb/sip-*`
- LiveKit runtime / MCTB voice webhooks
- call forwarding, voicemail runtime, DTMF/press-1, missed-call classifier, MCTB call teardown

All Mass Texting code lives under `src/lib/mass-texting/` and shared layers (`lib/sms/`, `lib/messaging/`, `lib/campaigns/`, `lib/contacts/`). Regression: `npx tsx scripts/test-mass-texting-boundary.ts`.

A2P registrations are **per product use case** (`MCTB_CUSTOMER_CARE` vs `MASS_TEXT_MARKETING`) via `MessagingProductRegistration`. Do not send Mass Text traffic through an MCTB-only campaign registration.

**Current gap:** legacy `ProductEntitlement` (`voice | numbers | sms`) still gates the SMS shell; `mass_texting` feature entitlement is the target commercial flag.

### Canonical nav (focused sidebar)

- **Overview** (conditional cards by entitlement)
- **MCTB:** Missed Calls, Conversations, Setup
- **Smart Routing:** Call Routing (`/smart-routing`), Routing Activity
- **Add-ons:** Visual Voicemail, Callback Requests (when entitled)
- **Shared:** Numbers, Analytics, Compliance, Integrations, Settings, Billing

Clean nav ≠ delete working pages. Hide, consolidate, tab, or feature-gate legacy surfaces instead of deleting functioning code.

### Implementation order

1. Audit + inventory (canonical vs legacy vs duplicate)
2. Product entitlements + Stripe SKUs (standalone MCTB, standalone SR, add-ons, bundle)
3. UI consolidation (nav, overview dashboard, activity feed) without breaking routes
4. Missing MCTB gaps (exclusion list, suppression reasons, repeat caller, business-hours SMS, link tracking) on existing runtime
5. Missing SR gaps (standalone purchase flow, entitlement gates, analytics) on existing `lib/smart-routing`
6. Add-ons: Visual Voicemail, Callback Requests (audit existing voicemail code first)
7. Billing trials + contextual cross-sell (not obnoxious)
8. Test matrices (MCTB, SR, combined, voicemail, callback) + production build

### Key existing surfaces (do not rebuild)

| Area | Routes / entry points |
|------|------------------------|
| MCTB nav | `/dashboard`, `/voice/conversations`, `/voice/missed-calls`, `/voice/setup`, `/voice/numbers`, `/compliance`, `/voice/analytics`, `/integrations`, `/settings/business` |
| MCTB runtime | `src/lib/agents/missed-call-text-back/`, `src/lib/mctb/` |
| MCTB modes | `src/lib/mctb/consent-mode.ts` — `press_1` vs `existing_consent` |
| Smart Routing | `/smart-routing/**`, `src/lib/smart-routing/**`, Telnyx via `webhook-handlers.ts` |
| SR nav | `src/lib/smart-routing/nav-children.ts`, `voice-nav.ts` (enabled) |

### Definition of done

Not "pages render." Done when existing MCTB + both modes + existing SR still work; SR standalone + bundle billing works; combined SR→MCTB fallback works; compliance/cooldown/exclusion visible; add-ons functional; tests + build pass; remaining live telephony smokes documented.

## Caller Amy production verification

Do **not** mark Caller Amy overall PASS until all five gates pass on a real phone call:

1. **CATALOG** — `node scripts/audit-caller-amy-published-tools.mjs` (live Telnyx assistant has only the 7 model-facing webhooks + native hangup/transfer).
2. **TOOL TRANSPORT** — `record_current_field` or `continue_workflow` must hit `/api/telnyx/voice/tools` (check `voiceToolExecution` rows and `providerWebhookEvent` with `eventType=voice.tool_webhook.ingress`).
3. **WORKFLOW** — collected fields advance state (no direct `calendar_availability` during collection).
4. **BOOKING** — one appointment via runtime (`get_booking_verification`).
5. **CALL DATA** — one canonical `voiceCall` from conversation start with ANI, duration, transcript, and tool traces.

Report: `node scripts/caller-amy-five-gate-report.mjs` (set `CALL_ID` after a smoke call).

Telnyx-side tool audit: `node scripts/audit-telnyx-call-tool-transport.mjs` (set `CONVERSATION_ID` or `CALL_CONTROL_ID`, `CALL_ID`, `BASE_URL`).

PR #100 (`continue_workflow` timeout/fillers) does **not** fix zero tool transport — do not merge it until TOOL TRANSPORT passes.

**Known TeXML-direct failure mode:** Telnyx may invoke `get_runtime_context` before a `VoiceCall` row exists (only hangup status_callback created the call). Fix: `ensureVoiceCallForToolWebhook` on `/api/telnyx/voice/tools` + early TeXML lifecycle — see PR #102.

## Caller Amy pre-production suite (run before deploy)

```bash
npm run test:caller-amy-preprod
# or full orchestration + preprod:
npm run test:caller-amy
```

Exercises real webhook ingress, call lifecycle, field collection, transcript pipeline, concurrency, and tenant isolation against `DATABASE_URL` (isolated tenants). The script prints the same five-gate report; **overall PASS requires 5/5** before production smoke.

**Development workflow:** unit contracts → `npm run test:caller-amy-preprod` → provider integration (Calendly test calendar) → adversarial/failure tests → staging assistant → **one** real production smoke call.

**REQUIRES LIVE TELNYX ACCEPTANCE TEST:** conversational LLM/audio session, progressive filler timing under real latency, and final end-to-end audio — cannot be fully simulated via HTTP webhooks alone.

## AI Receptionist (generic LiveKit product agent)

**Do not** extend the real-estate Front Desk runtime as the default SaaS receptionist. Build a **configuration-driven generic agent** on the shared LiveKit worker.

**Read first:** `docs/ai-receptionist-runtime-implementation.md` — audit, compile pipeline, factory model, phased plan, acceptance tests.

**Architecture:** `UI draft → compileReceptionistConfig() → VoiceAgentVersion → createGenericReceptionistAgent() → AgentSession`

**UI routes:** `/voice/agents` (list), `[id]/about`, `[id]/capabilities`, `[id]/advanced`, `[id]/voice-test`

**Reuse:** `voice-runtime/src/inbound-session-pipeline.ts`, `booking-tools.ts`, `transfer-tool.ts`, `agent-service.ts` publish/versioning, telephony provisioning.

**LiveKit examples (reference):** `/agent/repos/agents/examples/survey/`, `hotel_receptionist/`, `warm-transfer/`, SDK `beta/workflows/task_group.py`.

## Visual UI Agent

When the user supplies a screenshot, design reference, or screen recording and asks to improve an existing Transovo page:

### Workflow (reference implementation mode)

```
Reference media + current Transovo capture
        ↓
Kimi builds UI in .ui-agent/generated/<session>/  (0 → 85–95% visual)
        ↓
Preview → approve (APPROVED.json + screenshot.png)
        ↓
Cursor integrates into src/  (85–95% → production)
        ↓
Final check: approved Kimi render vs production result
```

1. **Kimi builds** a complete visual reference in `.ui-agent/generated/<session>/` (mock data allowed in sandbox only).
2. **Preview** with `npm run ui:preview -- --session <id>` — inspect before touching production.
3. **Approve** with `npm run ui:approve -- --session <id>` — freezes the approved Kimi render as the visual target.
4. **Integrate** with `npm run ui:integrate` — transplant presentation into real `src/` components using existing hooks/APIs.
5. **Never** let Kimi edit `src/` directly during the build phase.

### Integration rules (Cursor / Composer)

Kimi's generated UI is the **starting frontend implementation**, not merely a design reference.

- **Reuse 80–90%** of Kimi's presentation code where practical (JSX, classNames, layout, spacing, transitions).
- **Visual fidelity** matters more than preserving exact generated source code.
- **Refactor freely** for production: swap Kimi `useState` for existing hooks, merge JSX into existing components (e.g. put Kimi's row layout into `ConversationRow.tsx`), use design-system primitives, routing, a11y.
- **Do not** copy `mock-data.ts`, `MOCK_*`, or imports from `.ui-agent/generated/` into production.
- **Goal:** Kimi-created visual result + Transovo production functionality — NOT line-for-line source preservation.
- **Final visual check:** compare **approved Kimi sandbox render** vs **production after integration** — NOT the original competitor video.

Shared prompt text: `INTEGRATION_PRINCIPLES` in `scripts/ui-agent/config.ts`.

### Safety

- Capture the **rendered** current page (`--capture-current`), not just source code.
- Default to plan-only for `ui:integrate`; apply only with `--apply`.
- If backend work is required, document in `backendChangesRequired` — do not fake it.

See `scripts/ui-agent/README.md`.
