# Power Dialer feature gap: Kixie, PhoneBurner, JustCall vs Transovo

Generated 2026-10-23 (America/New_York). Production commit `485275b3f` on master. Source teardown: `/workspace/pd/teardown-resent.md` (921 lines, read in full). Spec: `/workspace/pd/POWER-DIALER-MASTER-SPEC.md`.

Competitor codes: **K** = Kixie, **P** = PhoneBurner, **J** = JustCall. "—" = a Transovo-only item or spec requirement that none of the three documents.

## How this was built, and what "verified" means

- Ground truth is GitHub `703deuce/sms`, `master`. The repo is private and the box has no git credentials, so I read files through the GitHub connector (no local clone). I read `docs/POWER-DIALER-LEDGER.md`, the Prisma schema, the engine files in `new-app/lib/server/phone/power-dialer/` (campaign-config, extended-config, eligibility, session-runtime, disposition-effects, dispositions, timezone-window, answer-detection, phone-resolve, caller-id-resolution, csv-import, internal-dnc, crm-sync-bridge, crm-list-import, usage-limits, merge-fields, callbacks-service, number-health-service, analytics-service, voicemail-drop-playback, campaign-access, types), the shared phone files (`calls-service.ts`, `recording-runtime.ts`, `human-call-transcription.ts`, `telnyx-call-actions.ts`, the Telnyx phone webhook route, `workspace-provider.tsx`), the dialer session UI, and the Power Dialer components (settings, library panels, compliance, team, campaign editor, campaigns, callbacks, list detail, CSV wizard, number health, overview, integrations detail, campaign contacts) plus the callbacks and voicemail-drop API routes.
- GitHub code search was unavailable (index incomplete), so "not found" means "not found in the files above". Where I say a setting has "no consumer found", I could not search the whole repo to prove absence.
- **BUILT+VERIFIED** = confirmed in independent browser testing on transovo.ai (page/flow loads and works). **BUILT-CODE-ONLY** = present in code/ledger/automated tests but never exercised live, mostly because no real call was ever placed. No real calls, no connected CRM, no Telnyx Number Reputation, in any test.
- Status classes: BUILT+VERIFIED, BUILT-CODE-ONLY, PARTIAL, NOT BUILT (deferred) = excluded by spec section 6 or policy, NOT BUILT (never scoped) = not in the spec or not implemented, N/A = out of scope for a Power Dialer (hardware, pricing, other Transovo products).

## 1. Scorecard

| Status | Count | Share |
|---|---|---|
| BUILT+VERIFIED | 28 | 15% |
| BUILT-CODE-ONLY | 43 | 22% |
| PARTIAL | 29 | 15% |
| NOT BUILT (deferred) | 15 | 8% |
| NOT BUILT (never scoped) | 71 | 37% |
| N/A | 7 | 4% |
| **Total master features** | **193** | 100% |

Reading it plainly: 28 features are live and browser-verified, 43 more exist in code but have never run against a real call or account, 29 are partial, and 86 are not built (15 deferred on purpose, 71 never scoped). 7 items are out of scope. The count is of deduplicated features across all three competitors (one row can cover several vendors), so it is not comparable with the original teardown's 51-row matrix.

Per area:

| Area | Verified | Code-only | Partial | Deferred | Never scoped | N/A |
|---|---|---|---|---|---|---|
| 1. Dialing modes and session engine | 1 | 7 | 4 | 6 | 7 | 0 |
| 2. Lists, contacts and import | 6 | 7 | 6 | 0 | 6 | 0 |
| 3. Campaign rules, retry and scheduling | 3 | 7 | 4 | 1 | 10 | 0 |
| 4. Dispositions, scripts and outcome actions | 2 | 7 | 2 | 0 | 9 | 0 |
| 5. Voicemail drop, AMD and screening | 1 | 4 | 1 | 1 | 2 | 0 |
| 6. Numbers, caller ID and number health | 2 | 1 | 4 | 2 | 9 | 2 |
| 7. Compliance and recording | 1 | 5 | 3 | 1 | 5 | 0 |
| 8. Reporting, analytics and history | 8 | 2 | 3 | 3 | 6 | 0 |
| 9. Team, roles and permissions | 1 | 1 | 1 | 0 | 5 | 1 |
| 10. Messaging and AI | 0 | 0 | 0 | 0 | 2 | 1 |
| 11. Integrations, API and extensions | 2 | 1 | 1 | 1 | 9 | 0 |
| 12. Plans, billing and packaging | 1 | 1 | 0 | 0 | 1 | 3 |

## Section A. Features we HAVE (BUILT+VERIFIED, browser-verified live)

Note: "verified" means the page or flow was exercised in a browser. None of these has been proven with a live outbound call.

### 1. Dialing modes and session engine

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Session setup screen (campaign, caller ID, mode, eligible count, calling window, script/disposition/VM/recording/screening summary, warnings) | K P J | BUILT+VERIFIED | new-app/components/phone/power-dialer-session.tsx; new-app/app/app/power-dialer/dialer/page.tsx | Browser-verified (caller ID, mode, eligible count, calling window). Phone-field priority is a free-text comma field. |

### 2. Lists, contacts and import

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| CSV import with column-mapping wizard, auto-guessed columns, live preview | K P J | BUILT+VERIFIED | new-app/components/power-dialer/csv-import-wizard.tsx; new-app/lib/server/phone/power-dialer/csv-import.ts; new-app/app/api/phone/power-dialer/lists/[id]/import-csv/route.ts | Browser-verified (preview with auto mapping). Wizard maps phone, name, mobile, work phone, company. |
| Invalid-number detection and reporting on import (never silently dropped; downloadable rejected-rows CSV) | K P (invalid finder) | BUILT+VERIFIED | new-app/components/power-dialer/csv-import-wizard.tsx (rejected rows download); new-app/lib/server/phone/power-dialer/csv-import.ts mapCsvRows | Rows flagged "Invalid <field> number" / "No phone mapped"; PhoneBurner-style bulk invalid-number finder on existing contacts is not built. |
| Calling Lists page: search, create, archive, usage-in-campaigns column | K P J | BUILT+VERIFIED | new-app/components/power-dialer/calling-lists-workspace.tsx; new-app/app/app/power-dialer/calling-lists/page.tsx | Archive verified; archived campaigns excluded from "Used in" (Phase 8). |
| List detail: contact table, pagination, search | K P J | BUILT+VERIFIED | new-app/components/power-dialer/list-detail-content.tsx |  |
| List eligibility stats / campaign contacts view (Eligible, Deferred, Completed, Suppressed, Failed; attempts, latest outcome, next callback) | K | BUILT+VERIFIED | new-app/components/power-dialer/campaign-contacts-content.tsx; new-app/lib/server/phone/power-dialer/list-eligibility.ts | Browser-verified page. Buckets differ from Kixie (no "In Progress"/"Removed" names; Completed/Suppressed/Failed instead). |
| Shared Contacts page (real DB search, delete/archive) | P (Contact Manager) | BUILT+VERIFIED | new-app/app/api/contacts; ledger Phase 10 | Real contacts only (empty if none). Not Power Dialer specific. |

