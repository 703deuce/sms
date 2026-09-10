# Appointments Batch 8D-2 — Public Booking Residual Completion

**Date:** 2026-09-10  
**Branch:** `cursor/batch8d2-public-booking-709b`  
**Objective:** Close all 35 `V1_PUBLIC_UI_GAP` rows from post-8C ledger without redesigning public booking.

## Starting state (Batch 8C authority)

| Metric | Count |
|--------|------:|
| `V1_PUBLIC_UI_GAP` | **35** |
| Residual implementation rows (all types) | 145 |

## Ending state (mechanical reconciliation)

| Metric | Count |
|--------|------:|
| `V1_PUBLIC_UI_GAP` | **0** |
| Residual implementation rows | 110 |
| `V1_COMPLETE` | 149 (+35 from public batch) |

## Rows resolved (35)

All starting public-gap feature IDs:

`3-23`, `5-7`, `5-9`, `5-10`, `5-11`, `5-12`, `5-13`, `5-14`, `5-15`, `5-16`, `5-17`, `5-18`, `5-19`, `5-20`, `5-25`, `5-26`, `5-27`, `5-29`, `5-30`, `5-31`, `5-32`, `7-2`, `7-3`, `7-6`, `7-7`, `7-9`, `8-26`, `8-28`, `8-35`, `9-4`, `9-8`, `9-9`, `13-4`, `13-5`, `20-4`

- **Resolved to `V1_COMPLETE`:** 34  
- **Resolved to `V1_COMPLETE_RUNTIME_ONLY`:** 1 (`20-4` slot diagnostics API — customer API, not consumer UI)

## Implementation highlights

### Payments (P0)

- `PaymentSummary` + `payment-breakdown.ts` — free, pay later, deposit, full, pay-what-you-want copy
- Pay-what-you-want amount input in `InfoStep` + `payWhatYouWantCents` in book API
- `SquarePaymentStep` — deposit breakdown, payment failure recovery messaging
- Stripe redirect path preserved; deposit mode normalization in book POST

### Access / checkout

- Package, gift, wallet, loyalty, coupon, saved-card toggles wired in `InfoStep` (existing glue completed/documented)
- Entitlements lookup on phone verification unchanged — now ledger-complete

### Classes & events

- `/book/[slug]/classes` — capacity display modes, party size, waitlist join, instructor/location/price
- **New** `/book/[slug]/events` — workshop/event registration flow (single-occurrence / metadata.kind)
- `formatCapacityLabel` shared helper

### AI public booking

- `AiBookingStep` — confirmation panel before proceeding to info step
- **New** `/book/[slug]/ai-email` — public email scheduling form → `/api/public/book/[slug]/email-ai`
- Service step links to classes, events, store, email AI

### Other public flows

- **New** `/poll/[pollId]` — public meeting poll vote
- **New** `/pay/[linkId]` — canonical SMS/payment link customer page
- Single-use link validation (`validate_single_use` action) + customer-safe error messages
- Manage link residuals confirmed on `/manage/[token]` (reschedule, cancel, pay balance, intake, book again)

### Reconciliation

- `scripts/reconcile-appointments-batch8c.mjs` — Batch 8D-2 overrides for all 35 rows
- `routeExists()` recognizes `PUBLIC_BOOKING`, `/book/*`, `/manage/*`, `/poll/*`, `/pay/*`

## Static validation

- `npx tsc --noEmit` — no `src/` errors

## Explicitly not done (per batch scope)

- Master browser UAT / production certification
- Portal residuals (Batch 8D-3)
- Operations/admin residuals (Batch 8D-4)
- Route retirement

## Next

**Batch 8D-3** — close 12 `V1_PORTAL_UI_GAP` rows (saved-card add/remove, membership lifecycle self-service, household/dependent booking).
