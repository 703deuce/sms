# Review Requests — integration branch vs `master` (read-only comparison)

**Purpose:** Support a go/no-go on **Review Requests as a fourth Transovo product** without merging anything. Compares `origin/cursor/reviews-platform-integration-5c36` to current `master`.

**Date:** 2026-10-14  
**Method:** `git fetch`, three-dot diff `master...branch`, `git merge-tree` conflict simulation, spot-read of APIs/UI/libs on the branch only (no checkout merge).

---

## Executive summary

| Question | Answer |
|----------|--------|
| Is the work “already in the repo”? | **Yes** — on branch `cursor/reviews-platform-integration-5c36` (2 commits on top of merge-base `2403958ff`). |
| Is it on production `master`? | **No** — `53490afe1` is **not** an ancestor of `master`. |
| Safe to `git merge` the branch today? | **No** — ~**2,145** commits on `master` since fork; **12** touched files conflict; nav/shell architecture on `master` is **Business Messaging + MCTB + AR + Campaigns**, not the Aug unified sidebar. |
| Is the branch self-consistent / shippable as-is? | **Unlikely** — review **velocity** (`momentum-engine.ts`) imports modules **missing on the branch** (`lib/maps/grid`, `lib/scans/status`, `lib/jobs/enrich-competitors`). |
| Worth a fourth product? | **Potentially yes** — large **UI + API + SQL + unit tests** are recoverable **selectively**, but SMS must be **rewired** to Transovo’s `sendQuickSms` / Telnyx path, not the branch’s **Twilio-first** `lib/reputation/twilio`. |

**Recommended path (aligns with your note):** **Do not merge the branch.** **Cherry-pick / port in layers:** schema → APIs adapted to `workspaceId` → pages reskinned to Opus → wire sends through existing messaging stack → certify.

---

## Branch facts

| Item | Value |
|------|--------|
| Branch | `origin/cursor/reviews-platform-integration-5c36` |
| Tip | `cd7f31e5e` — “Unify SMS and Reviews in one sidebar; hide Numbers from menu” |
| Main port | `53490afe1` — “Add Reviews platform to SMS app alongside Missed Call Text Back” |
| Delta vs merge-base | **443 files**, ~**92k** insertions, **213** deletions |
| Added paths (A) | **431** |
| Modified paths (M) | **12** |
| Commits on `master` since fork | **~2,145** |

### What the branch adds (counts)

| Area | Files (approx.) |
|------|-----------------|
| `src/app/(app)/reviews/**` routes | 31 |
| `src/app/api/reputation/**` | 33 |
| `src/app/api/reviews/**` (momentum, overview) | 4+ |
| `src/lib/reviews/**` | 22 |
| `src/lib/reputation/**` | 76 |
| `src/components/reputation/**` | 66 |
| `src/components/reviews/**` (velocity UI) | 21 |
| `src/lib/providers/scrapingdog/**` (+ maps-grid helpers) | part of ~57 under `src/lib/providers/` |
| SQL | `supabase/migrations/20260823000000_reputation_platform.sql` — **14** tables, 226 lines |
| npm deps | `recharts`, `html-to-image` |

### Product surfaces on the branch (nav)

`src/lib/products/reviews-nav.ts` defines **Review Velocity** → `/reviews/analytics`, Send/History → `/reviews/requests`, QR campaigns, insights, audit, alerts, tools, etc.  
Second commit folds Reviews into **legacy** `sidebar.tsx` / `voice-nav` — **not** today’s `business-messaging-nav.ts` + product switcher.

---

## Merge simulation (read-only)

`git merge-tree <merge-base> master origin/cursor/reviews-platform-integration-5c36` → **12** “changed in both”:

| File | Risk |
|------|------|
| `package.json` / `package-lock.json` | Dependency drift |
| `scripts/test-multi-product-architecture.ts` | Nav assertions obsolete vs V1 shell |
| `src/app/(app)/app/page.tsx` | Product launcher |
| `src/app/r/[trackingToken]/route.ts` | **High** — branch routes clicks through `lib/reputation/*`; `master` uses campaign/quick-SMS tracking |
| `src/components/layout/header.tsx`, `sidebar.tsx` | **High** — Opus / Business Messaging shell replaced this |
| `src/lib/products/sms-nav.ts`, `sms-routes.ts`, `voice-nav.ts`, `voice-routes.ts` | **High** — superseded by `resolve-product-nav.ts`, `business-messaging-nav.ts`, `mctb-nav`, etc. |
| `src/lib/workspace/capabilities.ts` | Entitlements flags |

