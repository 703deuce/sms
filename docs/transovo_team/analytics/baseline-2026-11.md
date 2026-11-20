# Transovo Analytics Baseline — gap & instrumentation list

**Date:** 9 November 2026  
**As of:** 9 November 2026, 7:58 PM America/New_York (database `now()` was 2026-11-10 00:58:29 UTC)  
**Source project:** Supabase `sms2` (`ztccppxodhgdyejkuuax`, `us-east-1`, ACTIVE_HEALTHY). The older `sms` project is INACTIVE and was not queried.  
**Code source:** https://github.com/703deuce/sms `master` (pushed 9 November 2026, 7:57 PM America/New_York). Inspected via GitHub tree + raw file fetch, not a local clone.  
**Rule:** Every figure below is **observed** (query + as-of datetime) or marked **unavailable**. Timestamp-without-time-zone columns were compared as UTC (the database session timezone is UTC).

This file is the Engineering handoff. The full baseline (metric definitions, observed numbers, funnel, and this list) is in the Page **Transovo Analytics Baseline — Nov 2026**.

Do not collect emails, names, phone numbers, raw video URLs, or transcript text in analytics events. Use `user_id`, `workspace_id`, and anonymous `visitor_id` only.

---

## Current identity reality (must read first)

Product auth has not shipped. `new-app/lib/server/workspace.ts` says: “Until product auth ships: pin workspace via env or bootstrap the first workspace row.” `resolveWorkspaceId()` returns a pinned or first workspace. `new-app/lib/api-auth.ts` `requireSession()` falls back to `DEV_AUTH_USER_ID` or `"new-app-dev"`.

Observed in `sms2` (all-time = last 30 days; every row is inside the 30-day window):

| Source | Observed count | First seen (America/New_York, UTC column treated as UTC) |
|---|---|---|
| `public."User"` | 1 | 23 Oct 2026, 6:16 AM |
| `auth.users` | 1 | 27 Oct 2026, 12:14 AM |
| `public."Workspace"` | 1 | 22 Oct 2026, 8:33 AM |
| `public."Membership"` | 1 | (no `createdAt` column) |
| Distinct `clip_projects."createdById"` | 2 | short opaque strings (lengths 3 and 6), **0** match `public."User".id`, **0** match `auth.users.id`, **0** equal `"new-app-dev"` or the workspace id |

All clip activity (189 uploads, 256 projects, 1,378 jobs, 847 clips) belongs to that **one workspace**. User-level funnels, signup conversion, paid conversion, and CAC are not measurable until identifiable users exist.

---

## Charter metric gap list

Status key:

- **Available** — can be computed from production tables today, with a precise definition.
- **Partial** — some signal exists, but identity, coverage, or billing enforcement is incomplete.
- **Missing** — no trustworthy production data or instrumentation.

