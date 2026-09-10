# Page Blueprint — Memberships (Batch 8B-2)

**Route:** `/appointments/memberships`  
**Primary user job:** Charge customers regularly and give recurring booking benefits.

## Structure

General · Billing · Benefits · Membership lifecycle · Members table with pause/resume/cancel

## Backends

- `memberships.ts` — products, subscribe
- `membership-lifecycle.ts` — pause, resume, cancel, past_due
- `MembershipBenefits` in product `benefits`
- `metadata.lifecycle` for cancellation and failed-payment policy UI

## Status

ABSORBED_CANONICAL_UI for core admin. Stripe recurring billing UI informational only where provider path incomplete.