### 3. Campaign rules, retry and scheduling

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Campaign create / edit sheet (General, Contacts, Dialing, Schedule, Caller ID, Call handling, Outcomes, Members) | K P J | BUILT+VERIFIED | new-app/components/power-dialer/campaign-editor-sheet.tsx | Browser-verified create. Schedule tab has only start/end hour fields. |
| Campaigns table with status, counts, search, pause, resume, archive | K J | BUILT+VERIFIED | new-app/components/power-dialer/campaigns-workspace.tsx | Create/archive verified; pause/resume wired but not separately verified. |
| Callbacks: Due today / Upcoming / Overdue / Completed / All tabs, URL-synced | J (Scheduled Calls) K P | BUILT+VERIFIED | new-app/components/power-dialer/callbacks-content.tsx; new-app/app/app/power-dialer/callbacks/page.tsx | Page verified. |

### 4. Dispositions, scripts and outcome actions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Custom disposition sets (create, reorder, clone, set default, delete; assigned per campaign) | K P J (groups) | BUILT+VERIFIED | new-app/components/power-dialer/settings-library-panels.tsx; new-app/lib/server/phone/power-dialer/dispositions-admin.ts | Browser-verified incl. Add outcome focus/toast. Teardown listed "nine fixed dispositions" as a gap; now closed. |
| Scripts library with merge fields (create, edit, clone, preview, archive, delete, set default, per-campaign) | P J (K notes only) | BUILT+VERIFIED | new-app/components/power-dialer/settings-library-panels.tsx; new-app/lib/server/phone/power-dialer/merge-fields.ts | Browser-verified CRUD. Merge fields: first_name, last_name, company, phone, rep_name + custom keys. Preview uses sample data. |

### 5. Voicemail drop, AMD and screening

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Voicemail-drop opt-in gate (admin acknowledgement; default OFF) | — | BUILT+VERIFIED | new-app/components/power-dialer/settings-content.tsx; new-app/app/api/phone/power-dialer/attempts/[id]/voicemail-drop/route.ts (403 unless prerecordedVmOptIn) | Matches the teardown compliance advice (counsel has not reviewed prerecorded-message rules). |

### 6. Numbers, caller ID and number health

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Outbound caller ID per campaign from owned numbers | K P J | BUILT+VERIFIED | new-app/lib/server/phone/power-dialer/caller-id-resolution.ts; campaign editor Caller ID tab; session setup | Browser-verified. Numbers come from the global Numbers inventory. |
| Number Health page: per-number attempts, minutes, answer rate, human-conversation rate, screening rate, failed calls; number detail page | K J P (partly) | BUILT+VERIFIED | new-app/components/power-dialer/number-health-content.tsx; new-app/lib/server/phone/power-dialer/number-health-service.ts; new-app/app/app/power-dialer/number-health/[phoneNumberId]/page.tsx | Browser-verified. These are Transovo call metrics, explicitly not carrier reputation. Registration status shows "Unknown". |

### 7. Compliance and recording

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Internal DNC list: add, search, remove (audit-logged) | K P J (blacklist) | BUILT+VERIFIED | new-app/components/power-dialer/compliance-settings-panel.tsx; new-app/lib/server/phone/power-dialer/internal-dnc.ts | UI browser-verified per acceptance. |

### 8. Reporting, analytics and history

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Overview dashboard (attempts today, human conversations, answer rate, talk time, setup checklist, attention required, campaigns, recent activity, Start dialing) | K (Business Snapshot) J (Dashboard) | BUILT+VERIFIED | new-app/components/power-dialer/overview-content.tsx; new-app/app/api/phone/power-dialer/overview/route.ts | Browser-verified. No dialing-time, sessions or callbacks-due tiles. |
| Analytics dashboard with 7/30/90-day range, totals, trend | K P J | BUILT+VERIFIED | new-app/lib/server/phone/power-dialer/analytics-service.ts; new-app/app/app/power-dialer/analytics/page.tsx |  |
| Campaign performance analytics (list and per-campaign) | K J | BUILT+VERIFIED | new-app/app/app/power-dialer/analytics/campaigns/page.tsx; campaigns/[id]/analytics |  |
| Representative performance analytics | K (Agent Reports) P (Member Detail) J (Agent Analytics) | BUILT+VERIFIED | new-app/app/app/power-dialer/analytics/representatives/page.tsx |  |
| Number performance analytics | J | BUILT+VERIFIED | new-app/app/app/power-dialer/analytics/numbers/page.tsx |  |
| Screening analytics | — | BUILT+VERIFIED | new-app/app/app/power-dialer/analytics/screening/page.tsx | Page verified; data depends on detection events that may not fire (see section 5). |
| Usage and minutes analytics | — | BUILT+VERIFIED | new-app/app/app/power-dialer/analytics/usage/page.tsx; new-app/lib/server/phone/power-dialer/usage-limits.ts | Real data from attempt billableSeconds. |
| Call History with filters (campaign, recording, etc.), session history, call detail | K (Call History) P J (All Calls) | BUILT+VERIFIED | new-app/app/app/power-dialer/call-history/page.tsx; call-history/sessions; call-history/[id]; new-app/lib/server/phone/power-dialer/call-list-filters.ts | Pages verified; individual filters (rep, disposition, screening) not each exercised by me. |

### 9. Team, roles and permissions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Team settings tab (campaign access matrix, activity visibility) | K P J | BUILT+VERIFIED | new-app/components/power-dialer/team-settings-panel.tsx | Tab verified. Activity visibility is saved; enforcement not confirmed. |

### 11. Integrations, API and extensions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Integrations page and CRM detail pages (status, supported operations, sync directions, default import source, field mappings, connect/reconnect) | K P J | BUILT+VERIFIED | new-app/components/power-dialer/integrations-list.tsx; integration-detail-content.tsx | Browser-verified disconnected state for Salesforce, Zoho, Pipedrive. No CRM ever connected, so live behavior is untested. |
| Sync history with retry | J (integration logs) | BUILT+VERIFIED | new-app/app/app/power-dialer/integrations/sync-history/page.tsx; new-app/app/api/phone/power-dialer/integrations/sync-history/[id]/retry/route.ts | Page verified; retry not exercised. |

### 12. Plans, billing and packaging

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Usage and subscription settings: included minutes, overage behavior (warn / block / allow), usage alert threshold | — | BUILT+VERIFIED | new-app/components/power-dialer/settings-content.tsx Usage tab; new-app/lib/server/phone/power-dialer/usage-limits.ts | Settings tab verified; limit enforcement blocks new sessions only when minutesIncluded is configured. Not a competitor feature (PhoneBurner is unlimited calling). |


## Section B. Features we do NOT have (full list)

Every row the teardown documents that Transovo has not built, grouped by area. "Deferred" = excluded by the master spec section 6 or by policy. "Never scoped" = not in the spec, or not implemented. Why is in the Note column (including where an external dependency is needed).

