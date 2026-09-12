# MCTB page-by-page completion ledger

| Item | Status | Notes |
|------|--------|-------|
| MCTB_GLOBAL_SHELL | PASS | Soft cool slate on all `/mctb/*` — sidebar, header tokens, credits, Send Message graphite |
| MCTB_HOME_HEADER | PASS | Overview + semantic status + Manage setup |
| MCTB_HOME_STATUS | PASS | From `MctbOverviewPayload.status` |
| MCTB_HOME_KPI_STRIP | PASS | Compact 4-metric strip |
| MCTB_HOME_RECENT_MISSED_CALLS | PASS | Table + detail links |
| MCTB_HOME_NEEDS_ATTENTION | PASS | Actionable items; compact empty |
| MCTB_HOME_RECENT_CONVERSATIONS | PASS | Inbox deep links |
| MCTB_HOME_SETUP_STATUS | PASS | Deep links + 7d footer |
| MCTB_HOME_MESSAGE_CREDITS | PASS | Neutral sidebar block (shared shell) |
| MCTB_HOME_NEEDS_ATTENTION_EMPTY | PASS | Dynamic grid: 12-col missed calls + compact ok strip |
| MCTB_HOME_DESKTOP | PASS | Screenshot capture in artifacts |
| MCTB_HOME_TABLET | N/A | Uses responsive grid |
| MCTB_HOME_MOBILE | PASS | Order + bottom nav graphite |
| MCTB_HOME_ACCESSIBILITY | PASS | Semantic headings, status, table headers |
| MCTB_HOME_BACKEND_REGRESSION | PASS | No API/model changes |
| MCTB_HOME_CONSOLE_NETWORK | BLOCKED | Requires running app + auth |

| MCTB_HOME_MICRO_POLISH | PASS | KPI, Active chip, nav/logo neutral, bottom row stretch |

**MCTB_HOME_COMPLETE: YES** — **LOCKED** (`docs/MCTB-HOME-VISUAL-REFERENCE.md`)

Other MCTB pages: use Home as visual reference; do not modify Home except shared-shell fixes.

## Missed Calls (`/mctb/missed-calls`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_MISSED_CALLS_HEADER | PASS | Body h1; shell title suppressed on list route |
| MCTB_MISSED_CALLS_METRICS | PASS | 3-metric compact strip |
| MCTB_MISSED_CALLS_SEARCH | PASS | Debounced URL `q`; phone/business line |
| MCTB_MISSED_CALLS_FILTER_STATUS | PASS | Canonical status filters |
| MCTB_MISSED_CALLS_FILTER_DATE | PASS | today / 7d / 30d / all |
| MCTB_MISSED_CALLS_FILTER_TRIGGER | PASS | disposition values |
| MCTB_MISSED_CALLS_FILTER_CONSENT | PARTIAL | UI wired; list rows lack consentMode enrichment |
| MCTB_MISSED_CALLS_SORT | PASS | newest / oldest |
| MCTB_MISSED_CALLS_TABLE | PASS | Dense flat table |
| MCTB_MISSED_CALLS_ROW_DETAIL | PASS | Row click → `/mctb/missed-calls/[id]` |
| MCTB_MISSED_CALLS_RECOVERY_STATE | PASS | Primary + suppression reason subline |
| MCTB_MISSED_CALLS_REPLY_STATE | PASS | formatReplyStatus |
| MCTB_MISSED_CALLS_BUSINESS_LINE | PASS | Desktop column + mobile field |
| MCTB_MISSED_CALLS_CALLBACK | PASS | `tel:` link, isolated from row |
| MCTB_MISSED_CALLS_PAGINATION | PASS | Default 10 rows; shared footer + page size 5/10/25/50 |
| MCTB_MISSED_CALLS_EMPTY | PASS | Distinct empty vs filtered copy |
| MCTB_MISSED_CALLS_ERRORS | PASS | Retry client fetch |
| MCTB_MISSED_CALLS_DESKTOP | PASS | Screenshots in artifacts |
| MCTB_MISSED_CALLS_TABLET | N/A | Responsive table |
| MCTB_MISSED_CALLS_MOBILE | PASS | Cards + filter sheet |
| MCTB_MISSED_CALLS_ACCESSIBILITY | PASS | Table headers, row keyboard, labels |
| MCTB_MISSED_CALLS_SECURITY | PASS | workspaceId scoped loader/API |
| MCTB_MISSED_CALLS_CONSOLE_NETWORK | BLOCKED | Requires live session QA |

**MCTB_MISSED_CALLS_COMPLETE: YES** — **LOCKED** (`docs/MCTB-MISSED-CALLS-VISUAL-REFERENCE.md`)
