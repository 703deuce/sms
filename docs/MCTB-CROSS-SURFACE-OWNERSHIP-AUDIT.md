# MCTB Cross-Surface Ownership Audit

Mechanical review of product boundaries after IA lock (Conversations as bridge, Setup vs operate, shared Payments/Integrations, onboarding = Setup state). **No engine rewrites** — ownership, handoffs, and duplicate behavior only.

Audit date: 2026-09-13  
Branch baseline: `master` post MCTB UI + integrations consolidation.

---

## Ownership model (canonical)

| Domain | Owns | Canonical routes / APIs |
|--------|------|-------------------------|
| **MCTB runtime** | Missed-call detection, recovery SMS, consent, suppression | `MissedCallEvent`, `MissedCallTextConfig`, TeXML ingress, `/api/mctb/*` runtime |
| **Conversation** | Recovered customer thread (SMS inbox) | `Conversation`, `/conversations`, `/mctb/conversations` |
| **Booking** | Appointments, types, availability, reminders UI | `/api/appointments/*`, `/api/calendar/*`, `/mctb/calendar|appointments|booking|reminders` |
| **Payments** | Text-to-Pay `PaymentRequest` + merchant Connect checkout | `/api/payment-requests/*`, `/payments`, `MerchantPaymentConnection` |
| **Integrations** | Workspace provider connections (CRM, calendar OAuth, Stripe/Square Connect) | `/integrations`, `/api/integrations/*`, `/api/merchant-payments/*` |
| **MCTB Setup** | Configuration written to same stores onboarding uses | `/mctb/setup/*`, `POST/GET /api/mctb/setup` |
| **Onboarding** | First-time activation wizard (writes Setup state) | `/onboarding/mctb`, `/api/mctb/onboarding` |
| **MCTB Analytics** | MCTB funnel/recovery metrics only | `/mctb/analytics`, `/api/mctb/analytics` |
| **Numbers / A2P** | Contextual drawers (not nav product) | `MctbNumberDrawerHost`, `/api/mctb/numbers`, legacy `/mctb/numbers` → redirect |

---

## Principle-by-principle findings

### 1. Conversations as bridge (Book / link / pay)

| Check | Status | Evidence |
|-------|--------|----------|
| Canonical Conversation thread | **OK** | Inbox `Conversation` model; MCTB links use `/conversations?product=mctb&conversation=…` |
| Book / Send link in thread | **OK** | `MctbConversationBookingActions` in `conversations-thread-area.tsx` → `/mctb/appointments/new?conversationId=…` + `send_booking_link` |
| Request Payment in thread | **OK** | `ConversationPaymentActions` → `/api/payment-requests` (`createAndSendPaymentRequest`) |
| Shared engines (no MCTB-only payment table) | **OK** | Single `PaymentRequest` model; `sourceType` metadata (`conversation`, `mctb_conversation`, `standalone`) |
| Booking actions visibility | **PARTIAL** | Gated on `isAppointmentsV1Primary()` only — correct for launch shell; ensure non–V1-primary MCTB still gets actions if Conversations used |
| Attribution on new appointment | **GAP** | Query params `conversationId` / `missedCallId` on `/mctb/appointments/new` — **not verified wired** into appointment create payload / persistence |

### 2. Setup configures; operational pages operate

| Surface | Operational | Setup | Status |
|---------|-------------|-------|--------|
| Voicemail | `/mctb/voicemail` (inbox, greetings studio) | `/mctb/setup/voicemail` (`MctbVoicemailSetupSection`) | **PARTIAL** — Setup is greeting-focused; add explicit link to operational inbox (done in this pass) |
| Recovery | Missed calls list | `/mctb/setup/recovery` | **OK** |
| Phone / numbers | — | `/mctb/setup/phone` + drawers | **OK** |
| Analytics | `/mctb/analytics` | — | **OK** (no duplicate Setup analytics) |

### 3. Numbers / A2P contextual only

| Check | Status |
|-------|--------|
| Removed from MCTB sidebar | **OK** (`buildMctbV1Nav`) |
| Legacy `/mctb/numbers` | **OK** → redirect `setupPhone?open=manage` |
| Shared drawer | **OK** — `MctbNumberDrawerHost` used in onboarding + Phone & Forwarding |
| Standalone numbers page UI | **OK** (redirect only) |

### 4. Light booking (UI boundary)