### 1. Dialing modes and session engine

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Hotkeys / keyboard shortcuts (open, answer, call, end) | K | NOT BUILT (never scoped) | No key handlers found in power-dialer-session.tsx | Teardown rated Later. |
| Dialer presets (save session settings as preset) | P | NOT BUILT (never scoped) | No preset model in prisma/schema.prisma PowerDialer* |  |
| Connect via cell phone / desk phone (Kixie Connect, PhoneBurner dial-in and ConnectMe) | K P | NOT BUILT (never scoped) | Outbound uses Telnyx WebRTC browser leg only (workspace-provider.tsx newCall) |  |
| Ring sound on/off, remove duplicate numbers in a session, skip duplicates within a contact, automatic email delivery, timestamp style (PhoneBurner General settings) | P | NOT BUILT (never scoped) | No such settings in settings-content.tsx | Small PhoneBurner convenience settings. |
| Live voicemail (leave a live message) | P | NOT BUILT (never scoped) | — |  |
| 3-way conference / warm-transfer agent directory / transfer-agent list | K P J | NOT BUILT (never scoped) | new-app/lib/server/phone/transfer.ts is the shared Phone transfer, not wired to PD | Kixie 3-way conference; PhoneBurner transfer agents with notification emails; JustCall Transfer List. |
| Accept inbound calls inside an outbound session / allow incoming calls while busy | P J | NOT BUILT (never scoped) | — |  |
| Multi-line / parallel dialing (2-10 lines per agent) | K J | NOT BUILT (deferred) | Master spec section 6; PowerDialerSession is single-attempt (currentAttemptId) | Deliberately deferred; PhoneBurner is single-line by design. |
| Machine-filtered multi-line (AI Human Detect / Answering Machine Screening) | K J | NOT BUILT (deferred) | Master spec section 6 | Depends on parallel dialing. |
| Predictive dialing / predictive pacing | J (K multi-line) | NOT BUILT (deferred) | Master spec section 6 |  |
| Dynamic dialer (shared campaign, add/remove contacts live) and waiting screen | J | NOT BUILT (deferred) | Master spec section 6 (enterprise queue distribution) |  |
| Shared queue across agents / lead distribution (LeadStream: blind/preview pull, round robin, Lead Blitz, recycle folders) | K P J | NOT BUILT (deferred) | Master spec section 6 (enterprise queue distribution, AI lead marketplace) | Campaigns have member access control, but no shared-queue distribution. |
| Abandoned-call handling (abandon timer, recorded abandon message, 3% safe-harbor tracking) | J (K not found) | NOT BUILT (deferred) | Master spec section 6 | Only matters for multi-line. |

### 2. Lists, contacts and import

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Alternate-number dialing after no answer / voicemail / invalid; "Next number" vs "Next contact" action | K P J | NOT BUILT (never scoped) | new-app/lib/server/phone/power-dialer/phone-resolve.ts (single resolved number) |  |
| Contact Management Actions during call (Always use this number, Remove this number, Remove this contact) | K | NOT BUILT (never scoped) | — |  |
| Contact Manager folders / sub-folders, pinned Quick Views, layouts, bulk edit, per-contact local time display | P | NOT BUILT (never scoped) | — | PhoneBurner contact-manager features; Transovo reuses the global Contacts model. |
| Keep a calling list in sync with a CRM active list / live CRM sync of campaign contacts | K P J (Dynamic) | NOT BUILT (never scoped) | — | Import is one-shot. |
| Add/remove contacts via API, Zapier or automation (PowerList API) | K P J | NOT BUILT (never scoped) | No public list API in new-app/app/api/phone/power-dialer/ | See Integrations. |
| Default country code / international calling controls (blocked-country list, mandatory country code) | K J | NOT BUILT (never scoped) | new-app/lib/server/phone/power-dialer/csv-import.ts defaultCountry="US" has no UI | US-centric normalization. |

### 3. Campaign rules, retry and scheduling

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Re-run a finished campaign | J | NOT BUILT (never scoped) | — | Clone is the closest equivalent. |
| Campaign-ending reasons / campaign complete state | J | NOT BUILT (never scoped) | — |  |
| Multi-step reattempt rules (several intervals/counts; global vs custom per campaign) | J | NOT BUILT (never scoped) | new-app/lib/server/phone/power-dialer/campaign-config.ts (one interval, two caps) |  |
| Priority between new leads and reattempts; dial order first/last added | J | NOT BUILT (never scoped) | — |  |
| List priority levels and waterfall / "Next PowerList" after max attempts; Standby mode | K | NOT BUILT (deferred) | Master spec section 6 (list waterfall automation) |  |
| Callbacks fire automatically for the rep who booked them while the campaign is active | J | NOT BUILT (never scoped) | new-app/components/power-dialer/callbacks-content.tsx (manual "Start call" button only) | Due callbacks are listed with a manual Start call; not injected into the auto-dial queue. |
| Option to skip reattempt rules for a scheduled contact | J | NOT BUILT (never scoped) | — |  |
| Appointments calendar, schedule from session, Google Calendar sync | P | NOT BUILT (never scoped) | — |  |
| Timezone derived from the phone number's area code | K P | NOT BUILT (never scoped) | No area-code timezone lookup in new-app/lib/server/phone/power-dialer/ | Both Kixie and PhoneBurner derive contact timezone from area code. |
| Stricter state-level calling rules / multiple windows per region (up to 3 per country) | P (warns) J | NOT BUILT (never scoped) | — |  |
| Hard legal guard (no calling before 8 am / after 9 pm local) | P (default 8-9) | NOT BUILT (never scoped) | new-app/lib/server/phone/power-dialer/campaign-config.ts (default 09:00-17:00, accepts any HH:MM) | Default window is 9-5, but nothing was found that clamps a campaign to 8 am-9 pm. Compliance risk. |

### 4. Dispositions, scripts and outcome actions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Separate Dialing Set (no-answer outcomes) and Live Answer Set (button turns green on answer) | P | NOT BUILT (never scoped) | Single set per campaign |  |
| Disposition flag: trigger follow-up workflow | K P J | NOT BUILT (never scoped) | prisma PowerDialerDisposition.triggerFollowUp column; not in UI or effects | Column exists but nothing implements it. |
| Move / forward contact to another list or campaign on disposition (Next PowerList, move to folder, workflow "add to campaign") | K P J | NOT BUILT (never scoped) | — |  |
| Assign CRM owner / tag / one-touch email / next-action per button / voicemail per button on disposition | K P | NOT BUILT (never scoped) | — |  |
| SMS on disposition (template per outcome) | K P J | NOT BUILT (never scoped) | — | Transovo has an SMS product but it is not wired to dispositions. |
| Webhook on disposition | K P J | NOT BUILT (never scoped) | — | See Integrations. |
| Cadences / workflows (call + SMS sequences; conditions then actions) | K J | NOT BUILT (never scoped) | — | Kixie Cadences; JustCall Workflows. |
| Mandatory call ratings / after-call-work timeout | J | NOT BUILT (never scoped) | — |  |
| Admin pushes system scripts to team | P | NOT BUILT (never scoped) | — |  |

### 5. Voicemail drop, AMD and screening

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Auto-drop after the beep (AI Smart Beep Detection) | K J (predictive) | NOT BUILT (never scoped) | No beep-detection or auto-drop logic in new-app/lib/server/phone/power-dialer/ | Built manual-only; auto-drop also has the unresolved legal question. |
| Prerecorded truthful introduction to screeners | — | NOT BUILT (never scoped) | No intro setting or playback code found | Spec item (section 4 F); not built. |
| Abandon recorded message / answering-machine wait time and abandon delay | J | NOT BUILT (deferred) | Master spec section 6 | Multi-line only. |