| Charter metric | Status | What exists today | What Engineering should add |
|---|---|---|---|
| Website visitors | **Missing** | `@vercel/analytics` is imported in `new-app/app/layout.tsx` but rendered only when `process.env.VERCEL === '1'`. Production deploys are Hetzner + Coolify, so this almost certainly does not run. No PostHog, GA, Plausible, Mixpanel, or Amplitude in `new-app/package.json`. `new-app/app/page.tsx` only redirects to `/app/home`. No visitor table. | Install a production analytics SDK that works off Vercel (PostHog or Plausible recommended). Load it in the marketing/landing root layout **and** `new-app/app/layout.tsx`. Event: `page_view`. Properties: `path`, `referrer_domain` (not full URL), `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`/`fbclid` if present, anonymous `visitor_id`. No email. |
| Signup conversion rate | **Missing** | 1 `public."User"` and 1 `auth.users` row, but no visitor denominator, no `user_signed_up` event, and product auth is not shipped. No login/signup page under `new-app/app/`. | After auth ships: events `signup_started`, `signup_completed`. Properties: `auth_provider`, `user_id`, `workspace_id`, `visitor_id`, UTM/first-touch fields copied from the visitor cookie. Server-side insert of `public."User"` must use the Supabase auth user id (or a documented stable mapping). Conversion = `signup_completed` / unique `page_view` visitors (or `/signup` visitors) in the same period. |
| Acquisition sources | **Missing** | No UTM columns, no `utm_` keys in `.env.example`, no filename or fetched source showing UTM capture in `new-app/`. | Persist first-touch and last-touch on the user or workspace at signup: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer_domain`, `landing_path`. Table suggestion: `attribution_touches` (`user_id`, `workspace_id`, `visitor_id`, `touch`=`first`\|`last`, those fields, `created_at`). No raw PII. |
| Cost per lead | **Missing** | No ad-spend table, no lead event, no visitor count. | Not only product code: need a spend import (Sheet, ads API, or `ad_spend_daily` table: `date`, `channel`, `campaign`, `spend_cents`, `currency`). CPL = spend / signups (or qualified leads) with the same attribution keys. |
| Customer acquisition cost | **Missing** | No spend, no paid customers. | Same spend table + a reliable paid-customer count (see Paid conversion). CAC = spend / new paying workspaces in the period. |
| Activated users | **Partial** | Can be derived at **workspace** level: first `clip_uploads` with `status='COMPLETE'`; first `clips` row; first `clip_projects` with `status='READY'`. Observed: the one workspace uploaded first on 25 Oct 2026, 3:33 PM America/New_York and produced its first clip at 6:59 PM the same day. `createdById` does not join to `User` or `auth.users`, so per-user activation is unavailable. | Persist `user_id` (stable auth id) on `clip_uploads`, `clip_projects`, `clip_jobs`, `clips`, `clip_events`. Server events: `upload_completed`, `project_ready`, `first_clip_generated`. Properties: `user_id`, `workspace_id`, `upload_id`/`project_id`/`clip_id`, `source_kind`, `duration_ms`. Optional columns: `User.firstUploadAt`, `User.firstClipAt` (timestamps only). |
| Video uploads | **Available** | `public.clip_uploads` (`createdAt`, `status`, `kind`, `uploadMode`, `workspaceId`, `bytes`, `durationMs`). Observed all-time (= 30d): 189 rows; 165 `COMPLETE`; 151 `COMPLETE` and `kind='source'`; 22 `PENDING`; 2 `ABORTED`. 142 of 151 complete source uploads have a `clip_projects.uploadId`. | Keep this table. Add `user_id`. Optional event `upload_completed` for a consistent event stream. Do not log filenames or storage keys to analytics. |
| First successful clip generation | **Partial** | Proxies: `clip_projects.status='READY'` (209), `clip_jobs` type `PROCESS_PROJECT` and `status='DONE'` (169 of 193, 87.6%), presence of a `clips` row (194 of 209 READY projects have ≥1 clip; 15 READY projects have zero clips). First clip `createdAt` is 25 Oct 2026, 6:59 PM America/New_York. No per-user first-clip attribute. | Define one canonical rule and persist it: a project is successful when `status='READY'` **and** it has at least one non-deleted clip, **or** when `PROCESS_PROJECT` is `DONE` and `publishedClipCount > 0`. Event: `first_clip_generated` (once per user) and `project_clips_ready`. Log `PROCESS_PROJECT` failure reason in a non-PII `error_class` field (not raw `error` text if it can contain paths or URLs). |
| Clips viewed, edited, exported | **Partial** | `clip_events.eventType` values observed: `export` (278 events, 81 distinct clips), `download` (60 events, 21 clips), `preview_play` (19 events, 13 clips), `thumbs_down` (2). `edit_open` and `delete` are allowed in `new-app/app/api/clips/clips/[id]/events/route.ts` but **0 rows** observed; 56 clips have `deletedAt` set, so delete is not being logged. `logClipEvent` in `new-app/lib/server/clips/events.ts` also supports `export`. Meaningful edits: only 2 clips have `clip_edit_versions.kind` in (`manual`,`auto`); 1 has `manual`. All 847 clips have a non-empty `edits` jsonb (default document — do not use as “edited”). 196 `clip_renders` are `READY` covering 119 distinct clips. `clip_projects.lastViewedAt` is unused (0 non-null). | Wire the editor UI to POST `eventType=edit_open`. Log `delete` in the soft-delete path. Confirm `preview_play` fires on actual preview (13/847 is likely under-instrumented). Prefer distinct clip counts, not raw event counts. Keep using `clip_edit_versions.kind` for “edited,” not `clips.edits`. Event names to standardize: `clip_previewed`, `clip_edit_opened`, `clip_exported`, `clip_downloaded`, `clip_deleted`. Properties: `clip_id`, `project_id`, `user_id`, `workspace_id`. |
| Social publishing usage | **Partial** | Schema exists: `clip_render_share_links` (1 row, revoked, `viewCount` sum = 1), `script_composition_publish` (0 rows), `clip_user_streamer_channels` (0), `enqueueCompositionSocialPublish` in `new-app/lib/server/clips/composition-social-publish.ts` enqueues `clip_jobs.type='SOCIAL_PUBLISH_COMPOSITION'` for `tiktok` \| `youtube_shorts` \| `instagram_reels`. **0** jobs of that type observed. | Events: `share_link_created`, `share_link_viewed`, `social_publish_started`, `social_publish_succeeded`, `social_publish_failed`. Properties: `platform`, `clip_id` or `composition_id`, `user_id`, `workspace_id`, `error_class` (no access tokens). Keep job type + status as the source of truth. |
| Repeat usage | **Partial** | The one workspace was active in every week from 19 Oct–9 Nov 2026 UTC. Both distinct `createdById` values were active in 2+ ISO weeks. Identity is not joinable to users, so this is not a customer retention metric. | Once `user_id` is stable, define weekly active users as distinct `user_id` with any of: complete upload, project created, clip created, export, or job `DONE` in that America/New_York week. “Repeat usage” = users active in 2+ distinct weeks. Optional event `session_started` is not required if server tables carry `user_id` + `createdAt`. |
| Paid conversion | **Missing** (schema only) | `Workspace.billingPlan` = `growth` on the one workspace, but `stripeCustomerId` and `stripeSubscriptionId` are null (0 workspaces have Stripe IDs). `platform_product_subscriptions` = 0, `credit_ledger_entries` = 0, `ProductEntitlement` = 0, `clip_projects.creditsReserved` / `creditsCaptured` sum to 0. Credit enforcement is stubbed off: `isWorkspaceCreditEnforced()` returns false, `checkCreditBalance()` always `{ok:true}`, `deductCreditsForSend()` is a no-op, `featuresAllUnlocked()` defaults **true** unless `FEATURES_ALL_UNLOCKED` is `false`/`0` (`new-app/lib/billing/entitlements.ts`, `new-app/lib/settings/billing.ts`). `credit-policy.ts` notes enforcement may still be off in production. Stripe client exists (`getStripe()` needs `STRIPE_SECRET_KEY`) and is used more broadly in the monorepo; no Stripe clip-plan activity is in this database. | Turn on enforcement behind an explicit flag. Write `credit_ledger_entries` (or a clips-specific ledger) on reserve/capture; fill `creditsReserved` / `creditsCaptured`. Stripe Checkout + webhooks should upsert a subscription row: `workspace_id`, `plan`, `status`, `mrr_cents`, `current_period_start/end`, `cancel_at_period_end`. Events: `checkout_started`, `subscription_started`, `subscription_canceled`, `credits_purchased`. Properties: `plan`, `mrr_cents`, `workspace_id`, `user_id`. Keep Stripe customer/payment IDs in billing tables only, not in analytics events. |
| Monthly recurring revenue | **Missing** | No paid subscriptions, no invoice table with clip-plan amounts. | Derive MRR from active subscriptions (`status` in `active`/`trialing` as defined) × `mrr_cents`. Snapshot weekly. |
| Cancellations and churn | **Missing** | No cancels to count. `cancelAtPeriodEnd` exists on `platform_product_subscriptions` (empty). | Events `subscription_canceled`, `subscription_cancel_at_period_end`. Churn = canceled (or lapsed) paid workspaces / paid workspaces at period start. |
| Revenue per customer (ARPU) | **Missing** | No revenue. | ARPU = MRR / active paid workspaces. Same subscription table. |
| AI cost per processed video | **Partial** | `ai_usage` (59 rows) has `provider`, `model`, `units`, `unitType`, `costUsdMicros`, optional `projectId`/`clipId`. Observed sum: 100,663,420 micros. Of that, OpenAI `gpt-6-luna` is 97,604,803 micros ($97.60). `new-app/lib/server/ai/clips-editor-llm.ts` **documents** that an old formula was 1e6× too high and that “3 export-headline calls of ~200 tokens were booked as $97.60.” Treat the OpenAI dollar figure as **observed but unreliable**. Non-OpenAI `ai_usage` sums to 3,058,617 micros ($3.06): ElevenLabs $3.01, Gemini $0.026, Modal $0.022. `ai_generations` adds Kie costs not in `ai_usage` (BROLL_VIDEO $0.12 + THUMBNAIL $1.02 = $1.14). `ai_producer_agent_runs`: 67 runs (44 `ready`, 23 `failed`); `costUsdEstimated` sum $8.39; `geminiUsd` sum $6.86 — overlap with `ai_usage` is unclear. Only 1 transcribe `ai_usage` row; `stream_usage.modalGpuSeconds` is 0 despite 34 `stream_vods` and 24,831 `sourceSeconds`. Most PROCESS_PROJECT / RENDER_CLIP compute is unlogged. | 1) Flag or backfill pre-fix OpenAI `costUsdMicros` rows; do not mix them into margin math. 2) Always set `projectId` (and `clipId` when applicable) on `ai_usage`. 3) Log GPU/CPU for `PROCESS_PROJECT`, transcription, `RENDER_CLIP`, and `STREAM_*` (`provider`, `gpu_seconds` or `cpu_seconds`, `cost_usd_micros`, `job_id`, `job_type`). 4) Define cost per video as sum of logged costs with `projectId=P` / count of successful projects (READY + ≥1 clip) in the same period, excluding flagged bad rows. |
| Gross margin and infrastructure costs | **Missing** | No host/GPU invoice import, no storage/bandwidth cost log, credit prices are code constants only (`costOf()` in entitlements.ts) and are not charged. | Import infra invoices (Hetzner, Modal, S3/Telnyx storage, bandwidth, LLM providers) into a `infra_cost_daily` table (`date`, `vendor`, `cost_cents`, `currency`, optional `meter`). Gross margin = revenue − (logged AI + infra) once billing is on. Out of scope for product events alone. |

---

## Instrumentation asks for the Backend Engineer

Priority order. Minimal personal data in every event: `user_id`, `workspace_id`, `visitor_id`, and feature IDs only.

### P0 — Identity and a real user funnel

1. Ship product auth. Map Supabase `auth.users.id` to `public."User".id` (same id, or a documented link table). Stop using first-workspace bootstrap and `requireSession()` dev fallbacks in production.
2. Write a stable `user_id` on `clip_uploads`, `clip_projects` (`createdById` should be that id, not a 3–6 character opaque string), `clip_jobs` (optional actor), `clips` (optional), `clip_events`, and credit/billing rows.
3. Events: `signup_started`, `signup_completed` (properties listed above). No email or name in the event payload.

### P0 — Production web analytics and UTMs

4. Add PostHog or Plausible (or equivalent) that runs on Coolify/Hetzner, not only when `VERCEL=1`. Current `@vercel/analytics` hook will not measure production visitors.
5. Capture UTMs and `referrer_domain` on first visit (cookie) and stamp them on signup (first-touch and last-touch).
6. Event: `page_view` as specified in the visitors row.

### P1 — Activation and clip funnel completeness

7. Server events: `upload_completed`, `project_ready`, `first_clip_generated`.
8. Client/API: fire `edit_open` from the editor; fire `delete` on soft delete; verify `preview_play` coverage.
9. Publishing events: `share_link_created`, `share_link_viewed`, `social_publish_started/succeeded/failed` with `platform`.

### P1 — Billing and credits (needed for MRR, churn, ARPU, paid conversion)

10. Turn credit enforcement on with an explicit flag; default-unlocked features should not be the production path.
11. Ledger writes on reserve/capture; populate `creditsReserved` / `creditsCaptured`.
12. Stripe checkout + webhook upsert for clip plans; events `checkout_started`, `subscription_started`, `subscription_canceled`, `credits_purchased`. Store amounts in cents. Never put card data or raw secrets in events.

### P1 — Cost accuracy

13. Fix / flag the OpenAI `costUsdMicros` 1e6× historical bug documented in `clips-editor-llm.ts`.
14. Log processing cost for process/transcribe/render/stream jobs (`processing_cost` or `ai_usage` rows with `job_id`).
15. Optional later: `infra_cost_daily` for margin.

### P2 — Spend (CPL / CAC)

16. `ad_spend_daily` (or a manual ops process feeding it). Not required to block P0/P1.

---

## Suggested event catalog (minimal)

| Event name | Where | Properties (no PII) |
|---|---|---|
| `page_view` | Landing + `new-app/app/layout.tsx` | `path`, `referrer_domain`, `utm_*`, `visitor_id` |
| `signup_started` | Signup page / auth start | `auth_provider`, `visitor_id`, `utm_*` |
| `signup_completed` | Auth callback / `User` insert | `user_id`, `workspace_id`, `auth_provider`, `visitor_id`, first-touch `utm_*` |
| `upload_completed` | `upload-finalize` / complete path | `user_id`, `workspace_id`, `upload_id`, `kind`, `duration_ms`, `bytes` |
| `project_ready` | Project status → READY | `user_id`, `workspace_id`, `project_id`, `source_kind`, `clip_count` |
| `first_clip_generated` | First non-deleted clip for a user | `user_id`, `workspace_id`, `project_id`, `clip_id` |
| `clip_previewed` | Existing events API (`preview_play`) | `user_id`, `workspace_id`, `clip_id`, `project_id` |
| `clip_edit_opened` | Editor mount; events API `edit_open` | same |
| `clip_exported` | Existing `export` / render READY | same + `format`, `resolution` |
| `clip_downloaded` | Existing `download` | same |
| `clip_deleted` | Soft-delete path; events API `delete` | same |
| `share_link_created` / `share_link_viewed` | `render-share` / view beacon | `workspace_id`, `render_id`, `share_id` (not the raw token) |
| `social_publish_started` / `_succeeded` / `_failed` | Social publish job | `platform`, `composition_id` or `clip_id`, `workspace_id`, `error_class` |
| `checkout_started` / `subscription_started` / `subscription_canceled` / `credits_purchased` | Stripe + billing | `plan`, `mrr_cents` or `credits`, `workspace_id`, `user_id` |
| `processing_cost` (or `ai_usage` row) | Worker + API after each paid provider/GPU call | `provider`, `model`, `units`, `unit_type`, `cost_usd_micros`, `job_id`, `job_type`, `project_id`, `clip_id` |

---

## Notes for later dashboards (not blocked on this list)

Observed usage (single workspace, all-time = last 30 days) is already queryable and is reported on the Page: uploads, job success/failure (overall 1,261/1,378 `DONE` = 91.5%; `PROCESS_PROJECT` 169/193 `DONE` = 87.6%), clips, exports, downloads, weekly volume. Those definitions stay in the Page so this file can stay the instrumentation ask.

No GitHub issues were opened and no other agents were messaged, per the baseline brief.