| Check | Status |
|-------|--------|
| MCTB routes copy canonical UI | **OK** — `mctb-*-connected.tsx` from appointments features |
| Shared backends | **OK** — same `/api/appointments`, `/api/calendar/events` |
| Advanced scheduler hidden from MCTB nav | **OK** |
| Internal deep links still hit `/appointments/*` in some copied components | **GAP** — e.g. meetings workspace inner links; trim in follow-up (see `docs/MCTB-LIGHT-BOOKING-COPY-SOURCE-MAP.md`) |
| Packages/classes/resources in MCTB empty states | **VERIFY** — UI copy trim matrix; no automated guard |

### 5. Payments — one canonical service

| Check | Status |
|-------|--------|
| `PaymentRequest` engine | **OK** — `src/lib/payment-requests/*` |
| Stripe Connect reuse | **OK** — `getMerchantConnection`, shared webhook router |
| Appointment booking payments | **OK** — separate ledger `AppointmentMerchantPayment` (same Connect account, different product flow) |
| Legacy `PaymentLink` (platform Stripe) | **OK** — documented legacy; not used for Text-to-Pay |
| Duplicate “MCTB payment” model | **NONE** |

### 6. Integrations — workspace-level

| Provider | Canonical store | UI |
|----------|-----------------|-----|
| Microsoft / Google calendar | `CalendarConnection` + `/api/integrations/calendars` | `/integrations` platform cards |
| Stripe / Square merchant | `MerchantPaymentConnection` + `/api/merchant-payments/*` | `/integrations` platform cards |
| CRM / native (SF, Zoho, Calendly, WooCommerce, …) | `integrationConnection` + native routes | `ConnectableProvidersGrid` + `/integrations/native` |
| Stripe **platform billing** vs **Connect** | **RISK** | `integrations/page.tsx` stats still mix `workspace.stripeCustomerId` / env with merchant Connect — **directory “Stripe (billing)”** is intentionally separate; merchant Connect is canonical for Text-to-Pay |

### 7. Onboarding ↔ Setup same state

| Store | Role |
|-------|------|
| `workspace.customFieldsConfig.mctbOnboarding` | Wizard progress, trial number, TFV timestamps, business line |
| `MissedCallTextConfig` + solution save | Runtime phone, templates, triggers |
| `workspace.customFieldsConfig.mctb` | Schedule mode, business line mirror, consent flags |
| Setup GET | **OK** — loads `loadMctbOnboardingState` + runtime + solution |
| Setup PATCH | **OK** — updates runtime/solution **and** calls `saveMctbOnboardingState` for business line |

| Gap | Detail |
|-----|--------|
| Wizard-only fields | Funnel/demo session fields in onboarding JSON — acceptable; not duplicated in separate wizard DB |
| Dual write paths | Some fields only in onboarding until Setup save — **monitor** consent/message template parity in QA |

### 8. Analytics domain-specific

| Check | Status |
|-------|--------|
| MCTB analytics API scope | **OK** — `/api/mctb/analytics` (missed calls, recovery, suppression) |
| Appointment/payment KPIs on MCTB analytics page | **OK** — not merged in `mctb-analytics-view.tsx` |
| Cross-product attribution | **FUTURE** — `PaymentRequest.missedCallId`; appointment attribution **incomplete** |

### 9. Source / context relationships

| Entity | Fields | Status |
|--------|--------|--------|
| `PaymentRequest` | `conversationId`, `missedCallId`, `sourceType`, `appointmentId` | **OK** |
| `Conversation` | `missedCallEventId` | **OK** |
| Appointment create from conversation | metadata / `conversationId` on calendar row | **GAP** — not enforced in MCTB new appointment flow |

### 10. Upgrade gating at feature boundary

| Check | Status |
|-------|--------|
| MCTB recovery without booking | **OK** — no hard dependency in ingress |
| Booking nav without entitlement gate in code | **OK** — visible in nav; product entitlement layer **not audited here** |
| Payment request without Stripe | **OK** — UI blocks send; links to `/integrations?provider=stripe` |

---

## UNACCOUNTED_DUPLICATE_ENGINES

**0** — No second MCTB recovery engine, scheduling engine, or Stripe Connect stack found.

## VIOLATIONS_REQUIRING_FOLLOW_UP

1. **Appointment attribution** from Conversation → Book (query params → persist).
2. **Light-booking internal links** still pointing at full `/appointments/*` in a few copied surfaces.
3. **Integrations hub “Connected” count** may count platform billing Stripe separately from merchant Connect (presentation only).
4. **Setup Voicemail** vs **operational Voicemail** — clarify handoff (link added).

---

Run mechanical guard: `npx tsx scripts/test-cross-surface-ownership-audit.ts`