### 6. Numbers, caller ID and number health

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Number rotation (random / progressive rotation) | K P J | NOT BUILT (deferred) | Master spec section 7 (no aggressive rotation) | Excluded by policy to avoid spam-evasion behavior, not simply postponed. |
| Local presence (match caller ID area code to contact) | K P J | NOT BUILT (never scoped) | No area-code matching in caller-id-resolution.ts | Kixie ConnectionBoost, PhoneBurner Local Presence (approval-gated), JustCall US/Canada by area code. |
| Nationwide supplied local-number pool (ConnectionBoost, 50,000+ numbers; JustCall local bundles) | K J | NOT BUILT (never scoped) | — | Needs a carrier/vendor number pool; Transovo uses customer-owned numbers. |
| Number status labels (Healthy / Learning / At Risk) and daily volume thresholds | J (K P similar) | NOT BUILT (never scoped) | No status classification in number-health-service.ts | Teardown "Next: daily dial volume per number with status". |
| Official reputation / spam-label monitoring (Kixie Reputation Manager, PhoneBurner ARMOR, Connect Score) | K P | NOT BUILT (never scoped) | new-app/app/app/power-dialer/number-health/premium/page.tsx | Needs an external dependency: Telnyx Number Reputation add-on (paid) not provisioned; page honestly says "Not enabled". No score is fabricated. |
| Flagged-number alerts, remediation workflow, skip numbers with low Connect Score | K P | NOT BUILT (never scoped) | — | Depends on reputation data. |
| Pool routing strategies (myself, team member, best member, call flow, call group, external number) | P | NOT BUILT (never scoped) | — |  |
| CNAM / outbound caller ID name, branded caller ID, verified caller ID library | K P | NOT BUILT (deferred) | Master spec section 6 (branded-calling bundles); teardown "Later" |  |
| Bring-your-own caller ID and caller ID verification | P | NOT BUILT (never scoped) | Numbers must already be in the Transovo Numbers inventory |  |
| Number privacy (mask digits from agents); dialer-only numbers separate from main numbers | J | NOT BUILT (never scoped) | — |  |
| STIR/SHAKEN attestation visibility per number | P (via carriers) J (product page) | NOT BUILT (never scoped) | Carrier-side via Telnyx; not surfaced or checked in PD | Teardown flagged as unverified. |

### 7. Compliance and recording

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| National DNC registry scrub | K (probabilistic add-on, $20/user) P (DNC.com) J (none) | NOT BUILT (never scoped) | new-app/components/power-dialer/compliance-settings-panel.tsx ("No external registry integration is connected") | Needs an external provider integration; UI honestly states none is connected. |
| DNC consent override per list (Kixie PowerList DNC Consent) | K | NOT BUILT (never scoped) | — |  |
| Consent tracking per contact (consent field/records) | J | NOT BUILT (never scoped) | Contact has consentSource/consentDate/consentRecords but eligibility.ts never checks them | Data model exists in shared Contacts; not used by the dialer. |
| Area-code allow list / block list (Restricted Calling Areas) | K P | NOT BUILT (never scoped) | — |  |
| Pause recording during a call | K | NOT BUILT (never scoped) | — |  |
| Abandonment safe-harbor tracking (3% over 30 days) | — | NOT BUILT (deferred) | Master spec section 6 | Only for multi-line. |

### 8. Reporting, analytics and history

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Call history CSV export (and export dial sessions) | K P | NOT BUILT (never scoped) | No export route under call-history or new-app/app/api/phone/power-dialer/ | Only list export exists. |
| Disposition Summary report | P | NOT BUILT (never scoped) | — | Analytics does not break results out by disposition. |
| Leads by Source, Funnel, Source, Team Summary, Activity reports; custom report builder; AI dashboard builder | K P | NOT BUILT (never scoped) | — |  |
| Scheduled / emailed reports (daily, weekly); export with recordings (CSV or ZIP) | P J | NOT BUILT (never scoped) | — |  |
| Define success of calls (by disposition or rating) | J | NOT BUILT (never scoped) | — |  |
| Real-time leaderboard / live leaderboards | K P | NOT BUILT (deferred) | Master spec section 6 (enterprise live salesfloor) |  |
| Live Call Board, agent status / workforce management, live queues | K P J | NOT BUILT (deferred) | Master spec section 6 |  |
| Listen / whisper / barge and coaching | K P J | NOT BUILT (deferred) | Master spec section 6 (supervisor whisper/barge, coaching dashboards) | Teardown: needs Telnyx call control. |
| Conversation Intelligence: sentiment, keywords, call strength score, Playbooks, call scoring | K P | NOT BUILT (never scoped) | — |  |

### 9. Team, roles and permissions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Custom roles with granular permissions (call logs, recordings, transcripts, contacts, campaigns, workflows, numbers) | J P | NOT BUILT (never scoped) | — |  |
| Supervisor role, login-as, temporary contact sharing | P | NOT BUILT (never scoped) | — |  |
| Teams / user groups; teams required for lists and queues | K J | NOT BUILT (never scoped) | — |  |
| Manager options (restrict reporting/numbers, allow agent lists, allow webhooks) and agents' personal lists (My PowerLists) | K | NOT BUILT (never scoped) | — |  |
| Agent DND / call waiting / find-me-follow-me | K | NOT BUILT (never scoped) | — | Phone-product territory. |

### 10. Messaging and AI

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| AI agent that handles callbacks (AI Voice Agent for callbacks) | K J | NOT BUILT (never scoped) | Ava exists for inbound AI Receptionist; not wired to dialer numbers | Possible differentiator per teardown. |
| One-touch email from the dial session | P | NOT BUILT (never scoped) | — |  |

### 11. Integrations, API and extensions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Two-way custom field sync | J | NOT BUILT (never scoped) | Detail page maps contact fields only |  |
| HubSpot (Kixie 22 articles; PhoneBurner; JustCall) | K P J | NOT BUILT (never scoped) | CRM_PROVIDER_IDS = salesforce, zoho, pipedrive only | The most documented CRM for Kixie. |
| GoHighLevel / HighLevel | K P J | NOT BUILT (never scoped) | — |  |
| Outreach, Salesloft, Apollo, Copper, Freshsales, Follow Up Boss, Keap, Vendasta, Nimble, other CRMs | K P J | NOT BUILT (never scoped) | — | JustCall claims 70+ integrations. |
| Zapier | K P | NOT BUILT (never scoped) | — |  |
| Outbound webhooks (call start/begin, call end, voicemail, call outcome / by disposition, contact displayed, schedule activity) | K P J | NOT BUILT (never scoped) | No webhook subscription model or UI in prisma PowerDialer* or new-app/app/api/phone/power-dialer/ | Inbound Telnyx webhooks are handled; there are none for customers. |
| Public API / API keys / personal access token (add to list, make a call, agent status, send to queue) | K P J | NOT BUILT (never scoped) | No PD API-key feature in new-app (legacy src has an api-keys panel) |  |
| Chrome / Edge extension, CRM click-to-call, dial-session companion | K P | NOT BUILT (deferred) | Master spec section 6 (native Chrome extension) |  |
| Mobile apps (iOS / Android) for calling and campaign management | J | NOT BUILT (never scoped) | — |  |
| Auto-create CRM contact for unknown callers; connection-duration threshold for "connected" | K | NOT BUILT (never scoped) | — |  |

### 12. Plans, billing and packaging

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Real billing and usage dashboard | K P J | NOT BUILT (never scoped) | new-app settings-tabs.tsx USAGE constant is mock | Main /app/settings?tab=billing page is hard-coded demo numbers; /app/billing 404s. |


