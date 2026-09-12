# MCTB Missed Calls (`/mctb/missed-calls`) — existing system audit

Audit date: 2026-09-12. Scope: list page only (not detail). Backend/runtime unchanged in UI pass.

## Route & composition

| Control | Read source | Write / action | Destination | API | Canonical service | Status |
|---------|-------------|----------------|-------------|-----|-------------------|--------|
| Route `page.tsx` | `searchParams` | SSR load | Renders view | N/A | `requireWorkspaceContext` | WORKING |
| Client view | `initialData` + URL | `router.push` query | Same route | `GET /api/mctb/missed-calls` | `loadMctbMissedCallsListData` | WORKING |
| Shell header title | `getMctbPageTitle` | N/A | N/A | N/A | `mctb-nav.ts` | WORKING (list: empty; detail: "Missed Calls") |
| Page body title | static | N/A | N/A | N/A | N/A | WORKING |

## Summary metrics

| Metric | Read source | API field | Query | Status |
|--------|-------------|-----------|-------|--------|
| Missed calls | `summary.missedCount` | `data.summary.missedCount` | count scoped to active **date** filter (`detectedAt`) | WORKING |
| Recovery texts | `summary.recoveryTextsCount` | same | `smsSentAt` in date scope | WORKING |
| Replies | `summary.repliesCount` | same | `CUSTOMER_REPLIED` + `updatedAt` in date scope | WORKING |
| Needs reply | `summary.needsReplyCount` | same | `conversation` OPEN + unread + MCTB product (current inbox state) | WORKING |
| Summary range label | `summary.rangeLabel` | same | mirrors date filter (Today / 7d / 30d / All time) | WORKING |

## Filters & URL state

| Control | Param | Read | Write | Server filter | Status |
|---------|-------|------|-------|---------------|--------|
| Search | `q` | URL + debounced input 350ms | `pushQuery` | `callerE164` contains digits (≥3); `businessE164` contains digits/text | PARTIAL (no contact name search) |
| Outcome (URL `status`) | `status` | URL | `pushQuery` | `statusWhere()` — composite recovery/reply/consent outcomes | WORKING |
| Date | `date` | URL | `pushQuery` | `today` / `7d` / `30d` / `all` on `detectedAt` | WORKING |
| Trigger | `trigger` | URL | `pushQuery` | `disposition` equals value | WORKING |
| Consent mode | `consentMode` | URL | `pushQuery` | `filterEventsByConsentMode` post-query | PARTIAL (rows lack `consentMode` enrichment) |
| Sort | `sort` | URL | `pushQuery` | `detectedAt` asc/desc | WORKING |
| Page | `page` | URL | `pushQuery` | skip/take, default 25 | WORKING |
| Clear filters | N/A | derived | `router.push` base route | resets params | WORKING |

### Canonical status filter values

`all`, `needs_attention`, `replied`, `waiting_consent`, `suppressed`, `failed` — mapped to Prisma `where` in `statusWhere()`.

### Canonical trigger (disposition) values

`missed_no_answer`, `missed_busy`, `missed_rejected`, `missed_timeout`, `voicemail` (+ labels via `classificationToTriggerLabel`).

### Consent mode filter values

`press_1`, `existing_consent` (workspace-level modes; per-event filter not populated on list rows).

## Table columns & row identity

| Column | Field(s) | Status |
|--------|----------|--------|
| Caller | `contactName`, `callerE164`, `callsToday` | WORKING |
| Missed | `detectedAt` (local display) | WORKING |
| Trigger | `classification` / `disposition` | WORKING |
| Recovery | `status` + `suppressionReason` via `formatRecoveryStatus` + reason subline | WORKING |
| Reply | `status` via `formatReplyStatus` | WORKING |
| Business line | `businessE164` | WORKING |
| Actions | Callback + overflow menu | WORKING |

Row primary key: `MissedCallEvent.id` (cuid).

## Detail navigation

| Control | Action | Destination | Status |
|---------|--------|-------------|--------|
| Row click / Enter | `router.push` | `/mctb/missed-calls/[id]?return=<list qs>` | WORKING |
| Scroll restore | `sessionStorage` key `mctb-missed-calls-scroll-y` | on return | WORKING |
| Open details (menu) | same as row | detail route | WORKING |

## Callback

| Implementation | Behavior | Status |
|----------------|----------|--------|
| `href={`tel:${row.callerE164}`}` | Opens device/browser tel handler for caller E.164 | WORKING |
| Event isolation | `stopPropagation` on actions cell / callback | WORKING |

No provider call-control or in-app dialer on list page.

## Recovery / reply display

- **Recovery primary:** `formatRecoveryStatus(status, suppressionReason)` — Sent, Suppressed, Failed, Delivered, etc.
- **Suppression reason:** raw `suppressionReason` humanized (underscores → spaces, lower case) as secondary line — preserved in UI pass.
- **Reply:** Replied / No reply / — from `formatReplyStatus`.
- **Conversation link on list:** `conversationId` not returned by `loadMctbMissedCallsListData` — row menu omits "Open conversation".

## Pagination

Server: `page`, `pageSize` (default 25, max 100). Footer shows range + prev/next when `totalPages > 1`.

## Empty / loading / error

| State | Behavior | Status |
|-------|----------|--------|
| Loading | Toolbar + metric skeletons + table row skeletons | WORKING |
| Empty DB | "No missed calls yet." + subcopy | WORKING |
| Filtered empty | "No missed calls match these filters." + clear | WORKING |
| Error | "Unable to load missed calls." + Retry → client `load()` | WORKING |

## Mobile

Stacked record cards (<768px); filter bottom sheet; Callback isolated from row tap.

## Tenant security

| Check | Mechanism | Status |
|-------|-----------|--------|
| List API | `getActiveWorkspaceId()` + `where.workspaceId` | WORKING |
| Detail | separate view (not this pass) | WORKING (assumed same workspace guard) |
| Search/filter | cannot omit `workspaceId` from server loader | WORKING |

## Backend / runtime

No changes to missed-call ingestion, suppression, consent, recovery SMS, callback, or models in this pass.
