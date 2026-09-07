# Appointments + MCTB — Master Certification Matrix

**Generated:** 2026-09-07  
**Prerequisite:** `docs/APPOINTMENTS-MCTB-SOURCE-DRIVEN-INVENTORY.md`  
**Staged runner:** `npx tsx scripts/run-appointments-mctb-cert-staged.ts`

## Rules

- One row per **meaningful** feature, action, workflow, AI behavior, or cross-product interaction.
- Every row has a **Test ID**. Rows without automated tests use `BLOCKED` or `MANUAL` execution type.
- **Do not** certify from memory-only checklists.
- Live PSTN / real meeting bot / provider TFV approval → `BLOCKED — manual verification required`

### Execution types

| Type | Meaning |
|------|---------|
| `AUTO` | Run via staged script or named npm script |
| `MANUAL` | Human verification with documented steps |
| `BLOCKED` | Requires live external system (PSTN, Telnyx console, Stripe live, etc.) |
| `UI` | Browser walkthrough — not run in crash-safe batch (deferred) |

---

## Step 6 — Master matrix

### Appointments — engine & nav

| Test ID | Feature / workflow | Type | Command / procedure | Status |
|---------|-------------------|------|---------------------|--------|
| APT-ENG-001 | Availability engine slot generation | AUTO | `test-availability-engine.ts` | pending |
| APT-ENG-002 | Booking protection / fraud heuristics | AUTO | `test-booking-protection.ts` | pending |
| APT-ENG-003 | Reminder state metadata keys | AUTO | `test-appointments-reminder-state.ts` | pending |
| APT-ENG-004 | Double-booking concurrency | AUTO | `test-appointments-double-booking.ts` | pending |
| APT-ENG-005 | Tenant isolation | AUTO | `test-appointments-tenant-isolation.ts` | pending |
| APT-NAV-001 | Appointments nav active states | AUTO | `test-appointments-nav.ts` | pending |

### Appointments — operational UI actions

| Test ID | Action | Type | Procedure | Status |
|---------|--------|------|-----------|--------|
| APT-OP-001 | Overview retry on error | UI | Load `/appointments/overview` error state | deferred |
| APT-OP-002 | Setup health deep links | UI | Click each setup link | deferred |
| APT-OP-003 | KPI drilldown navigation | UI | Click KPI → target route | deferred |
| APT-OP-010 | Staff create appointment | AUTO | POST via API / new page flow | partial |
| APT-OP-011 | Open appointment detail | UI | List → detail | deferred |
| APT-OP-012 | List filter persistence | UI | Apply filters, refresh | deferred |
| APT-OP-013 | Calendar reschedule | UI | Drag event if enabled | deferred |
| APT-OP-020 | Confirm / cancel / reschedule lifecycle | AUTO | public token scripts + API | partial |
| APT-OP-021 | Internal notes persist | UI | Save note on detail | deferred |

### Appointments — public booking

| Test ID | Workflow | Type | Command | Status |
|---------|----------|------|---------|--------|
| APT-PUB-001 | Public book idempotency | AUTO | `test-book-idempotency.ts` | pending |
| APT-PUB-002 | OTP verification path | MANUAL | Book with OTP enabled workspace | blocked |
| APT-PUB-003 | Payment checkout | AUTO | `test-merchant-payments.ts` | pending |
| APT-PUB-004 | Waitlist accept token | MANUAL | waitlist notify → accept URL | blocked |
| APT-PUB-005 | Public routing form submit | MANUAL | `/routing/[slug]/[formSlug]` | blocked |
| APT-PUB-006 | Team page book | MANUAL | `/team/[slug]/[pageSlug]` | blocked |

### Appointments — automations

| Test ID | Feature | Type | Command | Status |
|---------|---------|------|---------|--------|
| APT-AUT-001 | Reminder sequences config + scan | AUTO | reminder-state + workflow hardening | pending |
| APT-AUT-002 | Send test reminder | MANUAL | POST `/api/appointments/reminders/test` | blocked |
| APT-AUT-003 | Workflow engine hardening | AUTO | `test-appointment-workflows-hardening.ts` | pending |
| APT-AUT-004 | Workflow scheduling triggers | AUTO | `test-appointment-workflows-scheduling.ts` | pending |
| APT-AUT-005 | Workflow minute-level timing | AUTO | `test-appointment-workflow-minutes.ts` | pending |
| APT-AUT-006 | Voice reminder templates | AUTO | `test-appointment-voice-reminders.ts` | pending |
| APT-AUT-010 | Per-appointment reminder timeline | UI | Detail → timeline panel | deferred |