### N/A (documented by the competitors, out of scope for a Power Dialer)

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Number porting in/out | K | N/A | Platform Numbers area (legacy port-out exists in src/) | Not a Power Dialer feature. |
| Calling data center selection; desk phone / SIP ALG / Magic Jack support | J K P | N/A | — | Hardware or infrastructure options. |
| Inbound IVR, ring groups, call queues, CRM-rules routing; call flows and call groups | K P | N/A | Transovo Phone / Conversational IVR product (new-app/app/api/phone/auto-attendant, forwarding/groups) | Exists in the separate Phone product, outside the Power Dialer scope. |
| SMS / MMS, templates, Team SMS, 10DLC registration | K P J | N/A | Separate Transovo SMS product | Not a Power Dialer feature; the dialer-to-SMS wiring is the gap (see section 4). |
| Published per-seat plan tiers, annual vs monthly pricing, seat minimums, 14-day trial, free trial minutes | K P J | N/A | — | Pricing and packaging; Transovo spec requires configurable, never hard-coded prices. |
| Paid add-ons (Kixie DNC $20/user, AI Human Detect, ConnectionBoost, Conversation Intelligence; JustCall AMD $0.009/call; PhoneBurner ARMOR, Connect Score) | K P J | N/A | — | Packaging items; the capability gaps are listed in their own sections. |
| Account-level hold music, 2FA, GDPR pack, email-notification filters | K | N/A | — | Platform-level items. |


## Section C. Partially built, and built but unverified

### C1. PARTIAL (what is missing is in the Note column)

### 1. Dialing modes and session engine

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Pause and Preview mode (review lead, then dial manually) | P (named); K, J partial | PARTIAL | new-app/components/power-dialer/campaign-editor-sheet.tsx (Power/Preview); power-dialer-session.tsx (Preview manual Call button) | Mode toggle exists (Power vs Preview/manual dial, selectable at session setup, browser-verified setup). Preview does NOT offer the PhoneBurner extras: skip lead, send SMS, review notes before dial. |
| Resume an unfinished session (PhoneBurner: Recent Dial Sessions, 60 days) | P | PARTIAL | new-app/lib/server/phone/power-dialer/session-runtime.ts startSessionWithRep returns existing active/paused session; new-app/app/app/power-dialer/call-history/sessions/page.tsx | State is persisted in the DB and starting a session on the same campaign returns the open one. No "resume from session history" button or 60-day window found; UI re-attach after refresh not verified. |
| Reserved / upcoming contacts list during session | K | PARTIAL | new-app/components/phone/power-dialer-session.tsx (shows only the single next lead) | Only the next lead is shown, not a queue of upcoming numbers. |
| Mute / hold / transfer controls during a call | K P J (transfer list) | PARTIAL | new-app/components/providers/workspace-provider.tsx (toggleMute, toggleHold, transferActiveCall exist in shared softphone) | Exist in the shared Phone softphone code but power-dialer-session.tsx only calls startCall/endCall; no mute/hold/transfer buttons in the Dialer panel. Not verified on PD pages. |

### 2. Lists, contacts and import

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Duplicate handling on import (skip / update existing / add to list) | P J (allow duplicates) | PARTIAL | new-app/components/power-dialer/csv-import-wizard.tsx; new-app/lib/server/phone/power-dialer/csv-import.ts findDuplicatesInFile | Three modes exist. Result screen hard-codes "Updated: 0" (wizard sets updated: 0), so update counts are not reported accurately. |
| Custom fields from import (Kixie 6 custom, PhoneBurner custom fields, JustCall number/dropdown fields) | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/csv-import.ts (mapping.custom supported); new-app/components/power-dialer/csv-import-wizard.tsx (sends custom: {}) | Backend and merge fields accept custom keys, but the wizard has no UI to map custom columns and sends an empty custom map. No dropdown/number field types. |
| Standard contact fields beyond name/phone/company (title, email; PowerList Notes "Next Call Refresher") | K P J | PARTIAL | Contact model has email; wizard maps only name/phones/company | No title/email mapping in the wizard; no editable per-contact refresher note (only per-attempt notes). |
| Contact timezone column on import (used for calling hours) | K P J (timezone field) | PARTIAL | new-app/lib/server/phone/power-dialer/csv-import.ts (timezone mapped server-side); csv-import-wizard.tsx has no timezone select | Server accepts a timezone mapping but the wizard UI does not expose it. |
| Multiple phone numbers per contact (mobile / work / phone) with priority order | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/phone-resolve.ts resolveContactDialPhone; csv-import.ts | Picks the first valid number by priority. No automatic fall-through to the next number after no-answer/voicemail/invalid, and no per-number remove. |
| Contact card in session (name, company, phone, up to 6 custom fields, script) | K P J | PARTIAL | new-app/components/phone/power-dialer-session.tsx | No title, email, CRM deal, per-contact local time or CRM link. |

### 3. Campaign rules, retry and scheduling

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| CRM ownership rules / "Dial by Owner" keeps CRM-owned leads with their owner | K | PARTIAL | new-app/lib/server/phone/power-dialer/crm-list-import.ts (stores ownership in metadata); campaign-extended-config.ts contactOwnership | Ownership is stored at import and a contactOwnership setting exists; no enforcement of owner-based dialing found. |
| Reschedule / assign rep / edit notes on a callback | J P | PARTIAL | new-app/app/api/phone/power-dialer/callbacks/[id]/route.ts supports reschedule and assignedUserId | API supports it; the Callbacks table UI only offers Start call, Complete, Cancel. No rep, phone, timezone or notes columns. |
| Calling hours by contact timezone field (else campaign timezone) | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/eligibility.ts (contact.timezone \|\| rules.timezone) | Works only if Contact.timezone is populated; wizard cannot map it. Campaign editor timezone choices are limited to Central/Eastern/Pacific. |
| Allowed days of week in the UI; per-day hours, 15-minute increments, lunch windows | P (2026 release) | PARTIAL | new-app/lib/server/phone/power-dialer/campaign-config.ts allowedDays (backend); campaign-editor-sheet.tsx has no days control | Backend supports allowedDays (default Mon-Fri) but the editor only exposes start/end; no per-day hours or lunch windows. |

### 4. Dispositions, scripts and outcome actions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Disposition flag: mark connected / mark contact completed / remove from queue | K P | PARTIAL | new-app/lib/server/phone/power-dialer/disposition-effects.ts (removeFromQueue/markContactCompleted branch is an empty comment); eligibility.ts TERMINAL_DISPOSITIONS | Flags are stored, but the effect code is a no-op. Contacts complete only when the label matches a hard-coded terminal list (booked, not interested, wrong number, do not call, dnc), so renamed custom outcomes cannot retire a lead. |
| Disposition flag: require notes | K P | PARTIAL | prisma PowerDialerDisposition.requireNotes; settings-library-panels.tsx toggle | Setting is stored and editable; no enforcement found in saveAttemptOutcomeWithProgression. |

### 5. Voicemail drop, AMD and screening

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Screening handling settings (notify rep, skip recognized screener, rep handles, uncertain behavior) | — | PARTIAL | new-app/components/power-dialer/settings-content.tsx Call Screening tab; lib/products/power-dialer.ts | Settings save, but no runtime consumer was found in calls-service, answer-detection or session-runtime. Labelled experimental. |

