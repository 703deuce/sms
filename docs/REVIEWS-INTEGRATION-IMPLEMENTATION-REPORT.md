# Reviews integration + platform sender — implementation report

**Branch:** `cursor/reviews-full-integration-f350`  
**Base:** `master`  
**Date:** 2026-10-14

## Summary

Selectively restored the Reviews/Reputation product from `origin/cursor/reviews-platform-integration-5c36` into current Transovo architecture, wired **platform sender** and **workspace A2P** paths for **Campaigns (mass text)** and **Review Requests**, preserved **MCTB/AR** platform sender code paths, restored **Review Velocity** without LSE grid-ranking, and added Business Messaging nav for Reviews.

## Runtime: platform sender (four products)

| Product | Platform path | Workspace A2P path | Notes |
|---------|---------------|-------------------|--------|
| MCTB | Unchanged (`resolveOutboundSmsRoute`, assignments) | Unchanged | Not rewritten |
| Appointment Reminders | Unchanged (`ar-platform-sender-pool`) | Unchanged | Not rewritten |
| Campaigns / Mass Text | `sendQuickSms` + `resolveSharedPlatformOutboundSender()` when `configJson.senderMode === "PLATFORM"` | `resolveMassTextSendingNumber` + `sendViaRegistration` (default) | Assignment: `platform_product_consumer_assignments` |
| Review Requests | `dispatchReviewRequestSms` → `sendQuickSms` + platform route | `sendQuickSms` + workspace number | Reputation settings `settings_json.senderMode` |

Shared canonical platform number: `resolveCanonicalMctbPlatformSender()` (same as MCTB/AR).

**Not shipped:** parallel `lib/reputation/twilio.ts` stack for outbound SMS (replaced by Transovo dispatch).

## Review Velocity

- Ported branch engines: `fetch-reviews`, `metrics`, `momentum-engine`, APIs, UI.
- Replaced missing LSE grid imports with `src/lib/reviews/competitor-pool.ts` (optional scan JSON only; no auto grid scan).
- `enrichTargetBusiness` in `src/lib/jobs/enrich-competitors.ts` (ScrapingDog place details).
- Public checker: `POST /api/public/review-velocity/check` (rate limited).
- Jobs: `review_momentum_run` in `src/lib/jobs/job-handlers.ts` + branch `lib/queue` for API dispatch.

## Database

- `prisma/migrations/20261014180000_reputation_platform/` — reputation tables (Supabase-compatible SQL).
- `prisma/migrations/20261014180100_platform_product_consumer/` — shared inbound assignment table.
- `MessagingProductUseCase.REVIEW_SOLICITATION` enum value (registration wiring still required for TFV).

## Tracking

- Extended `src/app/r/[trackingToken]/route.ts` with reputation `recordTrackingClick` before campaign/message fallbacks.

## Navigation

- Fourth service **Reviews** in `business-messaging-nav.ts` with service tabs (no separate Reviews Analytics nav item; `/reviews/analytics` route exists but not promoted in tabs).

## Tests run

- `npx tsx scripts/test-reviews-platform-sender-integration.ts` — **PASS**
- `npx tsx scripts/test-ar-platform-sender-isolation.ts` — **PASS**

## Remaining / blocked for live carrier verification

1. **TFV / use case:** Platform sender for review solicitation and mass-text platform mode requires carrier-approved `REVIEW_SOLICITATION` / marketing narratives — implementation is wired; live send needs production credentials + approval.
2. **Supabase:** Reputation data layer uses `createServiceClient()` — requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and applied migrations.
3. **ScrapingDog:** Review Velocity needs `SCRAPINGDOG_API_KEY` for real fetches.
4. **Full production build:** Run `npm run build` after DB migrate in CI/staging (large surface area from port).
5. **Shared Templates UI:** Product-grouped `/templates` — partial; per-product template homes remain (`/reviews/templates`, MCTB, AR, campaigns).
6. **Platform inbound for mass text/reviews:** Assignment table written on platform outbound; extend `platform-sms-inbound-dispatch.ts` to route replies using `resolve-mass-text-platform-inbound.ts` (helper added; dispatch hookup should be validated on staging).

## Certification checklist (staging)

See audit doc §9 plus platform campaign send + review single send + velocity job + QR `/r/` token.
