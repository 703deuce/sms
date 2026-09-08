# Browser Flow Classification Audit

**Generated:** 2026-09-08T00:17:34.842Z
**Reachability flows (supplementary):** 59
**Go-live cert groups:** 139
**Total flows:** 198

## Executive summary

The prior **170 PASS** result was **not** 170 full customer journeys. It was mostly route/render checks and backend-static passes recorded without browser interaction.

### Classification counts (baseline 189)

| Classification | Count | Meaning |
|----------------|-------|---------|
| ROUTE/RENDER CHECK ONLY | 57 | Page loads, redirects, shell, control-exists — **not sufficient alone** for customer-operable features |
| BACKEND/STATIC ONLY | 2 | No browser; backend/script certification |
| TRUE USER-ACTION FLOW | 139 | Go-live cert groups (APT/MCTB/CROSS/GLOBAL) |

### Last run PASS breakdown (from state file)

| Classification | PASS count |
|----------------|------------|
| ROUTE/RENDER | 51 |
| BACKEND/STATIC | 1 |
| TRUE USER-ACTION | 118 |
| **Total PASS** | **170** |

**True user-journey PASS in last run: 118** (target: all customer-operable features)

### Go-live cert group coverage

- Cert groups in manifest: **139**
- Cert groups with dedicated runners: **127** (approx)
- Cert groups missing dedicated runner (fallback route save): **0**
- Blocked/deferred groups (no false PASS): **12**

## Required interaction standard