**Nothing else from the branch touches `master` files** — the port is mostly **additive**. Conflicts are concentrated in **integration glue**, not in 400+ review files.

---

## Bucket 1 — Reusable with little or no change

*After copying onto `master`, not via raw merge.*

| Asset | Notes |
|-------|--------|
| **SQL migration** (`reputation_platform.sql`) | Defines `business_reviews`, `review_request_templates`, `review_request_contacts`, sync state, campaign tables, etc. Uses `business_id` / `organization_id` as text cuids; comment says map to **workspace**. Likely needs **Prisma models** + align with existing `review_request_suppression` on `master` (workspace-scoped Prisma `Suppression`). |
| **`src/lib/reputation/*.test.ts`** (14 files) | Unit tests for campaigns, QR, unsubscribe, delivery, templates — good spec for porting behavior. |
| **UI structure** | `ReviewRequestsDashboard`, campaign wizards, QR flows, velocity dashboards — **logic/layout reference**; expect **Opus reskin** (branch predates Business Messaging Opus campaigns). |
| **ScrapingDog review fetch** | `fetch-reviews.ts`, normalize, review-store — reusable if **API keys** and compliance for Google review scraping are acceptable in Transovo prod. |
| **Validation / security helpers** added on branch | `lib/security/idempotency`, `audit-log`, `rate-limit`, `safe-redirect` — compare to what `master` already has; may merge concepts, not blind copy. |
| **Entitlement hooks** | `review_campaigns`, `review_sms_sent` usage metering in send API — pattern fits fourth-product billing but must map to **current** Stripe/feature flags. |

---

## Bucket 2 — Needs adaptation (expected work)

| Topic | Branch behavior | `master` today |
|-------|-----------------|----------------|
| **SMS send** | `sendReviewRequestSms` → **`sendTwilioSms`** (`lib/reputation/twilio.ts`), direct Supabase tables | **`sendQuickSms`** + Telnyx/Twilio via `lib/sms/provider.ts`, A2P registration, workspace sender |
| **Email** | **Brevo** (`lib/reputation/brevo.ts`) | May exist elsewhere; must not duplicate if Transovo standard differs |
| **Tenant model** | `businessId`, `organizationId`, `requireBusinessAccess`, `requireBusinessPage` | **Workspace**-centric auth; shared Contacts at `/contacts` |
| **Data access** | `createServiceClient()` from **`lib/db/client.ts`** (branch-only) + Supabase tables | **Prisma** `getPrisma()` dominant on `master` |
| **Contacts** | `review_request_contacts` table + import APIs | Should **reuse** Transovo Contacts or sync — avoid duplicate CRM |
| **Navigation** | Unified MCTB+SMS+Reviews sidebar | **`business-messaging-nav`**, MCTB routes, AR routes, Campaigns tabs — add **fourth product** or “Reputation” section without reverting shell |
| **Tracking links** | `/r/[token]` reputation + QR | Campaign + `send-quick` tracking on `master` — **one** canonical redirect handler |
| **Design system** | Pre-Opus reputation theme CSS | Reskin to Transovo tokens / `newui-transplant` patterns |
| **Review link** | `review_request_links` per business | Overlap with `Workspace.reviewLinkUrl` + `resolveReviewLink` — **consolidate** |

**APIs that look “real” on the branch (not stubs):**  
`POST .../review-requests/send-sms`, `send-email`, bulk validate, campaigns CRUD, `reputation/sync`, `qr-campaigns`, templates — wired to lib code, idempotency, audit, plan limits. **Not proven** against current DB or Telnyx in this exercise (no runtime test).

---

## Bucket 3 — Broken, incomplete, or high-risk