### 6. Numbers, caller ID and number health

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Number pools / "dial using selected numbers" | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/caller-id-resolution.ts (callerIdPoolNumberIds); campaign-editor-sheet.tsx says "Number pools are not configured" | Backend picks one number by a deterministic hash of campaign+rep. No pool UI, no routing strategies, no per-number add/remove screen. |
| Free reputation guidance (Hiya, First Orion, Free Caller Registry) and number warm-up guidance | K P | PARTIAL | new-app/app/app/power-dialer/number-health/free-tools/page.tsx | Guidance and links to external portals for Hiya, First Orion and Free Caller Registry exist; no in-product warm-up guidance or registration tracking. |
| Callback routing for dialer numbers (route returning calls to last agent / pool strategy / set number / AI agent) | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/campaign-extended-config.ts callbackRoutingE164 | Field exists in config; no editor field and no consumer found. Inbound handling is the existing Phone product, whose mapping to dialer numbers is unverified. |
| Buy numbers by area code / assign numbers to agents | K P | PARTIAL | Global Numbers inventory (new-app/lib/server/telnyx/numbers.ts); settings repNumberAssignments | Purchasing is in the shared Numbers area. repNumberAssignments is a stored setting; no enforcement found. |

### 7. Compliance and recording

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Frequency / harassment caps (Kixie default 3 calls and 2 SMS per day) | K | PARTIAL | new-app/lib/server/phone/power-dialer/eligibility.ts daily_cap_reached | Per-contact daily attempt cap per campaign only; not a cross-campaign or SMS cap. |
| Recording on/off with consent modes (All / None / Two-Party by area code; live-answers only) | K P J | PARTIAL | new-app/lib/server/phone/recording-runtime.ts (uses global phone setting recordCalls); lib/products/power-dialer.ts recordingEnabled, recordingConsentAnnounce | Power Dialer recording toggles, announce flag and retention days are stored, but recording start uses the global Phone setting. No two-party-by-area-code logic and no live-answer-only recording. |
| Required legal terms / in-product disclaimers beyond the acknowledgement | K | PARTIAL | compliance-settings-panel.tsx | One acknowledgement button; no published terms or per-state disclaimers. |

### 8. Reporting, analytics and history

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Call source column (Manual / PowerDialer / Click-to-call / Cadence / API) and source link to list | K | PARTIAL | HumanCall.source = power_dialer; calls-service.ts | Source is stored; no multi-source column UI verified. |
| Connect rate / human and machine pickup rate / unclassified metrics | P J | PARTIAL | new-app/lib/server/phone/power-dialer/analytics-service.ts; number-health-service.ts | Answer rate and human rate exist; machine-pickup and unclassified rates are not reported, and depend on AMD. |
| AI call summary and suggested follow-ups | K (CI) P (AI note taker) J (JustCall AI) | PARTIAL | human-call-transcription.ts | The "AI summary" is the first 400 characters of the transcript plus a keyword-matched follow-up hint. There is no LLM summary, sentiment, talk ratio or call scoring. |

### 9. Team, roles and permissions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Per-rep number assignment | K | PARTIAL | lib/products/power-dialer.ts repNumberAssignments | Stored setting; not enforced in caller-id resolution. |

### 11. Integrations, API and extensions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Log dispositions, notes and recordings back to CRM | K P J | PARTIAL | new-app/lib/server/phone/power-dialer/crm-sync-bridge.ts (log_call with disposition/notes/recording URL; create_callback_task) | Event payload includes them; per-CRM field-level behavior unverified. |


### C2. BUILT-CODE-ONLY (exists in code and tests; never run live)

### 1. Dialing modes and session engine

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Single-line sequential power dialing (auto-dial next after outcome) | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts (progression phases, nextCallAt, createAttemptForSession); new-app/components/phone/power-dialer-session.tsx (autoDialReady effect) | Auto-advance is built and unit-tested, but it is driven by the browser tab (client effect fires when server says autoDialReady). No server-side dialer; closing the tab stops dialing. Idempotency keys prevent duplicate attempts. Never exercised with a real call. |
| Session start / pause / resume / end | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts (startSessionWithRep, endSessionHard); API sessions/[id]/route.ts (pause/resume/end/skip_countdown) | Session Setup was browser-verified; Start was never clicked in testing, so the running-session UI is code/test only. |
| Session summary on end (attempts, unique contacts, human conversations, talk time, duration, follow-ups, remaining eligible, errors) | K (Overview tab) P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-summary.ts; API sessions/[id]/summary/route.ts | Shown after End session; not exercised live. Kixie's live in-session counters (Queued/Deferred/Dialed/Answered/Connected/Machines) are not shown live during the session. |
| Ring timeout (default ~30 s, configurable) | K P (J not found) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/campaign-config.ts (10-120 s); session-runtime.ts sweepPowerDialerTimeouts; calls-service.ts ringTimeoutAt | Server sweep + client hangup. Automated tests only; no real ring-out observed. |
| Post-call interval / cool-off before next dial | K P J (Cool Off Time) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/campaign-config.ts postCallIntervalSeconds 0-300; session-runtime.ts nextCallAt | Plus a "Skip wait" button in the dialer. |
| Require disposition before next dial (mandatory outcome) | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts createAttemptForSession ("Disposition required before next call"); campaign editor toggle | Enforced server-side; setting off auto-dispositions the call as Connected / No answer. |
| No second call while one is live; duplicate-call protection (idempotency, unique sequence) | — | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts (live-attempt check, idempotencyKey); calls-service.ts; api/telnyx/phone/route.ts (TelnyxWebhookDedup) | Not a competitor feature in the teardown; Transovo spec requirement. Tests: test:power-dialer-engine. |

### 2. Lists, contacts and import

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Saved filters on a list | P (saved/shared searches) | BUILT-CODE-ONLY | new-app/components/power-dialer/list-detail-content.tsx (saveListFilters) | Per-list named text filters only; no shared searches, advanced search or layouts. |
| Bulk select, add selected contacts to campaign, remove from list, delete contact | K (delete contacts) P (bulk edit) | BUILT-CODE-ONLY | new-app/components/power-dialer/list-detail-content.tsx; ledger: Phase 8 "Done-code" | Ledger marks as Done-code; remove/delete confirms exist. No bulk edit of contact fields. |
| Export list to CSV | P | BUILT-CODE-ONLY | new-app/app/api/phone/power-dialer/lists/[id]/export/route.ts | Export dial sessions or call history to CSV is not built (see Reporting). |
| Add existing contacts to a list | K P J | BUILT-CODE-ONLY | new-app/components/power-dialer/list-detail-content.tsx ("Add contacts") |  |
| Contact tags / merge duplicates (shared Contacts) | P | BUILT-CODE-ONLY | prisma ContactTag, ContactMergeAudit models | Models exist in the shared Contacts layer; not exercised or surfaced in the dialer. |
| Dial list from CRM (import a CRM list into a calling list) | K (HubSpot static list) P J | BUILT-CODE-ONLY | new-app/components/power-dialer/crm-import-dialog.tsx; new-app/lib/server/phone/power-dialer/crm-list-import.ts; new-app/app/api/phone/power-dialer/lists/[id]/import-crm/route.ts | Salesforce, Zoho, Pipedrive only. No CRM connected in test account, so never run. |
| Per-contact campaign history shown to rep (previous attempts, callbacks) | K P J | BUILT-CODE-ONLY | new-app/app/api/phone/power-dialer/campaigns/[id]/contact-history/route.ts; power-dialer-session.tsx | Not live-verified. |

