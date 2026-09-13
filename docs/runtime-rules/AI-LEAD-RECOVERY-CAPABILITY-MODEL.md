# AI Lead Recovery — capability-driven model

## Product rule

**AI Lead Recovery is capability-driven, not booking-driven.**

Booking (`AI_BOOK`, `SEND_BOOKING_LINK`) is one action among many. The product is configured by **enabled capabilities** (scenarios/intents), each with its own **handling policy**.

## Intent vs policy (never merge)

| Layer | Responsibility |
|-------|----------------|
| **Intent agent** | Classify what the caller wants (`StructuredLeadIntent`) |
| **Policy engine** | Apply **saved business policy** for that intent |
| **Action runtime** | Execute permitted actions via registry + adapters |

`intent = EMERGENCY_OR_URGENT` does **not** imply SMS, booking, or on-call routing. Those actions appear only if the workspace policy lists them in `intentPolicies.EMERGENCY_OR_URGENT.actions` (or fallback).

## Example policies (configuration, not code defaults)

| Intent / scenario | Typical policy (business-defined) |
|-------------------|-----------------------------------|
| General inquiry | Collect reason → owner summary |
| Booking | Booking link **or** AI availability + book |
| Emergency | Collect configured fields → SMS/email/escalate per policy |
| Callback request | Collect callback details → notify business |
| Pricing / estimate | Approved info only **or** collect + escalate |
| Existing customer | Collect issue → route/notify per policy |
| Payment | Text-to-Pay only when enabled + authoritative amount |
| Unknown | Clarify once → message capture / human notification |

## UI rule

Only expose editors for **enabled scenarios** on `/mctb/ai-lead-recovery`. Provider rows (Microsoft/Calendly targets, Stripe) appear only when an enabled policy uses that capability (e.g. `AI_BOOK`, Text-to-Pay).

## Integrations vs Lead Recovery

- **Integrations** — connect Microsoft, Calendly, Stripe accounts.
- **AI Lead Recovery** — when to use those connections, targets, and business rules.

No Calendar/Appointments/Booking Setup product shell.

## Legacy John

Customer **John** is SMS fallback only when Lead Recovery does not handle a turn. `john-policy-guard.ts` blocks John from overriding LR policy — it is **not** wired into the Lead Recovery runtime path.
