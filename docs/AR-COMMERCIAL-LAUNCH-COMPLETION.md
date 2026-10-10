# Appointment Reminders — commercial launch completion (2026-10-10)

## Stripe resources

| Item | Status |
|------|--------|
| Products | `Transovo Appointment Reminders — Starter/Growth/Business` via `scripts/sync-ar-stripe-catalog.ts` (metadata `product_family=appointment_reminders`, `plan_key=starter\|growth\|business`) |
| Price IDs | Written to `src/lib/appointment-reminders/commercial/ar-stripe-catalog-ids-test.ts` and `ar-stripe-catalog-ids-live.ts` when run with `--write-ids` |
| Environment | Determined by `STRIPE_SECRET_KEY` prefix (`sk_test_` vs live) — `stripeBillingMode()` |
| Webhooks | Reuses `src/lib/payments/stripe-platform-webhook.ts` + `upsertPlatformProductSubscriptionFromStripe` for `appointment_reminders` family |

**Live catalog (synced 2026-10-10):**

| Plan | Product ID | Monthly price ID |
|------|------------|------------------|
| Starter | `prod_VPyNCYYsfFUdxI` | `price_1UP8QhKjM2RWgyrvrm1dl9SP` |
| Growth | `prod_VPyNNh2lJfsSr5` | `price_1UP8QiKjM2RWgyrv9t3acn3k` |
| Business | `prod_VPyNajS5pPWNu3` | `price_1UP8QiKjM2RWgyrvJnD8q7XX` |

Test-mode IDs: run `npx tsx scripts/sync-ar-stripe-catalog.ts --write-ids` with `sk_test_` on a dev host (production container only has live key).

## Backend

| Area | Location |
|------|----------|
| Plan catalog | `src/lib/appointment-reminders/commercial/ar-plan-catalog.ts` |
| Entitlement resolution | `src/lib/appointment-reminders/commercial/ar-workspace-plan.ts` (`resolveArWorkspaceCommercial`, `assignArFreePlan`; optional `TRANSOVO_AR_LEGACY_WORKSPACE_IDS` allowlist only) |
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
- **Grandfather (optional):** comma-separated `TRANSOVO_AR_LEGACY_WORKSPACE_IDS` grants Business allowances without Stripe — no MCTB/BUSINESS-type heuristics

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
- Live price IDs are committed in `ar-stripe-catalog-ids-live.ts` (synced 2026-10-10)
- Verify after deploy: `npx tsx scripts/verify-ar-stripe-catalog.ts` (add `--live-stripe` on host with `STRIPE_SECRET_KEY` to confirm Stripe API)

## Production verification checklist

1. `GET /api/health` → `commitSha` includes commercial launch commits
2. `npx tsx scripts/verify-ar-stripe-catalog.ts --live-stripe` in web container (no duplicate Stripe products)
3. Free: `/api/appointment-reminders/product-open?plan=free` (authenticated) → `assignArFreePlan` + onboarding redirect
4. Paid checkout: uses committed live `price_*` IDs; webhook `platformProductFamily=appointment_reminders` updates `platform_product_subscriptions` only
5. Manual: one real Stripe test payment to confirm provisioning (agent cannot complete card checkout)
