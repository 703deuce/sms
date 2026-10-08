# AR / MCTB SMS product isolation — implementation report

**Branch:** `cursor/ar-ai-rescheduler-implement-f350`  
**Commits:** `1d87255a`, `0997ad78`, final corrections on same branch (see git log)  
**PR:** [#616](https://github.com/703deuce/sms/pull/616)  
**Status:** Do not merge or deploy without explicit approval.

---

## What changed (correction applied)

The earlier approach (recent outbound, `ar:` idempotency prefixes, “Reply C” body matching, **MCTB fallback**) is **removed**.

### MCTB preservation

- **Restored:** Telnyx/Twilio platform ingress no longer runs AR inside `mctb_process_inbound_sms` (AR block removed from `process-inbound-sms-job.ts`).
- **Unchanged:** MCTB platform assignment + legacy MCTB resolution when **no** competing AR reply session exists (`handleMctbPlatformSenderInboundCore` logic preserved via dispatcher → `acceptMctbInboundSmsIngress`).
- **Still excluded:** Appointment reminder rows with `idempotencyKey` starting with `ar:` from MCTB platform **evidence** queries (so AR sends do not look like MCTB threads).

### AR: outbound-initiated ownership

New table/model **`ArSmsReplySession`** (migration `prisma/migrations/20261008130000_ar_sms_reply_session/`):

- Product/workspace/contact/**appointment**
- **Calendar identity** at send time: `calendarConnectionId`, `providerEventId`, `providerCalendarId`, `calendarProvider` (from `providerRefFromAppointment` on the appointment row — not inferred from phone)
- Platform **sender** + provider, consumer E.164, lifecycle, reply window, outbound message IDs
- Conversations tagged **`APPOINTMENT_REMINDERS`** (enum extended)

Platform reminder sends use `sendArReminderSmsWithSession()` → sender pool → atomic `claimArReplySessionForOutbound()` → send → attach provider/message proof.

### Inbound dispatch (deterministic)

Entry: `resolvePlatformInboundDestination()` → `dispatchSharedPlatformSmsInbound()` (`src/lib/messaging/platform-sms-inbound-dispatch.ts`).

| Situation | Behavior |
|-----------|----------|
| Exactly **one** active, reply-eligible **`ArSmsReplySession`** for `(consumer, destination sender)` | → `ar_process_inbound_sms` (never MCTB) |
| Exactly **one** active **`MctbPlatformSenderAssignment`** for same pair | → existing MCTB ingress/job |
| **Both** active | → **hold** (`ArSmsInboundHeldMessage` + `ar_inbound_held` audit job); **no** auto-route |
| Multiple AR or multiple MCTB active | → **ambiguous** (durable hold; no guess) |
| Neither active | → **MCTB-only** legacy resolution (unchanged MCTB behavior; AR does not run) |

C/R/X and follow-up on the AR path use **`explicitAppointmentId` + `replySessionId`** from the session (not “next upcoming appointment” on platform inbound).

### Two-sender AR strategy

`ar-platform-sender-pool.ts`: eligible platform senders (authorized for outbound), Telnyx preferred, preserved Twilio secondary; skip senders occupied by **active AR sessions or active MCTB platform assignments** for that consumer (`findOccupiedPlatformSenderIdsForConsumer` uses the same MCTB assignment semantics as inbound dispatch); reuse sender for the **same** appointment; collision at claim time if MCTB assignment races AR send → blocked/pending; inbound hold remains backstop when MCTB legacy path cannot share an atomic reservation.

### Where “booking through text” lives (unchanged product boundary)

**Appointment Reminders AI / reschedule** remains in:

- `src/lib/appointments/ai-scheduling/`
- `src/lib/appointment-reminders/ai-rescheduler/` (provider mutations, Microsoft/Google paths, durable ops)

It is **not** MCTB lead recovery. Platform inbound now reaches it only via **`ar_process_inbound_sms`** → `handle-inbound-body` → `inbound-replies` / **`messaging/inbound-follow-up`** (session-bound, `lockedAppointmentId` on `handleAppointmentAIRequest`).

MCTB AI booking/lead recovery stays under **`src/lib/agents/missed-call-text-back/`** and MCTB jobs only.

---

## How Telnyx resolves MCTB versus AR

1. `handleTelnyxInbound` → `resolvePlatformInboundDestination(parsed.to)` (shared platform TFN: canonical Telnyx and/or preserved Twilio).
2. If destination is a platform sender → `dispatchSharedPlatformSmsInbound()`.
3. Compliance (STOP/HELP) runs once at platform boundary.
4. Load **active AR reply sessions** and **active MCTB platform assignments** for `(from consumer, to platform phoneNumberId)`.
5. Route per table above — **no** recency, body text, or MCTB fallback when AR context exists ambiguously.

Twilio platform path: `tryHandleTwilioMctbPlatformSenderInbound` → same dispatcher.

---

## How each product resolves workspace ownership

| Product | Workspace resolution |
|---------|----------------------|
| **MCTB** | `MctbPlatformSenderAssignment` and/or legacy `resolvePlatformMctbInboundReplyWithAssignment` (unchanged semantics). |
| **AR** | `ArSmsReplySession.workspaceId` created at outbound send; inbound job validates `session.workspaceId` + `appointmentId` + `contactId`. |

Never derived from customer phone alone for AR platform inbound.

---

## How shared platform sender numbers are handled

- Same physical number may carry both products’ traffic.
- Routing uses **persisted active context** on that number pair:
  - AR: `ArSmsReplySession` (reply-eligible lifecycle)
  - MCTB: `MctbPlatformSenderAssignment` (ACTIVE)
- If both are active for the same consumer + sender → **hold**, not MCTB.

---

## How ambiguous conversations are prevented from crossing products

- More than one AR session or more than one MCTB assignment → `ambiguous_platform_reply`.
- One AR + one MCTB active → `ambiguous_cross_product_reply` + `ar_inbound_held` job (audit payload).
- AR outbound sender collision → no send; reminder marked blocked with reason.
- MCTB worker does not import or call AR handlers.

---

## How AR resolves exact appointment and calendar connection

At **outbound** (`claimArReplySessionForOutbound`):

1. Load `voiceAppointment` scoped to `workspaceId` + `contactId` + `appointmentId`.
2. `providerRefFromAppointment()` → connection ID, provider event ID, calendar ID, provider (`google` | `microsoft`).
3. Persist on `ArSmsReplySession`.

At **inbound** (`processArInboundSmsJob`):

1. Require `replySessionId` + `appointmentId` in job payload.
2. Verify session matches workspace/contact/appointment.
3. `handleArReminderLetterReply` uses `explicitAppointmentId` from session (not phone-based “next appointment” on platform path).

---

## §15 — Required final report

### 1. MCTB preservation

- **Prior AR work removed from MCTB worker**; shared webhook uses dispatcher, not a merged router with recency/MCTB fallback.
- **Press-1, CFNA, consent, assignments, legacy MCTB resolution** not rewritten.
- **Risk to retest manually:** any environment that relied on the interim “AR inside MCTB job” hack must use session + dispatch.

### 2. AR implementation

- **Outbound:** `outbound-reminder.ts`, `reply-session.ts`, `send-via-assigned-sender.ts`
- **Inbound:** `inbound-sms-ingress.ts`, `process-inbound-sms-job.ts`, `send-customer-sms-job.ts`
- **Jobs:** `ar_process_inbound_sms`, `ar_send_customer_sms`, `ar_inbound_held` (links to durable `ArSmsInboundHeldMessage`)
- **Held ops UI:** `/appointment-reminders/held-inbound` + APIs under `/api/appointment-reminders/held-inbound`

### 3. Product isolation (same workspace, both products)

Separate **`ArSmsReplySession`** vs **`MctbPlatformSenderAssignment`**, separate conversations (`APPOINTMENT_REMINDERS` vs `MCTB`), separate job types. Cross-product dual-active → hold.

### 4. Workspace/user isolation

Sessions and jobs carry **`workspaceId`**; inbound worker validates session ↔ appointment ↔ contact. Existing API auth unchanged.

### 5. Collision handling

- AR vs AR on same sender → send blocked / pending reason
- AR vs MCTB same pair → inbound held
- Config: `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS`, `AR_SMS_REPLY_ELIGIBLE_DAYS`

### 6. Shared sender (Telnyx/Twilio)

Both products may share numbers; routing uses **active session/assignment**, not product label on the number alone.

### 7. Database

- Migrations **`20261008130000_ar_sms_reply_session`**, **`20261008140000_ar_sms_inbound_held`**
- Enums: `ConversationProductSource.APPOINTMENT_REMINDERS`, `ArSmsReplySessionState`, `ArSmsInboundHeldState`
- Model: `ArSmsInboundHeldMessage`
- **Deploy prerequisite:** `prisma migrate deploy` before traffic

### 8. Changed files (concise)

| Area | Files |
|------|--------|
| Schema | `prisma/schema.prisma`, `prisma/migrations/20261008130000_ar_sms_reply_session/` |
| Dispatch | `src/lib/messaging/platform-inbound-destination.ts`, `src/lib/messaging/platform-sms-inbound-dispatch.ts`, `src/lib/messaging/telnyx/webhook-handlers.ts`, `src/lib/mctb/messaging/twilio-platform-inbound.ts` |
| AR messaging | `src/lib/appointment-reminders/messaging/*` |
| Reminders send | `src/lib/appointments/reminder-delivery.ts` (platform path → session send) |
| MCTB | `src/lib/mctb/messaging/process-inbound-sms-job.ts`, `src/lib/mctb/messaging/platform-inbound-tenant-resolution.ts` |
| Jobs | `src/lib/jobs/job-handlers.ts`, `src/lib/jobs/job-priority.ts` |
| Removed | `src/lib/messaging/platform-toll-free-inbound.ts`, guess-based AR `platform-inbound-tenant-resolution` |

### 9. Final audit (code-path, not runtime-tested)

| Scenario | Status | Enforcement |
|----------|--------|-------------|
| Workspace A uses MCTB only | **PASS** | No AR session → MCTB path only |
| Workspace B uses AR only | **PASS** (platform sender) | Session required for platform inbound |
| Workspace C uses both | **PASS** | Dual active → hold; separate stores |
| Two AR businesses, same customer | **PASS** (if pool has 2 senders) | Sender pool + collision |
| Both senders occupied | **GAP** | Pending/blocked send; no third sender |
| MCTB + AR same customer, same sender, both active | **PASS** | Cross-product hold |
| AR reply R | **PASS** | Session-bound `appointmentId` |
| MCTB customer replies | **PASS** | MCTB assignment/legacy only |
| Late AR reply vs newer appointment | **PASS** (platform path) | `verifyArReplySessionForInboundTurn` + `lockedAppointmentId` on every AI turn |
| Duplicate webhook | **PASS** | Idempotency keys per product ingress |
| AR disabled / MCTB disabled | **CONFIG** | Entitlements not changed in this PR |
| Clarification SMS on ambiguous | **GAP** | Durable hold + staff dismiss/route AR; no auto clarification SMS |
| Staff approve/reject + reconciliation UI | **PASS** (baseline) | Appointments drawer + AI Rescheduler pending ops panel + reconcile API |
| AR outbound avoids MCTB sender collision | **PASS** | `findOccupiedPlatformSenderIdsForConsumer` before send |
| Non-platform AR (workspace line) | **GAP** | Session model on **platform** reminder path in `reminder-delivery` only |

### 10. Remaining manual testing (owner)

1. Run migration on staging.
2. Send platform AR reminder → confirm `ar_sms_reply_sessions` row with calendar IDs.
3. Reply **R** → must **not** hit MCTB lead recovery; must use AR thread.
4. Same customer: active MCTB assignment + active AR session on same TFN → inbound should **not** route to either product (held).
5. MCTB-only smoke unchanged.

---

## Remaining gaps (post-correction)

1. Approved clarification SMS for held cross-product inbound (intentionally deferred).
2. Non-platform AR (workspace-owned reminder numbers) still outside `ArSmsReplySession` outbound path.
3. Concurrent MCTB assignment + AR send on same sender may still race; inbound hold + send-time MCTB check reduce but do not eliminate legacy MCTB non-transactional claim paths.
4. Configure `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS` when more than auto-discovered platform rows exist.
5. **Runtime verification not performed** in this pass (per instruction).

---

## Environment configuration

| Variable | Purpose |
|----------|---------|
| `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS` | Comma-separated `PhoneNumber.id` values eligible for AR (optional; defaults to discovered platform senders) |
| `AR_SMS_REPLY_ELIGIBLE_DAYS` | Reply window for session eligibility (default `21`) |

**Telnyx + Twilio for AR:** Both must be present as **Active** platform sender `PhoneNumber` rows (Telnyx primary, preserved Twilio secondary per `ar-platform-sender-pool.ts`), each **authorized for outbound SMS** (`isPhoneAuthorizedForOutboundSms`). Restrict with `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS` when multiple platform numbers exist. MCTB uses the same physical numbers; AR allocation skips senders with active MCTB assignments for that consumer.

---

*Generated for copy/paste from Cloud Agent implementation pass. Not a deploy authorization.*
