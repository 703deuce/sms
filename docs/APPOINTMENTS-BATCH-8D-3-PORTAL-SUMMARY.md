# Batch 8D-3 — Customer Portal Residual Completion

**Date:** 2026-09-10  
**Branch:** `cursor/batch8d3-portal-residual-709b`  
**Base:** Batch 8D-2 post-absorption ledger

## Portal gap summary

| Metric | Value |
|--------|-------|
| Starting `V1_PORTAL_UI_GAP` | 12 |
| Ending `V1_PORTAL_UI_GAP` | **0** |
| Rows resolved | 12 |
| Reclassified | 0 |
| Residual queue rows removed | 12 |

### Starting rows (all closed)

| ID | Feature | Resolution |
|----|---------|------------|
| 7-4 | Recurring series cancel scopes | Manage link recurring cancel dialog + portal manage links |
| 7-5 | Recurring series reschedule scopes | Manage reschedule scope UI (existing) + confirmation polish |
| 7-8 | ICS calendar download | `GET /api/public/manage/[token]/ics` + portal/manage Add to calendar |
| 7-13 | Portal: memberships | `PortalMembershipActions` + `/api/public/portal/[token]/memberships` |
| 7-14 | Portal: gift balances | Gift balance list + masked codes + redemption history |
| 7-15 | Portal: package usage history | Usage + purchase history tables in Products section |
| 7-18 | Portal saved payment methods | `PortalPaymentMethodSection` Stripe setup/attach/detach |
| 7-19 | Legacy confirm/cancel/reschedule tokens | Manage-link promotion banner on legacy public action pages |
| 8-4 | Package credits & ledger | Package purchase + credit history in portal |
| 8-9 | Membership subscriptions | Customer cancel/pause/resume/retry + undo scheduled cancel |
| 8-17 | Gift balance redemption history | `giftRedemptionHistory` in portal payload + UI |
| 8-29 | Saved cards | Same payment-method section (canonical portal home) |

Also updated **8-10** (membership customer pause/cancel API) from `V1_BACKEND_GAP` → `V1_COMPLETE` via portal memberships API.

## Saved payment methods

- **Provider:** Stripe Connect (workspace merchant account)
- **Add:** SetupIntent → Stripe.js card element → attach
- **Remove:** Detach with active-membership dependency guard
- **Default:** Attach path sets Stripe customer default (single saved method model)
- **Security:** No PAN/CVC in UI; server-scoped portal session + contact ownership

## Memberships

- **Cancel:** End of period or immediate (Stripe subscription when linked)
- **Undo cancel:** Clears `cancelAtPeriodEnd` metadata + Stripe flag
- **Pause / resume:** DB lifecycle + best-effort Stripe resume
- **Past due:** Retry payment via latest invoice PaymentIntent
- **Payment method change:** Links to Payments section (saved card management)

## Household / dependents

- **Display:** Profile → Household section (authorized members from `household.ts`)
- **Dependent booking:** `Book appointment` links to `/book/{slug}?bookFor={contactId}&portal={token}`
- **Authorization:** `resolveAuthorizedBookForContact` validates portal session + household membership server-side
- **Booking:** `createPlatformAppointment` accepts pre-authorized `contactId`

## Other portal residuals

- **Legacy tokens:** `manageLink` on confirm/cancel/reschedule GET APIs; banner on Kimi public action client
- **ICS:** Canonical `buildIcsAttachment` server route replaces inline client VCALENDAR on manage page
- **Recurring:** Series indicator on portal appointment rows; scope confirmation on manage cancel

## Files touched (high level)

- `src/components/appointments/client-portal-public-client.tsx`
- `src/components/appointments/portal-payment-method-section.tsx`
- `src/components/appointments/portal-membership-actions.tsx`
- `src/components/appointments/manage-appointment-public-client.tsx`
- `src/components/appointments/kimi-ui/public-confirm/components/public-action-client.tsx`
- `src/app/api/public/portal/[token]/memberships/route.ts`
- `src/app/api/public/portal/[token]/payment-methods/route.ts`
- `src/app/api/public/manage/[token]/ics/route.ts`
- `src/lib/appointments/service-booking/portal-membership-actions.ts`
- `src/lib/appointments/service-booking/portal-booking-context.ts`
- `src/lib/merchant-payments/saved-cards.ts`
- `scripts/reconcile-appointments-batch8c.mjs`

## Validation

- `npx tsc --noEmit` — no `src/` errors
- Master browser UAT / production certification — **not run** (per batch scope)

## Next batch

**8D-4 — Operations/Admin Residual Completion** — start with Calendar + Appointment Detail + Waitlist + Appointments ops + Overview admin UI gaps (89 `V1_ADMIN_UI_GAP` rows total; split into focused operational batch).