### Appointments — integrations

| Test ID | Feature | Type | Command | Status |
|---------|---------|------|---------|--------|
| APT-INT-001 | Merchant payments Stripe/Square | AUTO | `test-merchant-payments.ts` | pending |
| APT-INT-002 | Google/Microsoft calendar OAuth | MANUAL | Connect in `/integrations/calendars` | blocked |
| APT-INT-003 | Calendly adapter sync | MANUAL | External calendar webhook | blocked |

### Appointments — analytics

| Test ID | Feature | Type | Procedure | Status |
|---------|---------|------|-----------|--------|
| APT-AN-001 | Analytics overview load | UI | `/appointments/analytics` | deferred |
| APT-AN-002 | PDF/CSV export | MANUAL | export API + download | blocked |

### Appointments — AI scheduling

| Test ID | AI behavior | Type | Command | Status |
|---------|-------------|------|---------|--------|
| AI-APT-001 | Understanding + fallback | AUTO | `test-appointment-ai-hardening.ts` | pending |
| AI-APT-002 | Write verifier blocks unsafe mutations | AUTO | AI hardening | pending |
| AI-APT-003 | Inbound SMS appointment AI priority | AUTO | `test-appointment-booking-agent-layer.ts` | pending |
| AI-APT-010 | Public book AI chat | MANUAL | `/api/public/book/[slug]/ai` | blocked |

### Appointments — AI notetaker & meetings (**required**)

| Test ID | AI behavior | Type | Command | Status |
|---------|-------------|------|---------|--------|
| AI-MTG-001 | Notetaker settings wiring | AUTO | `test-voice-notetaker-wiring.ts` | pending |
| AI-MTG-002 | Join rules persist | UI | `/settings/ai-notetaker` save | deferred |
| AI-MTG-003 | Summary template selection | UI | settings page | deferred |
| AI-MTG-010 | Enable notetaker on appointment | MANUAL | `certify-appointment-stack-live.ts` | blocked |
| AI-MTG-011 | View recap on appointment detail | UI | `NotetakerPanel` | deferred |
| AI-MTG-012 | Video host provisioning | AUTO | `test-transovo-video-wiring.ts` | pending |
| AI-MTG-020 | Meeting recap list/detail | UI | `/meetings/[id]` | deferred |
| AI-MTG-021 | Share recap token | MANUAL | `/recap/[token]` | blocked |
| AI-MTG-022 | Complete action item | UI | recap detail | deferred |
| AI-MTG-030 | Video recording → process job | MANUAL | Telnyx video webhook | blocked |

### MCTB — operational

| Test ID | Feature | Type | Procedure | Status |
|---------|---------|------|-----------|--------|
| MCTB-OP-001 | Overview setup CTA | UI | `/mctb` incomplete setup | deferred |
| MCTB-OP-002 | Needs attention deep links | UI | overview cards | deferred |
| MCTB-OP-010 | Missed calls list filters | AUTO | `test-mctb-missed-calls-filters.ts` | not in staged |
| MCTB-OP-011 | Call back action | UI | tel link on row | deferred |
| MCTB-OP-012 | Open conversation from missed call | UI | cross-link | deferred |
| MCTB-OP-020 | Inbox MCTB product filter | AUTO | `test-mctb-inbox-product-filter.ts` | not in staged |
| MCTB-VM-001 | Voicemail entitlements | AUTO | `test-mctb-voicemail-entitlements.ts` | pending |

### MCTB — setup actions

| Test ID | Setup section | Type | Procedure | Status |
|---------|---------------|------|-----------|--------|
| MCTB-SET-001 | Phone & forwarding save + verify | MANUAL | live-test API | blocked |
| MCTB-SET-002 | Missed-call rules toggles | AUTO | setup API tests | partial |
| MCTB-SET-003 | Consent mode press_1 / existing_consent | AUTO | `test-mctb-consent-modes.ts` | pending |
| MCTB-SET-004 | Text-back templates | AUTO | setup save tests | partial |
| MCTB-SET-005 | Recovery pause/resume | AUTO | `test-mctb-schedule-pause.ts` | pending |
| MCTB-SET-006 | Exclusions CRUD | AUTO | exclusions API tests | partial |
| MCTB-SET-007 | Test & Try It checkpoints | MANUAL | `/mctb/setup/test` | blocked |

