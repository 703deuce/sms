# MCTB Analytics — existing system audit

Date: 2026-09-12

## Routes

| Route | Component |
|-------|-----------|
| `/mctb/analytics` | `MctbAnalyticsView` (compact redesign) |
| `/analytics/mctb` | Legacy redirect / alias if present |

## Data source (preserved)

- **Loader:** `loadMctbAnalytics(workspaceId, range)` in `src/lib/mctb/analytics.ts`
- **API:** `GET /api/mctb/analytics?range=7d|30d|90d`
- **SSR:** `mctb/analytics/page.tsx` passes `initialData` for default range

## Range model

- `7d` / `30d` / `90d` — inclusive from start-of-day `since` through now (server local `Date`)
- All KPIs, trends, suppression, voicemail count use the same `since` boundary

## Metrics (canonical backend)

| Metric | Source |
|--------|--------|
| Missed calls | `missedCallEvent` count in range |
| Recovery texts | events with `smsSentAt` or status `SENT` |
| Customers replied | count status `CUSTOMER_REPLIED` |
| Reply rate | `replied / textsSent` (0 if no texts) |
| Delivery rate | `textsSent / totalMissed` (labeled; see metric definitions) |
| Failures | status `FAILED` only |
| Link clicks | `linkClickEvent` with `missedCallEventId` |
| Opt-outs | suppression reason `OPTED_OUT` |
| Voicemail | `voicemailMessage` count in range |
| Suppression | `SUPPRESSED` events grouped by `suppressionReason` |

## UI controls (post-redesign)

| Control | Status |
|---------|--------|
| Range 7/30/90 | CONNECTED — URL `range` + API |
| KPI strip | CONNECTED |
| Funnel | READ_ONLY display |
| Charts | CONNECTED — trends |
| Delivery module | CONNECTED |
| Suppression table | CONNECTED — mapped labels + link to missed calls |
| Voicemail link | CONNECTED |
| Active phone (header) | N/A — analytics not scoped per number yet |

## Removed / avoided

- Colored KPI top rails (`MctbStatCards` tints)
- Purple/amber decorative sections (`ref-deco-section--tint-*`)
- Oversized funnel cards
