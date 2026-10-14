# Business Messaging — functional audit (real vs stub)

**Purpose:** Answer whether review/product surfaces actually send SMS when someone connects numbers, adds audience, and launches — or are UI-only stubs.

**Basis:** Repository wiring (`MASS_TEXTING_GLUE_FLOWS.md`, mass-texting launch/send libs, MCTB/AR docs). Not a live Telnyx smoke on your tenant.

**Short answer:** Main **review → send** paths are **real pipelines**, not decorative UI. Nothing sends until **entitlements, sender/A2P, credits, audience, and background workers** all pass their gates.

---

## What “review” means in Campaigns

The broadcast flow is built around a real pre-send review API:

| Step | Route / UI | Backend | Sends SMS? |
|------|------------|---------|------------|
| Compose | `/campaigns/new` | `saveCampaignDraft` → `POST/PATCH /api/mass-texting/campaigns` | No (draft only) |
| **Review** | `/campaigns/new/review` | `GET /api/mass-texting/campaigns/:id/launch-review` → `buildPreSendReview` (audience dedupe, suppressions, **credit math**, sender resolution) | No — **review is DB-only** (no provider sync on that screen) |
| Queue | `/campaigns/new/queue` | Same review data + countdown UX | No until launch |
| Launch | Review or queue | `POST …/launch` → `launchCampaignWithAudit` (reserves credits, enrolls recipients, **A2P check at launch**) | **Yes** — hands off to `campaign-processor` / `campaign-message-send` → real SMS dispatch |
| Results | `/campaigns/:id` | Stats/recipients APIs | Reflects real send outcomes |
| Test from compose | Modal | `POST /api/sms/send` → `sendQuickSms` | **Yes** (single message; same gate family as inbox quick send) |

**Review is not a fake screen** — it loads authoritative counts and `canSend` / `blockReason`. Send-now still goes through **launch** (often via queue), which is intentional.

**Key glue files:**

- Adapter: `src/lib/campaigns/kimi-campaigns-adapter.ts` (`fetchLaunchReview`, `launchCampaign`)
- Review API: `src/app/api/mass-texting/campaigns/[id]/launch-review/route.ts`
- Launch: `src/lib/mass-texting/campaign-launch.ts`, `src/app/api/mass-texting/campaigns/[id]/launch/route.ts`
- Pre-send review: `src/lib/mass-texting/pre-send-review.ts`
- Worker send: `src/lib/campaigns/campaign-processor.ts`, `src/lib/campaigns/campaign-message-send.ts`

---

## If someone connects numbers and audience — will Campaigns actually text?

**Yes, when all of this is true:**

1. **`mass_texting` workspace feature** — APIs call `requireMassTextingWorkspace` (`src/lib/mass-texting/access.ts`). The unified nav can show Campaigns with an **Activate** badge; browsing may work, but **mass-texting APIs will fail without entitlement** (“Mass Texting is not enabled for this workspace”).
2. **Sending number + A2P** — At launch and on each outbound campaign message, `assertMassTextMarketingSendAllowed` runs (`src/lib/mass-texting/a2p-enforcement.ts`). No approval → launch or sends fail with a clear reason.
3. **Credits / segments** — Review shows availability; launch reserves segments; worker enforces reservation or account eligibility (`credit-accounting.ts`).
4. **Audience** — Lists/segments resolve to real contacts; opted-out/suppressed numbers are removed in review math.
5. **Workers** — `processCampaignSendBatch` / `enqueueDueCampaignMessages` must be running (`src/lib/jobs/job-handlers.ts`). UI alone does not deliver; **missing worker = stuck “sending”**, not a fake UI.
6. **MMS** — If the message has media and `MASS_TEXT_MMS_PRODUCTION_ENABLED` is off, review sets `canSend: false` (“MMS is not enabled in production yet”).

### Not fully live (real UI, blocked or partial backend)

- **Recurring broadcast** — `scheduleMode: "recurring"` throws *“Recurring campaigns are not enabled yet”* unless `MASS_TEXT_RECURRING_PRODUCTION_ENABLED` is on (`src/lib/mass-texting/broadcast/service.ts`).
- **Templates** — `/templates`, `/templates/new`, `/templates/ai` use **legacy shell** (not full Opus migration); they still hit real template/AI APIs where implemented. They are not the broadcast launch path.
- **Playbook / sequence campaigns** — `/campaigns/new/[category]` (non-broadcast) uses **`POST /api/campaigns`** (sequence engine, triggers), **not** `/api/mass-texting/campaigns`. That path is **real** but is a **second system** from “Create broadcast → Review → Launch”. Triggers like “new lead” need the automation/runtime that enrolls contacts.

**Broadcast user flow (send now):**

```
/campaigns → Create → compose → Review → Queue (countdown) → Launch
  → /campaigns/:id (results)
  → Back to /campaigns (campaign appears in list)
```

See: `docs/MASS_TEXTING_GLUE_FLOWS.md`

---

## Mental model

```text
UI (review / compose / settings)
    → API (auth + entitlement)
        → domain (audience, credits, A2P, enrollment)
            → queue/worker
                → Telnyx (or provider) SMS
```

