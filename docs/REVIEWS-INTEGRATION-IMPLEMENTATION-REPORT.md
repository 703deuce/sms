# Reviews integration + platform sender — completion report (2026-10-14)

## A. Completed implementation

| Area | Summary | Key files |
|------|---------|-----------|
| Prisma reputation DB | Supabase service client replaced with Prisma-backed `createReputationDbClient()` | `src/lib/db/client.ts`, `src/lib/reputation/db/reputation-db.ts`, migrations `20261014180000_*`, `20261014180100_*`, `20261014180200_*`, `20261014180300_*` |
| Platform inbound | Mass Text + Reviews routing after AR; inbox persist + review reply store | `platform-sms-inbound-dispatch.ts`, `platform-product-inbound.ts` |
| Job queue | `dispatchFeatureJob` → Transovo `JobQueue` + `handleJob` | `src/lib/queue/dispatch.ts` |
| Shared templates | Unified loader + API + `/templates` product filters | `src/lib/templates/unified-templates.ts`, `src/app/api/templates/unified/route.ts`, `src/app/(app)/templates/page.tsx` |
| Public Review Velocity | UI + existing API | `src/app/(public)/tools/review-velocity/page.tsx`, `src/app/api/public/review-velocity/check/route.ts` |
| Tests | Expanded matrix script | `scripts/test-reviews-full-integration-matrix.ts` |

## B. Sender routing matrix

| Product | Platform mode | Workspace A2P | Dispatch | Worker | Delivery callback | Inbound | Credits |
|---------|---------------|---------------|----------|--------|-------------------|---------|---------|
| MCTB | `resolveSharedPlatformOutboundSender` / MCTB path | Workspace sender registration | `sendQuickSms` / MCTB outbound | SMS worker / MCTB jobs | Provider webhooks → MCTB messages | AR-first platform dispatch → optional MCTB | MCTB metering |
| Appointment Reminders | Platform sender (unchanged) | Workspace A2P | AR messaging pipeline | AR jobs | AR delivery handlers | `resolveArInboundFromOutboundInitiatedConversation` | AR credits |
| Campaigns | `senderMode: PLATFORM` in `campaign-message-send.ts` | `sendViaRegistration` path preserved | `send_campaign_sms` job | `src/lib/jobs/job-handlers.ts` | Campaign message status | `resolveMassTextInboundFromPlatformAssignment` | Campaign credits |
| Reviews | `dispatchReviewRequestSms` + PLATFORM | Workspace reputation sender | `send_campaign_sms` / review sends | Reputation processor + jobs | `delivery-status.ts` | `resolveWorkspaceFromPlatformProductAssignment` + inbox | Reputation send credits |

## C. Reviews feature inventory

| Feature | UI | API | DB | Worker | Test |
|---------|----|-----|----|--------|------|
| Overview / feed | `/reviews/*` | `/api/reviews/*` | Prisma reputation tables | — | Static + matrix |
| Review requests | Yes | Yes | `review_request_*` | `send_campaign_sms` | Matrix |
| Campaigns / sequences | Yes | Yes | `review_request_campaigns` | `campaign-processor` | Matrix |
| QR builder | Yes | Yes | `review_qr_*` | QR jobs | Static `/r/` |
| Review Velocity | Yes | `/api/reviews/momentum/*` | `review_momentum_*` | `review_momentum_run` | Public API + UI |
| Templates | `/reviews/templates` + shared `/templates` | Unified API | `review_request_templates` | — | Unified API |
| Settings / alerts | Yes | Yes | `reputation_settings` | alert jobs | — |

## D. Database integration

Reviews runtime no longer requires `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`. All `createServiceClient()` calls resolve to `createReputationDbClient()`.

**Migrations:** `20261014180000_reputation_platform`, `20261014180100_platform_product_consumer`, `20261014180200_reputation_extended_tables`, `20261014180300_conversation_product_review_requests`.

**Prisma models:** `PlatformProductConsumerAssignment`, `Suppression` → `review_request_suppression`, `JobQueue`, `ConversationProductSource.REVIEW_REQUESTS`.

## E. Shared Templates

`/templates` loads `/api/templates/unified?product=` for Campaigns, Appointment Reminders (library + active), MCTB recovery opener, and Reviews templates. Product-specific editors remain at canonical routes (`/reviews/templates`, `/mctb/setup/text-back`, etc.).

## F. Tests

```bash
npx tsx scripts/test-reviews-full-integration-matrix.ts
npx tsx scripts/test-reviews-platform-sender-integration.ts
npx tsx scripts/test-ar-platform-sender-isolation.ts
```

All **PASS** (mocked/static; no live SMS).

## G. Remaining external requirements

- Production deploy / Coolify (out of scope for this task)
- Live provider credentials for full Review Velocity fetch against Google (public checker returns `providerConfigured` flag)
- Optional: run Prisma migrations on target database before enabling Reviews in production

## H. Key files changed (this completion pass)

- `src/lib/reputation/db/reputation-db.ts`
- `src/lib/db/client.ts`
- `src/lib/queue/dispatch.ts`
- `src/lib/messaging/platform-product-inbound.ts`
- `src/lib/messaging/platform-sms-inbound-dispatch.ts`
- `src/lib/templates/unified-templates.ts`
- `src/app/api/templates/unified/route.ts`
- `src/app/(app)/templates/page.tsx`
- `src/app/(public)/tools/review-velocity/page.tsx`
- `prisma/schema.prisma` + migrations
- `scripts/test-reviews-full-integration-matrix.ts`
