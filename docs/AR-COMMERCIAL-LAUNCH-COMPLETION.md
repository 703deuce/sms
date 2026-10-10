# Appointment Reminders — commercial launch completion (2026-10-10)

## Stripe resources

| Item | Status |
|------|--------|
| Products | `Transovo Appointment Reminders — Starter/Growth/Business` via `scripts/sync-ar-stripe-catalog.ts` (metadata `product_family=appointment_reminders`, `plan_key=starter\|growth\|business`) |
| Price IDs | Written to `src/lib/appointment-reminders/commercial/ar-stripe-catalog-ids-test.ts` and `ar-stripe-catalog-ids-live.ts` when run with `--write-ids` |
| Environment | Determined by `STRIPE_SECRET_KEY` prefix (`sk_test_` vs live) — `stripeBillingMode()` |
| Webhooks | Reuses `src/lib/payments/stripe-platform-webhook.ts` + `upsertPlatformProductSubscriptionFromStripe` for `appointment_reminders` family |

**Cloud agent note:** `STRIPE_SECRET_KEY` was not present in the build VM during this pass. Run on a host with credentials:

```bash
npx tsx scripts/sync-ar-stripe-catalog.ts --write-ids
```

Do not commit or paste secret keys. Placeholder IDs remain until sync succeeds.

## Backend

| Area | Location |
|------|----------|
| Plan catalog | `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts` |
| Entitlement resolution | `src/lib/appointment-reminders/commercial/ar-workspace-plan.ts` (`resolveArWorkspaceCommercial`, `assignArFreePlan`, legacy `TRANSOVO_AR_LEGACY_OPEN_ACCESS=1`) |
| Stripe checkout / portal / upgrade | `src/lib/appointment-reminders/commercial/stripe-checkout.ts` |
| SMS metering | `src/lib/appointment-reminders/ar-sms-usage.ts` (segment reservations) |
| Email metering | `src/lib/appointment-reminders/commercial/ar-email-usage.ts` |
| AI conversation metering | `src/lib/appointment-reminders/commercial/ar-ai-conversation-usage.ts` (one unit per `replySessionId` per period) |
| Usage period | Stripe subscription period or rolling free month (`ar-usage-period.ts`) |
| Feature gates | `src/lib/appointment-reminders/commercial/ar-feature-gates.ts` |
| Billing API snapshot | `src/lib/appointment-reminders/commercial/ar-billing-snapshot.ts` |

## Customer flows

- **Standalone pricing:** `/appointment-reminders/pricing` → Free (`POST /api/appointment-reminders/billing/free`) or paid Stripe Checkout
- **Paid checkout:** metadata `platformProductFamily=appointment_reminders`, `platformTier=<plan>`
- **Onboarding:** success URL → `/appointment-reminders/setup/connect`
- **Upgrade:** `POST /api/appointment-reminders/billing/change-plan` (Stripe subscription update with proration, or checkout if no sub)
- **Cancel:** `POST /api/appointment-reminders/billing/manage` `cancel_at_period_end`; paid access through period end; deletion → `assignArFreePlan`
- **Portal:** `POST /api/appointment-reminders/billing/portal`
- **Legacy customers:** `TRANSOVO_AR_LEGACY_OPEN_ACCESS=1` maps bundled MCTB/Voice/Business workspaces to Business allowances without auto-billing

## Feature gates (backend)

| Restriction | Enforcement |
|-------------|-------------|
| Reminder steps / timing | `validateReminderConfigForPlan` on settings PATCH |
| AI mode | `assertAiReschedulerModeAllowed` on AI rescheduler PATCH |
| Calendar imports | `assertWorkspaceImportCalendarPatchAllowed` on calendar PATCH (AR workspaces) |
| SMS quota | `reserveArReminderSmsUnit` in reminder delivery + AI outbound job |
| Email quota | `reserveArReminderEmailUnit` in `sendReminderEmailWithTracking` |
| AI conversations | `reserveArAiConversation` when entering AI reschedule from inbound follow-up |

## UI

- Pricing: `src/app/(app)/appointment-reminders/pricing/page.tsx`
- Billing tab: Settings → Plan & billing (`ArBillingSettingsOpus`)
- Usage meters: SMS, email, AI, calendars with approaching/exhausted states

## Deployment

- Additive code only; no new Prisma migrations required for core metering (uses `workspace_limits.limits` JSON + `platform_product_subscriptions`)
- Configure Stripe catalog IDs on deploy host before enabling paid checkout in production

## Remaining blockers

1. Run `sync-ar-stripe-catalog.ts --write-ids` in test and live with authorized Stripe keys
2. Confirm Stripe webhook endpoint includes platform subscription events (existing Transovo webhook)
3. End-to-end paid checkout smoke on staging after price IDs are real