### MCTB — runtime / voice / SMS

| Test ID | Workflow | Type | Command | Status |
|---------|----------|------|---------|--------|
| MCTB-RT-001 | Frozen TeXML press_1 contract | AUTO | `test-mctb-final-pipeline-contract.ts` | pending |
| MCTB-RT-002 | Frozen TeXML existing_consent contract | AUTO | pipeline contract | pending |
| MCTB-RT-003 | Missed call → eligibility → send architecture | AUTO | `test-missed-call-text-back-architecture.ts` | pending |
| MCTB-RT-004 | STOP opt-out suppresses customer SMS | MANUAL | inbound STOP webhook | blocked |
| MCTB-RT-005 | Pause recovery (no texts while paused) | AUTO | `test-mctb-schedule-pause.ts` | pending |
| MCTB-RT-006 | Repeat caller cooldown | AUTO | engine matrix / repeat-caller tests | partial |
| MCTB-RT-007 | TFV / sender readiness gates | AUTO | `test-mctb-tfv-gates.ts` | not in staged |
| MCTB-RT-010 | **Live press_1 PSTN call** | BLOCKED | Real phone call | blocked |
| MCTB-RT-011 | **Live existing_consent PSTN call** | BLOCKED | Real phone call | blocked |
| MCTB-RT-012 | **Live inbound/outbound SMS** | BLOCKED | Real SMS | blocked |

### MCTB — handoff & notifications

| Test ID | Behavior | Type | Command | Status |
|---------|----------|------|---------|--------|
| MCTB-HO-001 | notify_only mode | AUTO | `test-mctb-handoff.ts` | pending |
| MCTB-HO-002 | guided_collection mode | AUTO | handoff test | pending |
| MCTB-HO-003 | immediate_handoff + urgency | AUTO | handoff test | pending |
| MCTB-HO-004 | Team notification templates | AUTO | handoff test | pending |
| MCTB-HO-005 | Routing matrix + quiet hours | AUTO | handoff test | partial |
| MCTB-HO-006 | Idempotent notification delivery | AUTO | handoff test | pending |
| MCTB-HO-007 | Send test notification (setup UI) | MANUAL | setup notifications test button | blocked |
| MCTB-HO-008 | Preview renderers | UI | setup preview tabs | deferred |
| MCTB-HO-010 | Missed call detail handoff section | UI | detail page | deferred |
| MCTB-HO-020 | Human takeover stops AI | AUTO | handoff + john-preprod | pending |
| MCTB-HO-021 | Resume automation safe path | AUTO | handoff actions | pending |
| MCTB-HO-022 | Follow-up status (called back / resolved) | UI | conversation panel | deferred |

### MCTB — AI (John)

| Test ID | AI behavior | Type | Command | Status |
|---------|-------------|------|---------|--------|
| AI-MCTB-001 | Customer SMS LLM loop | AUTO | `npm run test:john-preprod` | pending |
| AI-MCTB-002 | Runtime gateway authoritative | AUTO | john-preprod | pending |
| AI-MCTB-003 | Owner settings LLM | AUTO | john-preprod OWNER_CONTROL | pending |
| AI-MCTB-004 | Workflow architect draft | AUTO | john-preprod WORKFLOW_ARCHITECT | pending |
| AI-MCTB-005 | Call classification (no LLM) | AUTO | john-preprod CALL_DETECTION | pending |

### MCTB — voicemail AI

| Test ID | AI behavior | Type | Command | Status |
|---------|-------------|------|---------|--------|
| AI-VM-001 | Deepgram transcription job | AUTO | `npm run test:ai-transcription` | pending |
| AI-VM-002 | OpenAI voicemail summary | AUTO | ai-transcription | pending |
| AI-VM-003 | Transcript translation | AUTO | `test-transovo-voicemail.ts` | not in staged |

### Cross-product

| Test ID | Interaction | Type | Procedure | Status |
|---------|-------------|------|-----------|--------|
| X-001 | MCTB thread → Transovo booking attribution | MANUAL | book from MCTB context | blocked |
| X-002 | Shared contact across appt + MCTB | AUTO | tenant isolation | partial |
| X-003 | Appointment AI before John on shared number | AUTO | booking-agent-layer | pending |