- **Stubs** would be: mock `canSend: true` with no API, or launch that only updates local state. **That is not what the broadcast review/launch path does** — it persists campaigns, enrolls `campaignRecipient` rows, and uses the same send path as certification scripts (e.g. `scripts/test-mass-texting-certification.ts`).
- **What feels like “it doesn’t work”** is usually: no `mass_texting` flag, compliance not approved, no credits, empty audience after suppression, worker down, or using the **playbook** flow expecting instant broadcast behavior.

---

## Other Business Messaging products

Unified nav (8 links): see `docs/BUSINESS-MESSAGING-ROUTE-MATRIX.md`

| Product | Primary routes | UI mostly | Actually texts / runs? | Typical blockers |
|---------|----------------|-----------|-------------------------|------------------|
| **Inbox** | `/conversations` | Opus-connected glue (`kimi-conversations-connected.tsx`, `kimi-inbox-adapter.ts`) | **Yes** — reply `PATCH`, new thread `POST /api/sms/send` with `inboxCompose` | Inbox permissions, sender/A2P, opt-out |
| **Contacts / lists** | `/contacts`, `/contacts/lists` | Real CRUD | **Indirect** — feeds campaigns & inbox | Bad phones, consent/suppression |
| **MCTB** | `/mctb`, setup, text-back, phone | Opus rebuild surfaces | **Yes in code** — TeXML voice path + MCTB SMS jobs/libs | Forwarding verified, consent mode, sender, plan limits; **V1 cert: MCTB NOT READY** for full production sign-off (`docs/V1-PRODUCTION-CERTIFICATION.md`) |
| **Appointment Reminders** | `/appointment-reminders/*` | Opus AR workspace | **Yes in code** — reminder engine, `appointment_reminders` queue, customer SMS jobs | AR entitlement, activate setup, calendar import, sender pool; **automated matrix finished; live golden-tenant SMS still manual** (`docs/AR-LAUNCH-READINESS-NOW.md`) |
| **Campaigns (broadcast)** | `/campaigns`, `/campaigns/new/review` | Opus (mass-texting APIs) | **Yes** (see above) | `mass_texting`, A2P, credits, worker |
| **Drip** | `/automations/drip-campaigns` | Preserved; hidden from V1 launch nav | **Yes** — `lib/drip-campaigns` | Entitlement, enrollment triggers |
| **Integrations** | `/integrations` | Settings-style | **Varies per integration** | OAuth/provider; not an SMS send surface by itself |
| **Fax** | Fax routes | Product exists | **Code paths exist; live PSTN fax not certified** | Telnyx fax, Stripe, live send/receive per V1 cert |

### MCTB (more detail)

- Runtime: `src/lib/mctb/`, `src/lib/agents/missed-call-text-back/`
- Both consent modes must remain: `press_1` and `existing_consent`
- Certified TeXML pipeline is frozen — see `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`
- Mass Texting must **not** import MCTB voice/SIP paths (boundary: `scripts/test-mass-texting-boundary.ts`)

### Appointment Reminders (more detail)

- Engine / delivery: `src/lib/appointments/reminder-delivery.ts`, `src/lib/appointment-reminders/**`
- Jobs: `appointment_reminders` queue (e.g. `ar_send_customer_sms`)
- Launch bar: `npm run test:appointment-reminders`, live runbook in `docs/AR-LAUNCH-READINESS-NOW.md`

### Inbox compose (more detail)

- `POST /api/sms/send` — `src/app/api/sms/send/route.ts` → `sendQuickSms`
- Campaign test modal uses the same endpoint (no special mock path)
- Flow checklist: `docs/MASS_TEXTING_GLUE_FLOWS.md` (items 106–136)

---

## Campaign service tabs (nav)

| Tab | Route |
|-----|--------|
| All Campaigns | `/campaigns` |
| Drafts | `/campaigns/drafts` |
| Scheduled | `/campaigns/scheduled` |
| Completed | `/campaigns/completed` |
| Templates | `/templates` |
| Analytics | `/sms/analytics` |

---

## Bottom line

| Question | Answer |
|----------|--------|
| Is `/campaigns/new/review` real? | **Yes** — tied to `launch-review` and honest `canSend` / `blockReason`. |
| Will it text from review alone? | **No** — must **launch** (and workers must run). |
| “Numbers + audience + send” for broadcast? | **Yes** when Mass Texting entitled, A2P/sender ready, credits OK, eligible audience, workers up. |
| Best single-message proof? | **Test send** on compose → `/api/sms/send`. |
| Whole Business Messaging nav? | **Mostly real backends**; weakest/gated: **recurring broadcast**, **MMS in prod**, **broadcast vs `/api/campaigns` sequences**, **V1 live cert gaps** (MCTB/Fax; AR live SMS sign-off separate). |

---

## Related docs

- `docs/MASS_TEXTING_GLUE_FLOWS.md` — glue files and user journeys
- `docs/BUSINESS-MESSAGING-ROUTE-MATRIX.md` — routes and service tabs
- `docs/V1-PRODUCTION-CERTIFICATION.md` — MCTB/Fax launch gates
- `docs/AR-LAUNCH-READINESS-NOW.md` — Appointment Reminders launch bar
- `AGENTS.md` — Mass Texting ↔ MCTB architecture boundary

*Generated for copy/paste from Cloud Agent functional audit (2026-10-14).*