See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md`.

PASS for go-live requires the **cert group** PASS (APT-05, MCTB-47, etc.) — not reachability-only.

## Full inventory

| ID | Batch | Classification | Tier | Customer operable | Needs UA | UA flow | Last status | Notes |
|----|-------|----------------|------|-------------------|----------|---------|-------------|-------|
| APT-01 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Product navigation |
| APT-01-ai-booking | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-analytics | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-analytics-automations | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-analytics-booking | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-analytics-reminders | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-analytics-reports | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-availability | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-16-availability | PASS |  |
| APT-01-booking-pages | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-12-booking-pages | PASS |  |
| APT-01-browser-back | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | FAIL | Back nav context |
| APT-01-calendar | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-03-calendar | PASS |  |
| APT-01-contacts | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-conversations | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-getting-started | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-home | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-01-integrations | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-list | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-04-list | PASS |  |
| APT-01-meetings | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-mobile-nav | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS | Viewport only |
| APT-01-polls | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-recalls | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-reminders | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-33-reminders | PASS |  |
| APT-01-routing-forms | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-20-routing-forms | PASS |  |
| APT-01-settings | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-types | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-11-types | PASS |  |
| APT-01-video | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-waitlist | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | UA-APT-22-waitlist | PASS |  |
| APT-01-wf-activity | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-wf-templates | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-01-workflows | BATCH-01 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-02 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointments Home |
| APT-03 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Calendar |
| APT-04 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment List |
| APT-05 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Manual Appointment Creation |
| APT-05-form-visible | BATCH-02 | ROUTE_RENDER | reachability | no | no | — | — | Unmapped browser flow — default route/render |
| APT-06 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment Detail |
| APT-07 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Edit Appointment |
| APT-08 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Reschedule |
| APT-09 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Cancellation |
| APT-10 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment Status Lifecycle |
| APT-11 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Booking Types |
| APT-11-save-reload | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-11-types | PASS | Focus save + reload — no actual save |
| APT-12 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Public Booking Pages |
| APT-13 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | — | Full Public Booking Flow |
| APT-13-full-flow | BATCH-04 | BACKEND_STATIC | static | yes | yes | UA-APT-13-public-book | PASS |  |
| APT-13-invalid-slug | BATCH-04 | ROUTE_RENDER | reachability | no | no | — | FAIL | Public error state |
| APT-14 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Booking Protection |
| APT-15 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Approval-Based Booking |
| APT-16 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Availability |
| APT-17 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Staff |
| APT-18 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Locations |
| APT-19 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | BLOCKED — LIVE EXTERNAL PROVIDER | External Calendar Blocking |
| APT-20 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Routing Forms |
| APT-21 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Routing Rules |
| APT-22 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Waitlist |
| APT-23 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Recalls |
| APT-24 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Recall Campaigns |
| APT-25 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | No-Show Recovery |
| APT-26 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Scheduling Groups / Enterprise |
| APT-27 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Team Booking Pages |
| APT-28 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Meeting Polls |
| APT-29 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Single-Use Links |
| APT-30 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Contacts |
| APT-31 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Conversations |
| APT-32 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Confirmation Messages |
| APT-33 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Reminder Sequences |
| APT-34 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | BLOCKED — LIVE PSTN | Voice Reminder Configuration |
| APT-34-ui | BATCH-05 | ROUTE_RENDER | reachability | yes | no | — | PASS | Load-only; PSTN blocked |
| APT-35 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Workflow Builder |
| APT-36 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Workflow Templates |
| APT-37 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Workflow Activity |
| APT-38 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Workflow AI Architect |
| APT-39 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | AI Write Verifier |
| APT-40 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | AI Booking Settings |
| APT-41 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Public AI Booking |
| APT-42 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | SMS AI Booking |
| APT-43 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Email AI Booking |
| APT-44 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Owner Amy |
| APT-45 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | BLOCKED — LIVE PSTN | Caller Amy |
| APT-46 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Transovo Video Settings |
| APT-47 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Transovo Video Appointment Creation |
| APT-48 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | BLOCKED — LIVE MEDIA | Transovo Video Host |
| APT-49 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Public Video Guest Join |
| APT-49-invalid-token | BATCH-07 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-50 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | AI Notetaker Global Settings |
| APT-51 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notetaker Booking-Type Defaults |
| APT-52 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Per-Appointment Notetaker |
| APT-53 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | External Meeting Link + Notetaker |
| APT-54 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notetaker Join Rules |
| APT-55 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | BLOCKED — LIVE EXTERNAL PROVIDER | Notetaker Meeting Lifecycle |
| APT-56 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notetaker Failure Paths |
| APT-57 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Meeting Recaps |
| APT-58 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | NOT IMPLEMENTED | Searchable Meeting Notes |
| APT-59 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Public Recap Sharing |
| APT-59-invalid | BATCH-07 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-60 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notetaker Retention |
| APT-61 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | NOT IMPLEMENTED | Automatic External Meeting Creation |
| APT-62 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment Analytics Overview |
| APT-63 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Booking Analytics |
| APT-64 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Reminder Analytics |
| APT-65 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Automation Analytics |
| APT-66 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Reports / Export |
| APT-67 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment Setup Wizard |
| APT-68 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment Integrations Hub |
| APT-69 | CERT-APT | TRUE_USER_ACTION | cert-group | yes | no | — | — | Appointment Settings |
| APT-69-business | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-69-calendar | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-69-messaging | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| CROSS-01 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | — | Product Switching |
| CROSS-01-appointments | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-01-back | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-01-mctb | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-02 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Shared Contacts |
| CROSS-03 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Shared Conversations |
| CROSS-04 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | MCTB Booking Attribution |
| CROSS-05 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | MCTB Booking → Appointment Reminder Lifecycle |
| CROSS-06 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Appointment → AI Notetaker → Recap |
| CROSS-07 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Transovo Video → AI Notetaker |
| CROSS-08 | CERT-CROSS | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | External Video → AI Notetaker |
| GLOBAL-01 | CERT-GLOBAL | TRUE_USER_ACTION | cert-group | yes | no | — | — | Global frontend UI quality pass |
| GLOBAL-02 | CERT-GLOBAL | TRUE_USER_ACTION | cert-group | yes | no | — | — | Public token / link safety |
| GLOBAL-03 | CERT-GLOBAL | TRUE_USER_ACTION | cert-group | yes | no | — | — | Time / timezone certification |
| GLOBAL-04 | CERT-GLOBAL | TRUE_USER_ACTION | cert-group | yes | no | — | — | Duplicate / retry certification |
| MCTB-01 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Product navigation |
| MCTB-01-analytics | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-01-conversations | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-30-conversations | PASS |  |
| MCTB-01-home | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-01-missed-calls | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-28-missed-calls | PASS |  |
| MCTB-01-numbers | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| MCTB-01-setup | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-04-setup | PASS |  |
| MCTB-01-voicemail | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-51-voicemail | PASS |  |
| MCTB-02 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Home |
| MCTB-03 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Guided Setup Wizard |
| MCTB-04 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Setup Overview |
| MCTB-05 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Phone & Forwarding |
| MCTB-05-live-verify | BATCH-10 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE PSTN | BLOCKED — LIVE PSTN |
| MCTB-06 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Missed Call Rules |
| MCTB-07 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Consent: Press 1 Configuration |
| MCTB-08 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Press 1 Runtime Sequence |
| MCTB-09 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Existing Consent Configuration |
| MCTB-10 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Existing Consent Runtime |
| MCTB-11 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Consent Log |
| MCTB-11-ui | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-11-consent-log | PASS |  |
| MCTB-12 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Text Back Settings |
| MCTB-13 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | FAIL | Request Form & Default Link Setup |
| MCTB-14 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Public Request Form |
| MCTB-14-invalid | BATCH-11 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-15 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Numbers |
| MCTB-16 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Toll-Free Verification / Sender Readiness |
| MCTB-17 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | INTENTIONALLY DEFERRED | Local 10DLC Sender |
| MCTB-18 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | INTENTIONALLY DEFERRED | Dedicated Text Number Voice Behavior |
| MCTB-19 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Recovery Controls |
| MCTB-20 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | FAIL | Schedule/Legacy Compatibility |
| MCTB-21 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | INTENTIONALLY DEFERRED | Optional One-Time Follow-Up |
| MCTB-22 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Exclusions |
| MCTB-23 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | STOP / HELP |
| MCTB-24 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Core Recovery Pipeline |
| MCTB-25 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Recovery Delay |
| MCTB-26 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Eligibility Engine |
| MCTB-27 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Repeat Caller |
| MCTB-28 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Missed Calls List |
| MCTB-29 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Missed Call Detail |
| MCTB-30 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Conversations |
| MCTB-31 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notify-Only Mode |
| MCTB-32 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Guided Collection Mode |
| MCTB-33 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | AI Conversation Mode |
| MCTB-34 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Immediate Handoff Mode |
| MCTB-35 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Lead Fields |
| MCTB-36 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Emergency Detection Off |
| MCTB-37 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Emergency Detection On |
| MCTB-38 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Emergency Uncertainty |
| MCTB-39 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Callback Requests |
| MCTB-40 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Human Takeover |
| MCTB-41 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | FAIL | Notifications Recipients |
| MCTB-42 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notification Routing Matrix |
| MCTB-43 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notification Quiet Hours |
| MCTB-44 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Notification Delivery |
| MCTB-45 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Lead Handoff Summary |
| MCTB-46 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Booking Behavior |
| MCTB-47 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | MCTB → Appointment Booking |
| MCTB-48 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Tracked Links |
| MCTB-49 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Voicemail Setup |
| MCTB-50 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Voicemail Greeting Replacement Safety |
| MCTB-51 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Visual Voicemail Inbox |
| MCTB-52 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Voicemail AI |
| MCTB-53 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | MCTB Disabled / Voicemail Active |
| MCTB-54 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Test & Diagnostics |
| MCTB-55 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Try It / Demo |
| MCTB-56 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | MCTB Analytics |
| MCTB-57 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | — | Legacy Redirects |
| MCTB-57-business-hours | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-follow-up | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-schedule | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-analytics | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-conversations | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-voice-missed | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-setup | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-58 | CERT-MCTB | TRUE_USER_ACTION | cert-group | yes | no | — | PASS | Feature Flags / Entitlements |

## Unmapped flows (needs classification entry)

- APT-05-form-visible