### 3. Campaign rules, retry and scheduling

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Clone campaign | K (PowerList cloning) | BUILT-CODE-ONLY | new-app/components/power-dialer/campaigns-workspace.tsx; new-app/app/api/phone/power-dialer/campaigns/[id]/clone/route.ts |  |
| Retry delay between attempts | K J (Reattempt rules) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/eligibility.ts (retry_delay_active); campaign-config.ts retryIntervalMinutes | Single interval per campaign. |
| Daily attempt cap and total attempt cap | K J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/eligibility.ts (daily_cap_reached, total_cap_reached) | Caps are per contact per campaign. |
| Create a callback from a disposition (persisted, timezone-aware, blocked if contact suppressed) | K (Do Not Call Sooner Than) P (follow-up) J (Schedule Call) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/disposition-effects.ts; callbacks-service.ts | Requires a callback time on the Callback disposition; not enforced as required for custom dispositions. Not live-run. |
| Calling hours enforced per campaign window (days + start/end), server-enforced at dial | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/timezone-window.ts; eligibility.ts (calling_window_closed) | Eligibility count shown live (browser-verified) but no real dial. Out-of-window contacts are deferred, not dialable. |
| Campaign member / team access control (who may dial) | K (Members) J (Assign member) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/campaign-access.ts assertCampaignDialAccess; campaign editor Members tab | Server-enforced for non-admin roles. |
| Campaign lead-source label, owner, duplicate behavior | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/campaign-extended-config.ts |  |

### 4. Dispositions, scripts and outcome actions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Disposition flag: add to DNC (writes contact BLOCKED + internal DNC + audit log) | K P | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/disposition-effects.ts addToDnc; internal-dnc.ts | Idempotent via dispositionEffectsAt. Not exercised on a live call. |
| Disposition flag: schedule callback | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/disposition-effects.ts |  |
| Disposition flag: trigger CRM update (log call, create task via event bus) | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/crm-sync-bridge.ts | Needs a connected CRM; none connected in test account. |
| Skip the outcome screen (auto-disposition) | J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts onPowerDialerCallEnded (requireDisposition off sets Connected/No answer) |  |
| Script shown with merged contact data in the live session | P J | BUILT-CODE-ONLY | new-app/components/phone/power-dialer-session.tsx (scriptRendered via dialer-prep route) | Not live-session verified. |
| Notes during call and after-call work | K P J | BUILT-CODE-ONLY | new-app/components/phone/power-dialer-session.tsx (notes textarea, saved with outcome) |  |
| Dialer-side disposition buttons and timestamps | K P J | BUILT-CODE-ONLY | power-dialer-session.tsx dispositionOptions |  |

### 5. Voicemail drop, AMD and screening

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Voicemail drop library: upload audio or record in browser; preview; archive; default | K P J | BUILT-CODE-ONLY | new-app/components/power-dialer/settings-library-panels.tsx (MediaRecorder + upload); new-app/app/api/phone/power-dialer/voicemail-drops/upload/route.ts | Panel and upload route exist; uploads blocked until opt-in. Dropbox/Google Drive pickers (JustCall) not built. Live use not tested. |
| One-click voicemail drop from the call | K P J | BUILT-CODE-ONLY | new-app/app/api/phone/power-dialer/attempts/[id]/voicemail-drop/route.ts; new-app/lib/server/phone/power-dialer/voicemail-drop-playback.ts (Telnyx playback_start) | Manual only. Risk: dialer UI calls endCall() immediately after the drop is triggered, so whether the audio plays to completion is untested. |
| Human vs machine detection / Auto-classify pickups (AMD) | K (AI Human Detect) J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/answer-detection.ts; new-app/lib/server/phone/calls-service.ts (handles call.machine.* events) | Webhook handler and idempotent event log exist, but the outbound call is a WebRTC newCall with no AMD option (workspace-provider.tsx) and no other AMD request was found, so these events may never fire. mapTelnyxAmdResult also maps premium values human_residence / human_business / silence / fax_detected to "uncertain". |
| Apple call-screening detection and screener classification (Telnyx premium) | — (teardown section 6) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/answer-detection.ts (any result containing "screen" -> screener); number-health and analytics screening counters | Same dormant-path caveat as AMD. Screening analytics and counters exist but depend on events that are not requested. |

### 6. Numbers, caller ID and number health

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Workspace default caller ID; sticky caller ID (no rotation) | P (caller ID consistency) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/caller-id-resolution.ts (campaign -> pool -> workspace default -> campaign e164) | Sticky per campaign+rep, not per contact. |

### 7. Compliance and recording

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| DNC CSV import | P (manual paste/import) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/dnc-csv-import.ts; compliance-settings-panel.tsx | Paste-in textarea import; reports added/skipped/invalid. |
| DNC enforced at dial time (internal DNC, BLOCKED and UNSUBSCRIBED contacts suppressed) | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/eligibility.ts (internal_dnc, contact_blocked, contact_unsubscribed) | Automated tests; never blocked a real dial. Whether an SMS STOP reply sets UNSUBSCRIBED is a shared-messaging behavior not checked here. |
| Compliance acknowledgement required before first session | K (legal disclaimer) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/session-runtime.ts startSessionWithRep; compliance-settings-panel.tsx | Server-enforced gate plus admin acknowledgement button; never exercised through Start. |
| Compliance audit log (DNC add/remove) | — | BUILT-CODE-ONLY | prisma PowerDialerComplianceAuditLog; internal-dnc.ts | Not in teardown; Transovo addition. |
| Recording playback / call detail with recording | K P J | BUILT-CODE-ONLY | new-app/app/app/power-dialer/call-history/[id]/page.tsx; calls-service.ts (recording.saved handling) | Not verified with a real recording. |

### 8. Reporting, analytics and history

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Metrics consistency (no machine/screener counted as human; de-duplicated attempts) | J (metrics glossary) | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/metrics-definitions.ts; test:power-dialer-metrics-consistency | Automated test. |
| Call transcription (Deepgram) after recording saved | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/human-call-transcription.ts | Needs DEEPGRAM_API_KEY; not live-verified. |

### 9. Team, roles and permissions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Role-gated campaign access (admin roles vs assigned reps), server-enforced | K P J | BUILT-CODE-ONLY | new-app/lib/server/phone/power-dialer/campaign-access.ts; authorization test script | Roles come from existing workspace membership (OWNER/ADMINISTRATOR/MANAGER are admins). |

### 11. Integrations, API and extensions

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Native CRM: Salesforce, Zoho, Pipedrive (OAuth connect, import, log calls, create tasks) | K P J | BUILT-CODE-ONLY | new-app/lib/crm/registry.ts; new-app/lib/server/phone/power-dialer/crm-sync-bridge.ts; crm-list-import.ts | Idempotent sync log with success/failure; writeback never tested against a live account. Pipedrive: Kixie and JustCall; Salesforce/Zoho: all three. |

### 12. Plans, billing and packaging

| Feature | Competitors | Transovo status | Evidence | Note |
|---|---|---|---|---|
| Browser microphone / connection readiness checks | P (connection test) | BUILT-CODE-ONLY | new-app/components/power-dialer/overview-content.tsx (webrtcStatus attention item); setup checklist | Readiness appears as an Overview attention/checklist item; no dedicated connection-test tool. |


