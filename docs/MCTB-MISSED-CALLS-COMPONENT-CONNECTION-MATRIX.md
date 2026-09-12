# MCTB Missed Calls — component connection matrix

Route: `/mctb/missed-calls`. Legend: **TEST** = manual/QA unless noted.

| REGION | COMPONENT | CONTROL | DISPLAY | READ SOURCE | WRITE/ACTION | API | DOMAIN SERVICE | DESTINATION | LOADING | EMPTY | ERROR | RESPONSIVE | A11Y | TEST |
|--------|-----------|---------|---------|-------------|--------------|-----|----------------|-------------|---------|-------|-------|------------|------|------|
| Shell | App shell header | Title | (empty on list) | `getMctbPageTitle` | N/A | N/A | `mctb-nav` | N/A | N/A | N/A | N/A | same | hidden if empty | PASS |
| Header | Page header | H1 | Missed Calls | static | N/A | N/A | N/A | N/A | N/A | N/A | N/A | compact | h1 | PASS |
| Header | Description | text | Review missed calls… | static | N/A | N/A | N/A | N/A | N/A | N/A | N/A | all | paragraph | PASS |
| Header | Manage setup | Link | Manage setup | N/A | navigate | N/A | `MCTB_ROUTES` | `/mctb/setup` | N/A | N/A | N/A | all | link | PASS |
| Metrics | Missed today | value | number | `summary.missedToday` | N/A | `GET /api/mctb/missed-calls` | `loadMctbMissedCallsListData` | N/A | skeleton | — | — | 3-col / mobile | label+value | PASS |
| Metrics | Recovery texts today | value | number | `summary.sentToday` | N/A | same | prisma count smsSentAt | N/A | skeleton | — | — | same | same | PASS |
| Metrics | Replies today | value | number | `summary.repliedToday` | N/A | same | prisma CUSTOMER_REPLIED | N/A | skeleton | — | — | same | same | PASS |
| Filters | Search | input | placeholder | URL `q` + local state | debounce → `pushQuery` | same | `buildMissedCallsListWhere` | same route | visible | N/A | N/A | mobile+desktop | aria-label | PASS |
| Filters | Status | select | option label | URL `status` | `pushQuery` | same | `statusWhere` | same route | visible | N/A | N/A | desktop / sheet | aria-label | PASS |
| Filters | Date | select | presets | URL `date` | `pushQuery` | same | `dateRangeFromFilter` | same route | visible | N/A | N/A | desktop / sheet | aria-label | PASS |
| Filters | Trigger | select | disposition labels | URL `trigger` | `pushQuery` | same | `where.disposition` | same route | visible | N/A | N/A | desktop / sheet | aria-label | PASS |
| Filters | Consent mode | select | Press 1 / Existing | URL `consentMode` | `pushQuery` | same | `filterEventsByConsentMode` | same route | visible | N/A | N/A | popover/sheet | label | PARTIAL |
| Filters | Sort | select | Newest/Oldest | URL `sort` | `pushQuery` | same | `missedCallsOrderBy` | same route | visible | N/A | N/A | all | aria-label | PASS |
| Filters | Clear | button | Clear filters | derived | `router.push` base | N/A | N/A | `/mctb/missed-calls` | N/A | N/A | N/A | when active | button | PASS |
| Table | Header row | th | column titles | static | N/A | N/A | N/A | N/A | with skeleton | hidden if empty | hidden | desktop table | scope=col | PASS |
| Table | Row | tr | full record | `events[]` | click → detail | N/A | event id | `/mctb/missed-calls/[id]` | skeleton | empty state | error state | desktop | tabIndex+Enter | PASS |
| Table | Caller | th | name/phone | contactName, callerE164 | row nav | N/A | contact lookup server | detail | — | — | — | mobile card | scope=row | PASS |
| Table | Missed | td | time | detectedAt | N/A | N/A | N/A | N/A | — | — | — | all | title full ts | PASS |
| Table | Trigger | td | label | classification | N/A | N/A | `classificationToTriggerLabel` | N/A | — | — | — | all | text | PASS |
| Table | Recovery | td | primary+reason | status, suppressionReason | N/A | N/A | `formatRecoveryStatus` | N/A | — | — | — | all | not color-only | PASS |
| Table | Reply | td | text | status | N/A | N/A | `formatReplyStatus` | N/A | — | — | — | all | text | PASS |
| Table | Business line | td | phone | businessE164 | N/A | N/A | N/A | N/A | — | — | — | desktop md+ | text | PASS |
| Actions | Call back | a tel | Call back | callerE164 | tel: dial | N/A | N/A | device dialer | — | — | — | all | stopPropagation | PASS |
| Actions | Overflow | menu | Details, Copy | row | menu actions | N/A | N/A | detail / clipboard | — | — | — | desktop | menu | PASS |
| Footer | Range | text | 1–25 of N | pagination | N/A | N/A | server pagination | N/A | — | — | — | all | text | PASS |
| Footer | Pager | buttons | prev/next | URL `page` | `pushQuery` | same | skip/take | same route | — | — | — | all | aria-label | PASS |
| Empty | No data | message | copy | events.length | clear optional | N/A | N/A | N/A | — | PASS | — | all | text | PASS |
| Error | Retry | button | Retry | error flag | `load()` | GET | same loader | N/A | — | — | PASS | all | button | PASS |

## Automated scripts

- `scripts/test-mctb-missed-calls-filters.ts` — query parse + `buildMissedCallsListWhere` (PASS).

## Security (cross-tenant)

List loader and API always scope `workspaceId` from session — **PASS** (see audit).
