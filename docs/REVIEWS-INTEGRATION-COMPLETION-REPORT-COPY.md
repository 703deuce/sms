# Reviews + unified platform sender — completion report (copy-friendly)

**Branch:** `cursor/reviews-full-integration-f350`  
**PR:** #663  
**Detailed report:** `docs/REVIEWS-INTEGRATION-IMPLEMENTATION-REPORT.md`

---

## A. Completed implementation

| Area | What shipped | Key files |
|------|----------------|-----------|
| **Reviews database (Prisma)** | `createServiceClient()` → `createReputationDbClient()` (Prisma `$queryRaw`); no Supabase env for Reviews runtime | `src/lib/db/client.ts`, `src/lib/reputation/db/reputation-db.ts`, migrations `20261014180000_*`, `20261014180100_*`, `20261014180200_*`, `20261014180300_*` |
| **Platform inbound** | After AR match, routes **Campaigns** + **Reviews**; persists **Inbox** + `storeReviewReply` | `src/lib/messaging/platform-sms-inbound-dispatch.ts`, `platform-product-inbound.ts` |
| **Job queue** | `dispatchFeatureJob` → Transovo `JobQueue` + `handleJob` (incl. `review_momentum_run`) | `src/lib/queue/dispatch.ts` |
| **Shared templates** | `/api/templates/unified` + product chips on `/templates` | `src/lib/templates/unified-templates.ts`, `src/app/api/templates/unified/route.ts`, `src/app/(app)/templates/page.tsx` |
| **Public Review Velocity** | UI at `/tools/review-velocity` → existing public API | `src/app/(public)/tools/review-velocity/page.tsx` |
| **Tests** | Matrix script chaining existing sender tests | `scripts/test-reviews-full-integration-matrix.ts` |

---

## B. Sender routing matrix

| Product | Platform | Workspace A2P | Outbound dispatch | Worker | Delivery callbacks | Inbound | Credits |
|---------|----------|---------------|-------------------|--------|--------------------|---------|---------|
| **MCTB** | Existing platform path (unchanged) | Workspace registration | MCTB `sendQuickSms` / outbound route | MCTB / SMS workers | Provider → MCTB message rows | Platform dispatch → MCTB when flag enabled | MCTB metering |
| **Appointment Reminders** | Existing (unchanged) | Workspace A2P | AR messaging pipeline | AR jobs | AR handlers | `resolveArInboundFromOutboundInitiatedConversation` | AR credits |
| **Campaigns** | `senderMode: PLATFORM` in `campaign-message-send.ts` | `sendViaRegistration` path preserved | `send_campaign_sms` | `src/lib/jobs/job-handlers.ts` | Campaign message status | `resolveMassTextInboundFromPlatformAssignment` | Campaign credits |
| **Reviews** | `dispatchReviewRequestSms` + PLATFORM | Workspace reputation sender | Review sends / `send_campaign_sms` | `campaign-processor` + jobs | `delivery-status.ts` | `resolveWorkspaceFromPlatformProductAssignment` + inbox | Reputation send metering |

---

## C. Reviews feature inventory (high level)

| Feature | UI | API | DB | Worker | Test |
|---------|----|-----|----|--------|------|
| Overview / feed / insights | `/reviews/*` | `/api/reviews/*` | Reputation tables via `reputation-db` | — | Static + matrix |
| Review requests & bulk | Yes | Yes | `review_request_*` | `send_campaign_sms` | Matrix |
| Review campaigns / sequences | Yes | Yes | `review_request_campaigns` | `campaign-processor` | Matrix |
| QR builder / tracking | Yes | Yes | `review_qr_*` | QR maintenance jobs | `/r/` wiring (static) |
| Review Velocity | Yes | Momentum APIs + public check | `review_momentum_*` | `review_momentum_run` | Public UI + API |
| Templates | `/reviews/templates` + shared `/templates` | `/api/templates/unified` | `review_request_templates` | — | Unified API |
| Email requests | Yes | Brevo paths preserved | Reputation tables | `send_campaign_email` | Not live-sent in VM |

---

## D. Database integration

- **No separate Supabase runtime** for Reviews: all `createServiceClient()` usage goes through Prisma.
- **Migrations:** `20261014180000_reputation_platform`, `20261014180100_platform_product_consumer`, `20261014180200_reputation_extended_tables`, `20261014180300_conversation_product_review_requests`.
- **Prisma:** `PlatformProductConsumerAssignment`, `JobQueue`, `Suppression` → `review_request_suppression`, `ConversationProductSource.REVIEW_REQUESTS`.

**Note:** `reputation-db` is a targeted Supabase-API shim (not full PostgREST). `lib/queue/ledger.ts` still expects a legacy `job_queue` shape if anything calls `@/lib/queue/service` directly; Reviews feature enqueue paths use the new `dispatch.ts` bridge.

---

## E. Shared Templates

`/templates` loads **`/api/templates/unified?product=`** for:

- **Campaigns** — workspace `Template` rows
- **Reviews** — `review_request_templates`
- **Appointment Reminders** — library catalog (+ link to AR templates)
- **MCTB** — recovery opener from `SolutionSetup`

Canonical editors remain (`/reviews/templates`, `/mctb/setup/text-back`, etc.).

---

## F. Tests

```bash
npx tsx scripts/test-reviews-full-integration-matrix.ts
# also runs:
#   scripts/test-reviews-platform-sender-integration.ts
#   scripts/test-ar-platform-sender-isolation.ts
```

**Result:** all **PASS** (static/mocked; **no live SMS**, **no production build**).

---

## G. Remaining external requirements

- Apply Prisma migrations on the target database before production Reviews traffic.
- **SCRAPINGDOG** (or equivalent) for live Google review fetch on public Velocity check (`providerConfigured` in API response).
- Production deploy / Coolify (explicitly out of scope for this task).

---

## H. Key files changed (completion pass)

- `src/lib/reputation/db/reputation-db.ts`
- `src/lib/db/client.ts`
- `src/lib/queue/dispatch.ts`
- `src/lib/messaging/platform-product-inbound.ts`
- `src/lib/messaging/platform-sms-inbound-dispatch.ts`
- `src/lib/templates/unified-templates.ts`
- `src/app/api/templates/unified/route.ts`
- `src/app/(app)/templates/page.tsx`
- `src/app/(public)/tools/review-velocity/page.tsx`
- `prisma/schema.prisma`
- New migrations under `prisma/migrations/20261014180200_*` and `20261014180300_*`
- `scripts/test-reviews-full-integration-matrix.ts`
- `docs/REVIEWS-INTEGRATION-IMPLEMENTATION-REPORT.md`

---

## Definition of done (this assignment)

Internal wiring for Prisma Reviews data, platform inbound hookup, queue bridge for momentum/reputation jobs, unified Templates surface, public Velocity UI, and expanded tests — using the **existing** Transovo platform number paths for Campaigns/Reviews (no new carrier/approval work), and **without** `npm run build` or deployment.