### C3. Things I checked in code that could undermine a "built" claim

1. **AMD / screening detection probably never fires.** The Telnyx phone webhook handles `call.machine.detection.ended` and `call.machine.premium.detection.ended`, but the outbound leg is `client.newCall({destinationNumber, callerNumber, clientState})` from the browser SDK with no AMD parameter, and I found no other request for AMD. Voicemail vs human classification, screening analytics, Number Health screening rate and the "human conversation" metric therefore depend on events that may never arrive. Needs one controlled test call.
2. **Premium AMD result mapping is incomplete.** `mapTelnyxAmdResult` treats only `human` and `not_sure` as human; the premium values listed in the teardown (`human_residence`, `human_business`, `silence`, `fax_detected`) fall to "uncertain".
3. **Screening settings have no consumer.** Notify rep / skip recognized screener / rep handles / uncertain behavior save to workspace settings, but no runtime code reads them in the files reviewed.
4. **Auto-dial is browser-driven.** Closing or backgrounding the tab stops progression; there is no server-side dialer. Duplicate calls are prevented by idempotency keys.
5. **Voicemail drop may cut itself off.** After triggering the Telnyx playback the dialer immediately calls `endCall()` on the browser leg. Whether the recording plays through is untested.
6. **Recording settings in Power Dialer are not what drives recording.** Recording starts from the global Phone setting `recordCalls`; the Power Dialer recording toggle, consent-announce flag and retention days are stored but not consumed there.
7. **No hard legal calling-hours clamp.** Default window is 09:00-17:00, but any HH:MM window is accepted, and contact timezone is used only if the contact has one (no area-code derivation).
8. **Disposition flags that do nothing.** "Remove from queue" and "mark contact completed" are empty branches; require-notes and trigger-follow-up are not enforced/implemented. Completion relies on hard-coded label names.
9. **Callbacks do not auto-fire.** They are listed with a manual Start call; reschedule/assign exist in the API but not the UI.
10. **"AI summary" is not AI.** It is the first 400 characters of a Deepgram transcript plus a keyword-based hint.
11. **CSV wizard gaps.** No custom-field mapping UI (sends `custom: {}`), no timezone mapping UI, and the result screen always reports "Updated: 0".
12. **Billing.** Power Dialer minutes are real, but the main billing tab is demo data and `/app/billing` 404s.

## Section D. Top 15 gaps, ranked by buyer value (Kixie-style buyer: sales team, speed to lead, connect rate)

1. **Prove the core loop with a real controlled call.** Not a competitor feature, but everything in Section C2 is unproven until a controlled test number call runs end to end (auto-advance, ring timeout, disposition, callback, recording, usage). Also settles whether AMD fires. Needs controlled numbers; no new build.
2. **Local presence and real number pools (K, P, J).** The single biggest connect-rate lever the three agree on. Today: one sticky caller ID, a hidden one-number "pool", no area-code matching, no pool UI. Needs owned numbers across area codes. Never scoped; rotation is excluded by policy, so build matching, not rotation.
3. **Working human/machine detection plus auto-drop after the beep (K, J).** AMD handler exists but is probably not requested on the WebRTC leg and mishandles premium results. Fixing it unlocks voicemail classification, honest human-conversation metrics, auto-drop and the screening features. Auto-drop also needs counsel review on prerecorded messages.
4. **Number reputation and spam monitoring (K Reputation Manager, P ARMOR/Connect Score, J Number Health).** Buyers ask "will my calls get flagged". Needs Telnyx Number Reputation (paid add-on, not provisioned). Cheaper first step: Healthy/Learning/At Risk status from daily volume, and flagged-number alerts.
5. **HubSpot (and HighLevel) integration (K, P, J).** HubSpot is Kixie's deepest CRM (22 articles) and the most common CRM among buyers; Transovo has only Salesforce, Zoho, Pipedrive, none of them ever connected live. Also run a live Salesforce/Pipedrive writeback test.
6. **Disposition-driven automation: SMS, move to list, tag/owner, webhook, cadence (K, P, J).** All three call this the heart of the product ("the list is the product"). Transovo records callbacks, DNC and CRM update only; "remove from queue/completed" flags are no-ops. Includes SMS follow-up from outcome, move-to-list/waterfall (deferred), webhook per outcome.
7. **Outbound webhooks and a public API (add to list, call outcome, call start) (K, P, J).** Table stakes for ops-minded buyers and Zapier-style glue. Nothing exists for customers. Mostly app logic, no external dependency.
8. **Multi-line / parallel dialing with AMD filter (K, J).** Kixie's headline multiplier. Deferred on purpose; requires server-side origination and bridging, AMD, abandonment tracking and the TSR 3% safe harbor, so it depends on items 1 and 3.
9. **Alternate-number fall-through and per-number actions (K, P, J).** Contacts with mobile/work/phone only dial the first valid number. Buyers expect "next number" after no-answer, plus remove/always-use number. Small, app-only change.
10. **In-call controls inside the Dialer: mute, hold, transfer, 3-way, live voicemail (K, P, J).** Mute/hold/transfer exist in the shared softphone but are not in the Dialer panel; 3-way and transfer lists are missing. Expected in any live-selling UI.
11. **Calling-hours correctness: area-code timezone, hard 8 am-9 pm clamp, state overrides (K, P, J).** A compliance trust issue. Today relies on a contact timezone that the CSV wizard cannot set, and accepts any window. App logic only.
12. **National DNC scrub (K add-on, P DNC.com).** No vendor ships it free; PhoneBurner integrates DNC.com. Needs an external provider subscription. Internal DNC is built; add a provider hook or clear guidance.
13. **Callback auto-fire and richer retry (J Scheduled Calls, J reattempt rules, K priority).** Callbacks are only listed with a manual button; no multi-step reattempt rules, no priority, no "Do Not Call Sooner Than". Moves Transovo from list manager to follow-up engine.
14. **Team features: live board, listen/whisper/barge, leaderboards, supervisor role, custom roles (K, P, J).** Deferred (enterprise live salesfloor). Matters when selling to sales teams of 5+, less so to solo users. Needs Telnyx call control for whisper/barge.
15. **Reporting depth and real AI call notes (K, P, J).** Add Disposition Summary, scheduled/emailed reports, CSV export of history/sessions, and a real LLM summary with sentiment/talk ratio; today the "AI summary" is a transcript excerpt. Lower urgency than connect-rate features.

Also worth tracking (lower value): Chrome extension/click-to-call (deferred), mobile apps, dialer presets, Pause-and-Preview extras (skip/SMS), custom CSV field mapping UI, real billing page.

## Section E. Spec requirements and Transovo-only items that are not in the teardown

Included so the list is complete; none of the three competitors documents these as such.
- **Built:** compliance acknowledgement gate before the first session; compliance audit log; idempotent webhooks and call attempts; usage cap that blocks new sessions when included minutes are configured and exhausted; honest Number Health (Transovo metrics labelled separately from carrier reputation); per-campaign member access control.
- **Not built (spec asked, not found):** prerecorded truthful introduction to call screeners; screening runtime behaviors (settings only); per-rep number assignment enforcement; callback destination setting in the campaign editor; Telnyx Number Reputation integration; real billing page.
- **Telnyx-specific research gaps carried from the teardown:** STIR/SHAKEN attestation per number, CNAM and branded calling were never researched or surfaced.