### Legacy MCTB provider matrix (live)

Existing `scripts/mctb-launch-readiness-matrix.ts` IDs **A-01 through T-*** remain authoritative for **Twilio TFV, forwarding ANI, live SMS, trial conversion**. Cross-reference:

| Cert pass | Matrix IDs | Type |
|-----------|------------|------|
| Pass 1 TFV | A-02, A-05, A-06, B-01, B-02, B-06 | BLOCKED |
| Pass 2 Forwarding | C-06, D-01, D-02, T-04 | BLOCKED |
| Pass 3 Press-1/SMS | CP-11–CP-18, F-03 | BLOCKED |
| Pass 4 Trial/billing | UI-02, trial conversion rows | BLOCKED |

---

## Step 7 — Coverage proof

| Feature domain | UI covered | API covered | Persistence covered | Runtime covered | Error path covered | Test IDs |
|----------------|------------|-------------|---------------------|-----------------|-------------------|----------|
| Appointments engine | partial | yes | yes | yes | partial | APT-ENG-001–005 |
| Appointments operational UI | deferred | yes | yes | yes | deferred | APT-OP-* |
| Public booking | deferred | yes | yes | yes | partial | APT-PUB-001–006 |
| Reminders & workflows | deferred | yes | yes | yes | partial | APT-AUT-* |
| Merchant payments | deferred | yes | yes | yes | partial | APT-INT-001 |
| Analytics | deferred | yes | yes | n/a | deferred | APT-AN-* |
| **AI scheduling** | deferred | yes | yes | yes | yes | AI-APT-* |
| **AI notetaker / meetings** | deferred | yes | yes | yes | partial | AI-MTG-* |
| **Transovo Video** | deferred | yes | yes | yes | partial | AI-MTG-012, 030 |
| MCTB TeXML voice | n/a | yes | yes | yes | partial | MCTB-RT-001–002, 010–011 |
| MCTB SMS recovery | deferred | yes | yes | yes | partial | MCTB-RT-003–007, 012 |
| MCTB operational UI | deferred | yes | yes | yes | deferred | MCTB-OP-* |
| MCTB setup | partial | yes | yes | yes | partial | MCTB-SET-* |
| **MCTB handoff/notifications** | partial | yes | yes | yes | partial | MCTB-HO-* |
| MCTB John AI | deferred | yes | yes | yes | yes | AI-MCTB-* |
| MCTB voicemail AI | partial | yes | yes | yes | yes | AI-VM-* |
| Cross-product | deferred | partial | yes | partial | deferred | X-* |
| Provider live (TFV/PSTN) | n/a | partial | yes | BLOCKED | partial | mctb-launch-readiness A–T |

### Coverage gaps requiring matrix expansion before claiming complete

1. **UI/browser certification** — all `UI` / `deferred` rows need `appointments-frontend-certify-*.ts` or manual browser pass.
2. **MCTB setup links page** — no route; add feature + test ID when built.
3. **Handoff Home/Detail/Analytics UI** — code partial; add UI test IDs when wired.
4. **MCTB → Calendar attribution** — add AUTO test when booking hook lands.
5. **Live provider rows** — remain BLOCKED until PSTN/SMS/TFV manual proof.

---

## Step 8 — Staged automated execution

```bash
# List batches
npx tsx scripts/run-appointments-mctb-cert-staged.ts --list

# Run all automated batches (serial, checkpointed)
npx tsx scripts/run-appointments-mctb-cert-staged.ts

# Resume after failure
npx tsx scripts/run-appointments-mctb-cert-staged.ts --from <index>
```

**Constraints honored:** one command at a time, bounded timeout, checkpoint at `docs/.generated/appointments-mctb-cert-checkpoint.json`, no dev server, no browser, no production build, no PSTN.

**Results:** `docs/.generated/appointments-mctb-cert-results.json`

---

## Completion rule

Certification coverage is **not complete** until:

1. Every feature in the source inventory maps to ≥1 Test ID in this matrix.
2. All `AUTO` rows have been executed or explicitly failed with remediation tracked.
3. All `BLOCKED` rows are documented with owner + evidence path.
4. All customer-facing actions in Step 2 have a test ID (UI rows may remain deferred but must exist).

**Current state after inventory generation:** matrix complete for discovered features; automated batch execution pending (see results JSON).
