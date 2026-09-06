<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## V1 launch scope (frozen)

**ACTIVE V1 products:** Appointments + SMS reminders · Missed Call Text Back · Conversations · Contacts · Transovo Fax

**UI rebuild directive:** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` (read first — authority & conflict resolution) · `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` · **IA:** `docs/TRANSOVO-UI-DESIGN-GUIDE.md` · **Page architecture:** `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` · **Visual design:** `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md` · **Accessibility (Guide #1):** `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md` · **HCD/Usability (Guide #2):** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` · **IA/Navigation (Guide #3):** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · **Interaction/Keyboard/Focus (Guide #4):** `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md` · **Forms/Validation (Guide #5):** `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · **Responsive/Reflow (Guide #6):** `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · **Tables/Grids (Guide #7):** `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · **Privacy/Compliance (Guide #8):** `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · **Security/Auth (Guide #9):** `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · **Date/Time/Timezone/Locale (Guide #10):** `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md` · **i18n/l10n (Guide #11):** `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md` · Nav: `src/lib/products/v1-launch-nav.ts`

**PRESERVED (hidden from launch nav, not deleted):** Mass SMS — Campaigns, Drips, Keywords, Playbooks, Automations, bulk send, list/segment marketing

**DORMANT (preserved, not customer-facing):** Transovo Verify — see `docs/verify-dormant.md`

**DEFERRED:** Smart Routing, AI Receptionist, call forwarding, other live-call products

Do not add new products or expand Fax/MCTB feature scope until production certification completes. Focus: correctness, live provider verification, billing, security, browser validation.

Certification: `docs/V1-PRODUCTION-CERTIFICATION.md` · Gate: `npm run test:v1-production-readiness`

---

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

## Visual UI Agent / Kimi UI Sub-Agent

**Mandatory:** Kimi-generated UI must conform to `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` and all applicable Transovo standards guides. Cursor must verify Kimi output against governance before integration — do not ship presentation that violates IA, page architecture, visual system, accessibility, interaction, or other governing rules.

**Orchestration:** USER → CURSOR → repo-local Kimi tool → generated UI → CURSOR integrates.

### Two modes

| Mode | When | Command |
|------|------|---------|
| **GENERATION (Mode 1)** | New page from reference video → sandbox | `npm run ui:kimi -- --target /route --video <name>` |
| **POLISH (Mode 2/3)** | Existing page ~60%+ done — tighten real frontend in place | `npm run ui:kimi -- --mode polish --target /campaigns --walkthrough --capture-current --apply` |
| **MODE 4 — PRODUCTION REBUILD** | Full approved customer-facing UI rebuild | `npm run ui:kimi-mode4` — see orchestration doc |

**Mode 4 is the default for the Transovo full UI rebuild.** Do not substitute Mode 3 polish passes for approved inventory pages.

**Read first:** `docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md` · Allowlist: `docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`

### Mode 4 — Cursor orchestration rules (mandatory)

**Cursor orchestrates. Kimi implements UI. Cursor does NOT redesign production pages manually.**

**Cursor must NEVER run for Mode 4 verification:** builds, dev servers, browsers, screenshots, Playwright, Puppeteer, Cypress, Docker builds, memory-heavy tests, visual verification.

**Cursor must:**

1. Load all governing standards (`npm run ui:kimi-mode4-standards` or `mode4-standards-pack.ts`)
2. Use **only** the approved page inventory — not repo route discovery
3. Generate a **Page Contract** per page before Kimi (`npm run ui:kimi-mode4-contract -- --id <id>`)
4. Run foundations serially, then golden screens, then bulk with **≤10 concurrent** jobs (`npm run ui:kimi-mode4 -- --stage bulk --concurrency 10 --stagger-ms 5000`)
5. Statically verify each result against Page Contract + feature matrix
6. Integrate Kimi output into **actual production routes** — Kimi version becomes canonical
7. Record completion in `.ui-agent/mode4/batch-state.json`

**Kimi receives:** full standards originals + Page Contract + Campaign/Inbox art-direction videos (not product architecture).

**Prefer POLISH (Mode 2/3)** only for targeted refinement after Mode 4 — not as a substitute for full rebuild.

### POLISH workflow (production pages)

1. Git checkpoint (`BEFORE_KIMI_POLISH=<commit>` recorded automatically).
2. Capture **multiple real states** via Playwright (`--walkthrough` for list + builder + modals).
3. Send screenshots + relevant `src/` presentation files to Kimi (K3, `reasoning_effort=low`).
4. Kimi edits **real** `src/app/`, `src/components/`, `src/styles/` only — never APIs/lib/runtime.
5. Cursor inspects diff, validates protected paths, re-captures AFTER screenshots.
6. Max **2 passes**. Roll back with `git checkout BEFORE_KIMI_POLISH -- <files>` if worse.

**Auth for capture:** set `DEV_AUTH_BYPASS=1` on the target environment (uses `/api/auth/dev-bypass`). Or `UI_AGENT_SMOKE_EMAIL` + password. Set `UI_AGENT_BASE_URL` to production/staging URL.

**Campaigns walkthrough states:** list (`/campaigns`), create (`/campaigns/new`), review (`/campaigns/new/review`).

### GENERATION workflow (reference video → sandbox)

The user should **not** manually operate Kimi. When the user asks to recreate a page from a saved video/image:

1. Resolve media from `.ui-agent/references.json` (`npm run ui:refs`) or local `--video-file` paths.
2. Identify the exact existing Transovo target route/component.
3. Capture the current rendered page when useful (`--capture-current`).
4. Invoke `npm run ui:kimi -- --target <route> --video <name> [--instruction "..."]`.
5. Inspect output at `/transovo/kimi/preview/<session>` (Current | Kimi | Split).
6. Optionally revise: `npm run ui:kimi -- --session <id> --revise --instruction "..."`.
7. Approve: `npm run ui:approve -- --session <id>` → writes `HANDOFF.json`.
8. Integrate into production — reuse Kimi presentation, wire real hooks/APIs.
9. Compare **approved Kimi render** vs **production** — not the original competitor video.

**Reference library:** upload once at `/transovo/kimi`, then tell Cursor: *"Use Kimi with slicktext-inbox to redo /conversations."*

**Kimi must NOT scaffold a new Next.js project.** It generates only `page.tsx` + `components/**` in `.ui-agent/generated/<session>/` using the environment manifest. See `INTEGRATION_PRINCIPLES` in `scripts/ui-agent/config.ts`.

### Workflow

```
Reference media + current Transovo capture
        ↓
npm run ui:kimi  (Cursor-invoked)
        ↓
.ui-agent/generated/<session>/  (0 → 85–95% visual)
        ↓
/transovo/kimi/preview/<session> → approve → HANDOFF.json
        ↓
Cursor integrates into src/  (85–95% → production)
        ↓
Final check: approved Kimi render vs production result
```

### Integration rules (Cursor / Composer)

Kimi's generated UI is the **starting frontend implementation**, not merely a design reference.

- **Reuse 80–90%** of Kimi's presentation code where practical (JSX, classNames, layout, spacing, transitions).
- **Visual fidelity** matters more than preserving exact generated source code.
- **Refactor freely** for production: swap Kimi `useState` for existing hooks, merge JSX into existing components, use design-system primitives, routing, a11y.
- **Do not** copy `mock-data.ts`, `MOCK_*`, or imports from `.ui-agent/generated/` into production.
- **Goal:** Kimi-created visual result + Transovo production functionality — NOT line-for-line source preservation.

### Video delivery (native multimodal)

Videos use Kimi's **Files API + `ms://` reference** — never base64 in prompt text, never auto-convert to screenshot sequences.

```
Supabase reference → local cache → POST /v1/files (purpose=video) → ms://<id> → kimi-k3
```

Screenshots (current Transovo captures) stay as compact image data URLs. See `VIDEO_DELIVERY_PRINCIPLES` in `scripts/ui-agent/config.ts`.

### Kimi UI routes (production)

- `/transovo/kimi` — upload/name reference videos and images
- `/transovo/kimi/preview/[sessionId]` — Current / Kimi / Split comparison

See `scripts/ui-agent/README.md`.

**Persistence (Cloud Agents):** Kimi-generated frontend source is never disposable. On successful generation, source is copied immediately to `src/kimi-drafts/<route>/<session>/` before preview/refinement. Generation fails with `KIMI_OUTPUT_NOT_PERSISTED` if that copy does not succeed. The ephemeral sandbox under `.ui-agent/generated/` remains gitignored scratch.

---

## Mass Texting — glue code & user flows (mandatory for Kimi-connected work)

**Read:** `docs/MASS_TEXTING_GLUE_FLOWS.md`

When the user asks to wire, audit, or fix Mass Texting pages (campaigns, inbox, contacts, drip, media):

### What to change

- **DO change:** `*-connected.tsx` shells, `kimi-*-adapter.ts`, URL/filter helpers (`conversation-url-filters.ts`), `src/components/campaigns/broadcast/*`, `src/components/inbox/*`, `src/components/drip-campaigns/*`, API routes, `src/lib/mass-texting/**`, `src/lib/campaigns/**` (glue only).
- **DO NOT change for backend wiring:** Kimi **look** under `src/components/kimi/**` (layout, colors, spacing, CSS). Presentation polish uses `ui:kimi --mode polish` separately.

### Definition of done

Not “API tests pass.” Done when the **full user journey** in `MASS_TEXTING_GLUE_FLOWS.md` works:

- Cold load (hard refresh on the route)
- Main action start → finish
- Navigate away and back (list still shows the item)
- No false empty states, no SSR→client wipe, no crash on the **next** screen after success

### Review process

1. Identify the feature’s flow section in `docs/MASS_TEXTING_GLUE_FLOWS.md`.
2. Trace glue only: every `fetch`, `router.push`, filter URL sync, and `setState` that replaces lists.
3. Check **common glue failure patterns** table in that doc (filter URL, SSR wipe, selection-triggered reload, prisma-compat includes, tab width).
4. Fix glue; spot-check the manual smoke steps for that feature (do not run full cert suites unless asked).

### Pages in scope (recent work)

| Area | Entry route | Glue shell |
|------|-------------|------------|
| Campaigns | `/campaigns` | `kimi-campaigns-connected.tsx` |
| Inbox | `/conversations` | `kimi-conversations-connected.tsx` |
| Contacts | `/contacts` | `kimi-contacts-connected.tsx` |
| Lists / Segments | `/contacts/lists`, `/contacts/segments` | `kimi-lists-connected.tsx`, `kimi-segments-connected.tsx` |
| Drip | `/automations/drip-campaigns` | `drip-campaigns-list.tsx` + `lib/drip-campaigns/*` |
| Media | `/messaging/media` | `kimi-media-connected.tsx` |

API-only scripts (`test-drip-campaigns-api.mjs`, etc.) do **not** replace flow review — they skip connected-shell state bugs.
