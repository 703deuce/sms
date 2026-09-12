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

## Voicemail (`/mctb/voicemail`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_VOICEMAIL_SHELL | PASS | MCTB nav; not Numbers sidebar |
| MCTB_VOICEMAIL_HEADER | PASS | Title + Configure voicemail → setup |
| MCTB_VOICEMAIL_NUMBER_SELECTOR | PASS | All numbers + per-line |
| MCTB_VOICEMAIL_METRICS | PASS | Minutes = calendar month |
| MCTB_VOICEMAIL_INBOX | PASS | Primary column ~36% |
| MCTB_VOICEMAIL_SEARCH | PASS | Caller + transcript |
| MCTB_VOICEMAIL_FILTERS | PASS | All / Unread / Read |
| MCTB_VOICEMAIL_SORT | PASS | Newest / oldest client sort |
| MCTB_VOICEMAIL_PAGINATION | PASS | Default 10; 5/10/25/50 |
| MCTB_VOICEMAIL_MESSAGE_DETAIL | PASS | Center ~42%; URL `?id=` |
| MCTB_VOICEMAIL_PLAYBACK | PASS | Native audio + speed + download |
| MCTB_VOICEMAIL_SUMMARY | PASS | Honest empty copy |
| MCTB_VOICEMAIL_TRANSCRIPT | PASS | + retranscribe |
| MCTB_VOICEMAIL_CALLBACK | PASS | BusinessCallBackButton |
| MCTB_VOICEMAIL_RESOLUTION | PASS | mark_resolved |
| MCTB_VOICEMAIL_NOTES | PASS | Blur save + status |
| MCTB_VOICEMAIL_BLOCK | PASS | MCTB exclusions |
| MCTB_VOICEMAIL_GREETING | PASS | Right rail + drawer |
| MCTB_VOICEMAIL_SETTINGS | PASS | Per-number save batch |
| MCTB_VOICEMAIL_FORWARDING_CONTEXT | PASS | Read-only + setup phone link |
| MCTB_VOICEMAIL_TEST_FLOW | PASS | Instruction modal |
| MCTB_VOICEMAIL_MOBILE | PASS | List + full-screen detail |
| MCTB_VOICEMAIL_TABLET | PASS | 2-pane + settings drawer |
| MCTB_VOICEMAIL_SECURITY | PASS | Workspace-scoped APIs |
| MCTB_VOICEMAIL_CONSOLE_NETWORK | BLOCKED | Requires live QA session |

**MCTB_VOICEMAIL_COMPLETE: YES** — enforcement verified (`enforcement_desktop.png`, pagination + disabled greeting + switches)

## Analytics (`/mctb/analytics`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_ANALYTICS_SHELL | PASS | MCTB neutral shell |
| MCTB_ANALYTICS_HEADER | PASS | Title + segmented range |
| MCTB_ANALYTICS_RANGE_SELECTOR | PASS | 7/30/90 → full page |
| MCTB_ANALYTICS_KPIS | PASS | Compact 4-metric strip |
| MCTB_ANALYTICS_FUNNEL | PASS | Horizontal strip |
| MCTB_ANALYTICS_MISSED_CALL_CHART | PASS | Compact chart |
| MCTB_ANALYTICS_RECOVERY_CHART | PASS | Compact chart |
| MCTB_ANALYTICS_REPLIES_CHART | PASS | 7-col row |
| MCTB_ANALYTICS_DELIVERY | PASS | 5-col module |
| MCTB_ANALYTICS_SUPPRESSION | PASS | Table + % |
| MCTB_ANALYTICS_SUPPRESSION_MAPPING | PASS | `analytics-suppression-labels.ts` |
| MCTB_ANALYTICS_VOICEMAIL | PASS | Compact + link |
| MCTB_ANALYTICS_NUMBER_FILTER | N/A | Not in API yet |
| MCTB_ANALYTICS_FULL_WORKSPACE_WIDTH | PASS | No narrow max-width; 12-col canvas |
| MCTB_ANALYTICS_DESKTOP | PASS | `analytics_1440_900.png`, `analytics_1600_900.png` |
| MCTB_ANALYTICS_TABLET_MOBILE | PASS | `analytics_1024_768.png`, `analytics_390_844.png` |
| MCTB_ANALYTICS_CONSOLE_NETWORK | BLOCKED | Live QA |

**MCTB_ANALYTICS_COMPLETE: YES** — width/layout polish pass (full workspace)

## Setup shell + Overview (`/mctb/setup`) — Pass 1 only

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_SHELL_HORIZONTAL_NAV | PASS | Vertical setup sidebar removed |
| MCTB_SETUP_SHELL_FULL_WIDTH | PASS | Main bleed + `mctb-setup-workspace` |
| MCTB_SETUP_SECTION_IA | PASS | 8 sections in `setup-sections.ts` |
| MCTB_SETUP_LEGACY_ROUTES | PASS | Old recovery sub-routes map to Recovery nav |
| MCTB_SETUP_OVERVIEW_STATUS_STRIP | PASS | Real setup/onboarding data |
| MCTB_SETUP_OVERVIEW_ATTENTION | PASS | Conditional rows |
| MCTB_SETUP_OVERVIEW_SUMMARY | PASS | 8 compact rows |
| MCTB_SETUP_OVERVIEW_PAUSE_RESUME | PASS | `POST /api/mctb/setup` |
| MCTB_SETUP_OVERVIEW_ACTIVITY | PASS | Funnel events read-only |
| MCTB_SETUP_OVERVIEW_QUICK_ACTIONS | PASS | Deep links |
| MCTB_SETUP_PHONE_FORWARDING | PASS | Premium 8/4 grid, status strip, instructions drawer, verify panel |
| MCTB_SETUP_RECOVERY | NOT_STARTED | Next pass |
| MCTB_SETUP_CONSENT | NOT_STARTED | Next pass |
| MCTB_SETUP_VOICEMAIL | NOT_STARTED | Next pass |
| MCTB_SETUP_NOTIFICATIONS | NOT_STARTED | Next pass |
| MCTB_SETUP_EXCLUSIONS | NOT_STARTED | Next pass |
| MCTB_SETUP_TEST | NOT_STARTED | Next pass |

**MCTB_SETUP_SHELL_COMPLETE: YES**  
**MCTB_SETUP_OVERVIEW_COMPLETE: YES** — visual premium polish (flow strip, grouped rows, status rail)

## Phone & Forwarding (`/mctb/setup/phone`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_PHONE_ROUTE | PASS | Canonical `/mctb/setup/phone` |
| MCTB_SETUP_PHONE_STATUS_STRIP | PASS | Business → forward → carrier → connection |
| MCTB_SETUP_PHONE_SECTIONS | PASS | Business, destination, carrier, setup, ring, verify |
| MCTB_SETUP_PHONE_INSTRUCTIONS_DRAWER | PASS | Carrier steps + copy; not inline wall |
| MCTB_SETUP_PHONE_VERIFY | PASS | `start_forwarding_test` + poll |
| MCTB_SETUP_PHONE_SAVE | PASS | Setup + onboarding POST; dirty state |
| MCTB_SETUP_PHONE_RAIL | PASS | Summary, flow preview, help |
| MCTB_SETUP_PHONE_RESPONSIVE | PASS | Screenshots `mctb-setup/phone_*` |
| MCTB_SETUP_PHONE_DOCS | PASS | Audit + connection matrix |
| MCTB_SETUP_PHONE_CONSOLE_NETWORK | BLOCKED | Live QA |

**MCTB_SETUP_PHONE_FORWARDING_COMPLETE: YES**