| Issue | Evidence |
|-------|----------|
| **Review Velocity build break** | `momentum-engine.ts` imports `@/lib/maps/grid`, `@/lib/scans/status`, `@/lib/jobs/enrich-competitors` — **files do not exist** on the branch (`git cat-file` → missing). |
| **Parallel LSE stack** | `lib/db/client.ts`, `lib/db/queries.ts`, `lib/jobs/*` on branch overlap conceptually with `master` jobs/Prisma — risk of **duplicate workers** if imported wholesale. |
| **Twilio ISV path** | Dedicated reputation Twilio send + webhooks — conflicts with “don’t import duplicate SMS pipelines.” |
| **Aug 2026 snapshot** | No MCTB page specs, AR Opus, Campaigns Opus, `business-messaging-nav` — UI integration assumptions are stale. |
| **E2E / production proof** | Branch has **unit** tests under `lib/reputation`; no evidence in-repo of certified E2E SMS review sends on Transovo prod. |
| **Provider cost / keys** | ScrapingDog (and related maps-grid code) required for fetch + momentum; ops and ToS review needed. |

---

## What `master` already has (don’t re-port)

| Capability | Location |
|------------|----------|
| Automation `send_review_request` | `src/lib/automations/actions.ts` |
| Review Request Agent + outcomes registry | `src/lib/agents/types.ts`, `src/lib/outcomes/registry.ts` (UI blocked: `/outcomes/*` → dashboard) |
| `{{review_link}}` | `src/lib/messaging/review-link.ts` |
| Contact review recording | `src/lib/automations/reviews.ts` |
| Heuristic “Review Management” KPIs | `src/lib/solution-dashboard.ts` |

Fourth product should **extend**, not replace, these where possible.

---

## Suggested selective restore phases (no branch merge)

1. **Schema** — Land `reputation_platform.sql` (or Prisma equivalent), map `business_id` → `workspaceId`, reconcile suppression table naming.  
2. **Send path** — Implement `sendReviewRequestSms` as thin wrapper over **`sendQuickSms`** + existing consent/A2P gates; keep branch’s template/tracking **ideas**, not Twilio module.  
3. **Routes** — Add `/reviews/*` (or `/reputation/*` under fourth product) behind feature flag; wire nav via **`v1-launch-nav` / new `review-requests-nav.ts`**, not old `sidebar.tsx`.  
4. **Pages** — Port `components/reputation/*` + requests dashboard; Opus pass.  
5. **Google feed + velocity** — Fix missing imports; decide if velocity is **v1** or **v1.1** (may block on ScrapingDog + competitor grid).  
6. **Cert** — Manual SMS send, bulk CSV, QR scan, one momentum run, billing meter — document in V1 certification matrix.

---

## Decision rubric (fourth product)

| If… | Then… |
|-----|--------|
| Team can spend **adaptation** on SMS + workspace + nav (not a merge) | **Lean yes** — branch is a **portable asset**, not greenfield. |
| Launch requires **Review Velocity day one** | **Defer or fix** momentum dependencies + provider keys first. |
| Launch requires **only** “send review SMS from Transovo” | Could ship **smaller**: automations + dedicated Send page without full 31 routes. |
| Team hoped for **one-click merge** | **No** — glue conflicts + 2k commit drift rule this out. |

---

## Commands used (reproduce)

```bash
git fetch origin master cursor/reviews-platform-integration-5c36
git log --oneline master..origin/cursor/reviews-platform-integration-5c36   # 2 commits
git log --oneline origin/cursor/reviews-platform-integration-5c36..master | wc -l
git diff --stat master...origin/cursor/reviews-platform-integration-5c36
git diff --name-only --diff-filter=M master...origin/cursor/reviews-platform-integration-5c36
git merge-tree $(git merge-base master origin/cursor/reviews-platform-integration-5c36) master origin/cursor/reviews-platform-integration-5c36
```

---

## Related docs

- `docs/REVIEW-REPUTATION-CODE-INVENTORY.md` — where files live on branch vs `master`  
- `docs/REVIEW-REQUESTS-REPUTATION-PRODUCT-AUDIT.md` — product scope on current `master`

---

*Read-only analysis — no merge performed.*
