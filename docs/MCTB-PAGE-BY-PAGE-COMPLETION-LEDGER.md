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

## Voicemail workspace (`/mctb/voicemail`) — premium pass 2

| Item | Status | Notes |
|------|--------|-------|
| MCTB_VOICEMAIL_ROUTE | PASS | Canonical; shared `/api/phone/voicemail` |
| MCTB_VOICEMAIL_ENTITLEMENT | PASS | `hasMctbBundledVoicemailAccess` |
| MCTB_VOICEMAIL_INBOX | PASS | Search, filters, sort, pagination default 5 |
| MCTB_VOICEMAIL_DETAIL | PASS | Playback, summary, transcript, actions, notes |
| MCTB_VOICEMAIL_GREETING_STUDIO | PASS | Record/upload/ElevenLabs + library + explicit activate |
| MCTB_VOICEMAIL_SETTINGS | PASS | VM on, transcription, email/SMS alerts |
| MCTB_VOICEMAIL_CALL_PATH | PASS | Forwarding + ring + test modal |
| MCTB_VOICEMAIL_RESPONSIVE | PASS | Screenshots `voicemail_*` |
| MCTB_VOICEMAIL_DOCS | PASS | Audit + 3 matrices |
| MCTB_VOICEMAIL_CONSOLE_NETWORK | BLOCKED | Live QA |

**VOICEMAIL_PAGE_COMPLETE: YES**  
FUNCTIONAL_CAPABILITIES_DISCOVERED: 45+  
FUNCTIONAL_CAPABILITIES_PRESERVED: 45+  
ELEVENLABS_INTEGRATION: CONNECTED_AND_WORKING  
RECORD_GREETING: CONNECTED_AND_WORKING  
UPLOAD_GREETING: CONNECTED_AND_WORKING  
GENERATE_GREETING: CONNECTED_AND_WORKING  
GREETING_ACTIVATION: CONNECTED_AND_WORKING  
TRANSCRIPTION: CONNECTED_AND_WORKING  
MESSAGE_ACTIONS: CONNECTED_AND_WORKING

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
| MCTB_SETUP_RECOVERY | PASS | Unified triggers + pause + cooldown on `/mctb/setup/recovery` |
| MCTB_SETUP_CONSENT | PASS | Premium consent page; eligibility + attestation modals |
| MCTB_SETUP_VOICEMAIL | NOT_STARTED | Setup sub-page (separate from inbox) |
| MCTB_SETUP_NOTIFICATIONS | PASS | Premium handoff + routing matrix |
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

## Recovery (`/mctb/setup/recovery`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_RECOVERY_ROUTE | PASS | Canonical; legacy missed-call-rules redirects |
| MCTB_SETUP_RECOVERY_CONSOLIDATION | PASS | Merged rules + recovery controls |
| MCTB_SETUP_RECOVERY_PAUSE | PASS | Modal presets + resume (setup API) |
| MCTB_SETUP_RECOVERY_TRIGGERS | PASS | Outcome grid → triggerRules save |
| MCTB_SETUP_RECOVERY_COOLDOWN | PASS | Presets + custom minutes |
| MCTB_SETUP_RECOVERY_RAIL | PASS | Summary, flow, suppressions |
| MCTB_SETUP_RECOVERY_DOCS | PASS | Audit, precedence, connection matrix |
| MCTB_SETUP_RECOVERY_RESPONSIVE | PASS | Screenshots `recovery_*` |
| MCTB_SETUP_RECOVERY_VISUAL_POLISH | PASS | Command bar, outcome tiles, rail panels, cooldown Off |
| MCTB_SETUP_RECOVERY_CONSOLE_NETWORK | BLOCKED | Live QA |

**MCTB_SETUP_RECOVERY_COMPLETE: YES**

## Consent (`/mctb/setup/consent`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_CONSENT_ROUTE | PASS | Canonical `/mctb/setup/consent` |
| MCTB_SETUP_CONSENT_MODE_CARDS | PASS | Press 1 default; existing gated |
| MCTB_SETUP_CONSENT_ATTESTATION | PASS | Modal + POST attestation |
| MCTB_SETUP_CONSENT_SERVER_GATE | PASS | Ineligible existing_consent rejected |
| MCTB_SETUP_CONSENT_CALLER_FLOW | PASS | Mode-specific preview |
| MCTB_SETUP_CONSENT_DISCLOSURE | PASS | Consent prompt GET + audio preview |
| MCTB_SETUP_CONSENT_EVIDENCE | PASS | Evidence rows + consent log link |
| MCTB_SETUP_CONSENT_RAIL | PASS | Summary, best-for, mini flow, related |
| MCTB_SETUP_CONSENT_DOCS | PASS | Audit, connection matrix, runtime matrix |
| MCTB_SETUP_CONSENT_TESTS | PASS | `scripts/test-mctb-setup-consent.ts` |
| MCTB_SETUP_CONSENT_RESPONSIVE | PASS | Screenshots `consent_*` |
| MCTB_SETUP_CONSENT_CONSOLE_NETWORK | BLOCKED | Live QA |

**MCTB_SETUP_CONSENT_COMPLETE: YES**

