# Appointment Reminders — Dynamic shared platform sender assignment

**Locked architecture for free-plan AR:** businesses share platform numbers until a **customer overlap** forces another sender.

## Core invariant (non-negotiable)

```
(consumer E.164, platform sender phone number id) → exactly one workspaceId
```

Database: `ar_sms_consumer_platform_sender_assignments` with:

- `@@unique([consumerE164, platformPhoneNumberId])` — one business per customer+sender pair (inbound `To` + `From` resolves workspace).
- `@@unique([consumerE164, workspaceId])` — one stable sender per business+customer (no thread hopping).

Assignments are **durable** — not released when an appointment cancels (late “book again?” texts must still route).

## Outbound reminder flow

1. `selectArOutboundPlatformSender` → `allocateArPlatformSenderForReminder`
2. **Materialize legacy reply-session pairs** for this customer into the assignment table (migration safety).
3. Reuse row for `(workspaceId, consumer)` if present and sender still authorized.
4. Else pick lowest-priority eligible Telnyx/Twilio platform sender **not** assigned to another workspace for this customer (assignments **and** legacy sessions).
5. Create assignment in a **transaction**; on conflict, **retry next sender** (do not report pool exhausted while candidates remain).
6. If assigned sender becomes unauthorized → **do not rotate** (`ar_assigned_sender_unavailable`); inbound still uses assignment/legacy owner.
7. If no conflict-free sender → **do not send** (`ar_sender_pool_exhausted`).

Legacy reply sessions without assignment rows are backfilled via `ensureArConsumerPlatformSenderAssignment` on reuse.

**Code:** `ar-consumer-platform-sender-assignment.ts`, `reply-session.ts`, `outbound-reminder.ts`.

## Inbound SMS flow

1. Webhook provides customer `From` + platform `To` (phone number id).
2. `resolveArWorkspaceIdFromConsumerPlatformSender` → workspace (when assignment exists).
3. Filter routable reply sessions to that workspace, then appointment disambiguation (`resolve-initiated-ar-inbound.ts`).
4. Agents run only after workspace + session verify.

Without assignment row (pre-migration traffic): fall back to session-based workspace grouping + hold on `ambiguous_workspace`.

## Provider registry

`listArEligiblePlatformSenders` returns candidates with `provider: telnyx | twilio`, priority, and `phoneNumberId`. Each number must pass `isPhoneAuthorizedForOutboundSms` for AR use case (A2P/10DLC per number).

Env: `AR_PLATFORM_SENDER_PHONE_NUMBER_IDS` (optional allowlist).

## Pool sizing

Limiting factor: max distinct **businesses on Transovo texting the same customer** at once — not total business count. Monitor assignment exhaustion (`ar_sender_pool_exhausted`) and expand pool.

## Related

- Routing safety audit: `docs/AR-SMS-SHARED-NUMBER-ROUTING-AUDIT.md`
- Migration: `prisma/migrations/20261008220000_ar_consumer_platform_sender_assignment`
