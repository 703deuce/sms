# MCTB Pass 5 — Overview & Analytics final organization

## 1. Executive verdict

**PASS — implementation complete.** Overview is operational (four KPIs, needs attention, recent activity). Analytics uses a truthful four-stage funnel, workspace-timezone ranges, authoritative booking-link counts, and removes proxy metrics. No schema, TeXML, sender-authority, or recovery-runtime changes.

## 2. Metric audit

| Metric (prior) | Source | Verdict |
|----------------|--------|---------|
| Missed calls | `missedCallEvent` in range | **KEEP** |
| Recovery texts | `smsSentAt` or status `SENT` (mixed) | **RECALCULATE** → `smsSentAt` only |
| Eligible | Not shown | **KEEP** → `eligible` column |
| Replies | `CUSTOMER_REPLIED` | **KEEP** |
| Reply rate | replies / textsSent | **KEEP** (documented) |
| Delivery rate (missed→text) | texts / missed | **REMOVE** (misleading) |
| Consent rate | duplicate of delivery rate | **REMOVE** |
| linksSent = textsSent | proxy | **REMOVE** |
| Booking links | proxy | **RECALCULATE** → `BOOKING_LINK_SENT` activity |
| uniqueCallers / repeatCallers | analytics payload | **REMOVE** from MCTB analytics API |
| conversationsStarted | duplicate replies | **REMOVE** |
| Link clicks | `linkClickEvent` | **KEEP** (secondary, labeled tracking) |
| AI-assisted | n/a | **KEEP** → distinct conversations with LR domain events |

## 3. Final metric definitions

- **Missed calls:** canonical `MissedCallEvent` rows in range (`detectedAt`).
- **Eligible:** `eligible === true` after runtime eligibility check.
- **Recovery texts sent:** `smsSentAt != null` on the event.
- **Customer replies:** `status === CUSTOMER_REPLIED` (one per missed-call event).
- **Reply rate:** customer replies ÷ recovery texts sent (0% if denominator 0).
- **Eligibility rate:** eligible ÷ missed calls.
- **Send rate:** texts sent ÷ eligible.
- **Suppressed:** `status === SUPPRESSED` (not grouped with failed).
- **Delivery failures:** `status === FAILED`.
- **Booking links sent:** `mctbConversationBookingActivity.kind = BOOKING_LINK_SENT`.
- **Callback requests:** `mctbHandoffEvent.eventType = callback_requested`.
- **AI-assisted conversations:** distinct conversations with `INTENT_IDENTIFIED`, `POLICY_MATCHED`, or `FIELD_COLLECTED` in range.
- **Needs reply:** MCTB `conversation` OPEN + unread (same as Missed Calls / Inbox).

## 4. Overview page contract

Operational dashboard: quiet when healthy; max four KPIs; needs attention only when actionable; recent activity with deep links; setup summary only when incomplete/unhealthy.

## 5. Overview before/after

| Before | After |
|--------|-------|
| Duplicate 7d analytics in setup footer | Link to Analytics from Recent activity |
| AI Lead Recovery card + policies | One-line AI Recovery summary |
| Separate missed-call table + conversations | Unified Recent activity (compact mode) |
| Call handling card always | Hidden in compact overview |
| Server-local “today” KPIs | Workspace-timezone today |

## 6–8. KPI / Needs attention / Recent activity

See `loadMctbOverviewKpis`, `buildMctbAttentionItems`, `buildMctbRecentActivity`.

## 9. Setup readiness

`MctbHomeSetupStatus` hidden when `MCTB_LAUNCH_COMPACT_OVERVIEW` and setup complete + active.

## 10–13. Analytics contract, funnel, rates, trend

Funnel: Missed → Eligible → Texts sent → Replies with stage rates. Trends unchanged (missed, texts, replies) with workspace calendar buckets.

## 14–18. Suppression, delivery, booking, callback, AI

Suppression table uses Pass 2 label map. Delivery failures separate. Booking links authoritative. Callback from handoff events. AI-assisted from domain-event groupBy.

## 19. Removed misleading metrics

`linksSent` proxy, `deliveryRate` (missed denominator), `consentRate`, `uniqueCallers`, `repeatCallers`, `conversationsStarted`.

## 20. Date/timezone

`loadWorkspaceTimeZone` from `workspaceMessagingSettings.timezone`. Range bounds and chart buckets use `workspaceCalendarDateKey`.

## 21. Query/performance

Funnel still loads event rows in range for suppression + trends (documented). Secondary counts use aggregate queries.

## 22. Workspace isolation

All queries scoped by `workspaceId` (unchanged).

## 23–25. States / responsive / a11y

Skeletons preserved; empty analytics range copy; semantic headings and table scopes retained.

## 26. Files changed (primary)

- `src/lib/mctb/analytics.ts`, `analytics-metric-definitions.ts`, `analytics-range.ts`
- `src/lib/mctb/workspace-timezone.ts`, `overview-kpis.ts`, `overview-recent-activity.ts`
- `src/lib/mctb/overview.ts`, `overview-types.ts`
- `src/components/mctb/overview-view.tsx`, `home/mctb-home-sections.tsx`
- `src/components/mctb/analytics/mctb-analytics-view.tsx`, `mctb-analytics.css`
- `src/lib/mctb/analytics-suppression-labels.ts`, `launch-flags.ts`
- `scripts/test-mctb-pass-5-overview-analytics.ts`

## 27. Runtime files changed

None (read-only analytics aggregation).

## 28. Schema changes

None.

## 29. Tests/results

```bash
npx tsx scripts/test-mctb-pass-5-overview-analytics.ts
npx tsx scripts/test-mctb-analytics-range.ts
```

Both PASS.

## 30. Deferred work

- **Pass 6:** Verify which React page component `/mctb/ai-recovery` renders in production after Pass 3 merge; ensure legacy lead-recovery page cannot become canonical again.
- Full browser certification matrices (Free / paid / A2P) — owner UI.
- Historical booking-link counts only from when `BOOKING_LINK_SENT` events were recorded (no backfill).

## 31. Owner certification checklist

- [ ] Overview: four KPIs, explicit Today window, needs attention quiet state
- [ ] Analytics funnel matches Missed Calls operational counts for same range
- [ ] No booking/revenue proxy metrics
- [ ] Suppressed ≠ failed in UI copy
- [ ] Workspace timezone spot-check (late-night call)