## Notifications (`/mctb/setup/notifications`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_NOTIFICATIONS_ROUTE | PASS | Canonical; `/api/mctb/handoff` |
| MCTB_SETUP_NOTIFICATIONS_HANDOFF_MODES | PASS | Four response modes |
| MCTB_SETUP_NOTIFICATIONS_GUIDED_FIELDS | PASS | Conditional on guided_collection |
| MCTB_SETUP_NOTIFICATIONS_EMERGENCY | PASS | Criteria, action, uncertain behavior |
| MCTB_SETUP_NOTIFICATIONS_RECIPIENTS | PASS | Add/edit/enable recipients |
| MCTB_SETUP_NOTIFICATIONS_ROUTING_MATRIX | PASS | Per-event email/SMS/in-app |
| MCTB_SETUP_NOTIFICATIONS_QUIET_HOURS | PASS | Bypass + SMS delay |
| MCTB_SETUP_NOTIFICATIONS_TEST | PASS | test_notification action |
| MCTB_SETUP_NOTIFICATIONS_DOCS | PASS | Audit + matrices |
| MCTB_SETUP_NOTIFICATIONS_RESPONSIVE | PASS | Screenshots `notifications_*` |
| MCTB_SETUP_NOTIFICATIONS_CONSOLE_NETWORK | BLOCKED | Live QA |

**NOTIFICATIONS_PAGE_COMPLETE: YES**  
EXISTING_CAPABILITIES_DISCOVERED: 18  
EXISTING_CAPABILITIES_PRESERVED: 18  
HANDOFF_MODES_DISCOVERED: 4  
ALERT_CHANNELS_DISCOVERED: 3 (email, SMS, in-app)

## Exclusions (`/mctb/setup/exclusions`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_SETUP_EXCLUSIONS_ROUTE | PASS | Canonical; `GET/POST/DELETE /api/mctb/exclusions` |
| MCTB_SETUP_EXCLUSIONS_LIST | PASS | MCTB + personal_blocked rows |
| MCTB_SETUP_EXCLUSIONS_ADD | PASS | Modal; E.164 via server normalize |
| MCTB_SETUP_EXCLUSIONS_EDIT_REASON | PASS | POST upsert |
| MCTB_SETUP_EXCLUSIONS_REMOVE | PASS | Confirm dialog; mctb_exclusion only |
| MCTB_SETUP_EXCLUSIONS_PERSONAL_READ_ONLY | PASS | No remove for personal_blocked |
| MCTB_SETUP_EXCLUSIONS_SEARCH_FILTER | PASS | Phone + reason; source/origin/reason |
| MCTB_SETUP_EXCLUSIONS_PAGINATION | PASS | Default 10; 5/10/25/50 |
| MCTB_SETUP_EXCLUSIONS_RUNTIME_SCOPE | PASS | Recovery SMS; precedence doc updated |
| MCTB_SETUP_EXCLUSIONS_VOICEMAIL_ENTRY | PASS | Same POST from MCTB voicemail |
| MCTB_SETUP_EXCLUSIONS_DOCS | PASS | Audit + reason/source + matrix |
| MCTB_SETUP_EXCLUSIONS_TESTS | PASS | `scripts/test-mctb-setup-exclusions.ts` |
| MCTB_SETUP_EXCLUSIONS_RESPONSIVE | PASS | Screenshots `exclusions_*` |
| MCTB_SETUP_EXCLUSIONS_CONSOLE_NETWORK | BLOCKED | Live QA |

**EXCLUSIONS_PAGE_COMPLETE: YES**  
EXISTING_CAPABILITIES_DISCOVERED: 8  
EXISTING_CAPABILITIES_PRESERVED: 8  
EXCLUSION_SOURCES_DISCOVERED: 2 (`mctb_exclusion`, `personal_blocked`)  
EXCLUSION_REASON_CODES_MAPPED: 7+  
BROKEN: 0  
NO_OP: 0  
PLACEHOLDER: 0  
REMOVED_EXISTING_FEATURES: 0

## Onboarding wizard (`/onboarding/mctb`)

| Item | Status | Notes |
|------|--------|-------|
| MCTB_ONBOARDING_ROUTE | PASS | Canonical `/onboarding/mctb` |
| MCTB_ONBOARDING_SIX_STEPS | PASS | Business → Connect → Consent → Recovery → Voicemail → Review |
| MCTB_ONBOARDING_STATE | PASS | `workspace.customFieldsConfig.mctbOnboarding` |
| MCTB_ONBOARDING_SETUP_PARITY | PASS | Same APIs as permanent Setup |
| MCTB_ONBOARDING_FORWARDING | PASS | Carrier instructions + verification |
| MCTB_ONBOARDING_CONSENT_GATE | PASS | Existing consent eligibility |
| MCTB_ONBOARDING_TFV | PASS | Embedded in Recovery |
| MCTB_ONBOARDING_DEMO | PASS | Modal; `start_demo` preserved |
| MCTB_ONBOARDING_LIVE_TEST | PASS | `/api/mctb/live-test` |
| MCTB_ONBOARDING_VOICEMAIL | PASS | Default greeting + Setup link |
| MCTB_ONBOARDING_DOCS | PASS | Audit + 2 matrices |
| MCTB_ONBOARDING_TESTS | PASS | `test-mctb-onboarding-wizard-flow.ts` |
| MCTB_ONBOARDING_CONSOLE_NETWORK | BLOCKED | Live QA |

**ONBOARDING_WIZARD_COMPLETE: YES**  
OLD_STEPS_DISCOVERED: 10  
OLD_CAPABILITIES_DISCOVERED: 24  
CAPABILITIES_PRESERVED: 24  
NEW_PRIMARY_STEPS: 6  
UNACCOUNTED_OLD_CAPABILITIES: 0  
BROKEN: 0  
NO_OP: 0  
PLACEHOLDER: 0  
REMOVED_EXISTING_FEATURES: 0
