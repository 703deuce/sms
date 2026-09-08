# Browser Flow Classification Audit

**Generated:** 2026-09-08T00:06:21.926Z
**Baseline reachability flows:** 189
**User-action flows (BATCH-UA):** 12
**Total flows:** 201

## Executive summary

The prior **170 PASS** result was **not** 170 full customer journeys. It was mostly route/render checks and backend-static passes recorded without browser interaction.

### Classification counts (baseline 189)

| Classification | Count | Meaning |
|----------------|-------|---------|
| ROUTE/RENDER CHECK ONLY | 105 | Page loads, redirects, shell, control-exists — **not sufficient alone** for customer-operable features |
| BACKEND/STATIC ONLY | 84 | No browser; backend/script certification |
| TRUE USER-ACTION FLOW | 12 | In baseline: **0**. New BATCH-UA adds 12 |

### Last run PASS breakdown (from state file)

| Classification | PASS count |
|----------------|------------|
| ROUTE/RENDER | 97 |
| BACKEND/STATIC | 73 |
| TRUE USER-ACTION | 0 |
| **Total PASS** | **170** |

**True user-journey PASS in last run: 0** (target: all customer-operable features)

### Customer-operable coverage gap

- Customer-operable features in baseline: **161**
- Need companion user-action flow: **136**
- User-action flows implemented (BATCH-UA): **12**
- Planned UA flow IDs not yet implemented: **28**

## Required interaction standard

See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md`.

PASS for a customer-operable feature requires **both**:

1. Reachability flow PASS (page reachable)
2. User-action flow PASS (click → type → submit → verify → refresh → persist)

## Full inventory

| ID | Batch | Classification | Tier | Customer operable | Needs UA | UA flow | Last status | Notes |
|----|-------|----------------|------|-------------------|----------|---------|-------------|-------|
| APT-01 | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS | Shell smoke |
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
| APT-02 | BATCH-01 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-03 | BATCH-02 | ROUTE_RENDER | reachability | yes | yes | UA-APT-03-calendar | PASS | Today/Next clicks only — no persistence |
| APT-04 | BATCH-02 | ROUTE_RENDER | reachability | yes | yes | UA-APT-04-list | PASS | Search fill only — no filter persist |
| APT-05 | BATCH-02 | ROUTE_RENDER | reachability | yes | yes | UA-APT-05-create | PASS | Form visible — does not create |
| APT-06 | BATCH-14 | BACKEND_STATIC | static | yes | yes | UA-APT-06-detail | PASS |  |
| APT-07 | BATCH-14 | BACKEND_STATIC | static | yes | yes | UA-APT-07-edit | PASS |  |
| APT-08 | BATCH-14 | BACKEND_STATIC | static | yes | yes | UA-APT-08-reschedule | PASS |  |
| APT-09 | BATCH-14 | BACKEND_STATIC | static | yes | yes | UA-APT-09-cancel | PASS |  |
| APT-10 | BATCH-14 | BACKEND_STATIC | static | yes | yes | UA-APT-10-status | PASS |  |
| APT-11 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-11-types | PASS |  |
| APT-11-save-reload | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-11-types | PASS | Focus save + reload — no actual save |
| APT-12 | BATCH-04 | ROUTE_RENDER | reachability | yes | yes | UA-APT-12-booking-pages | PASS |  |
| APT-13-full-flow | BATCH-04 | BACKEND_STATIC | static | yes | yes | UA-APT-13-public-book | PASS |  |
| APT-13-invalid-slug | BATCH-04 | ROUTE_RENDER | reachability | no | no | — | FAIL | Public error state |
| APT-14 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-15 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-16 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-16-availability | PASS |  |
| APT-17 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-17-staff | PASS |  |
| APT-18 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | UA-APT-18-locations | PASS |  |
| APT-19 | BATCH-14 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE EXTERNAL PROVIDER | BLOCKED — LIVE EXTERNAL PROVIDER |
| APT-20 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | UA-APT-20-routing-forms | PASS |  |
| APT-21 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-22 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | UA-APT-22-waitlist | PASS |  |
| APT-23 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-24 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-25 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-26 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-27 | BATCH-03 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-28 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-29 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-30 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-31 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-32 | BATCH-14 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-33 | BATCH-05 | ROUTE_RENDER | reachability | yes | yes | UA-APT-33-reminders | PASS |  |
| APT-34 | BATCH-05 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE PSTN | BLOCKED — LIVE PSTN |
| APT-34-ui | BATCH-05 | ROUTE_RENDER | reachability | yes | no | — | PASS | Load-only; PSTN blocked |
| APT-35 | BATCH-05 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-36 | BATCH-05 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-37 | BATCH-05 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-38 | BATCH-06 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-39 | BATCH-06 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-40 | BATCH-06 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-41 | BATCH-06 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-42 | BATCH-06 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-43 | BATCH-06 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-44 | BATCH-06 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-45 | BATCH-06 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE PSTN | BLOCKED — LIVE PSTN |
| APT-46 | BATCH-07 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-47 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-05-create | PASS |  |
| APT-48 | BATCH-07 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE MEDIA | BLOCKED — LIVE MEDIA |
| APT-49 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-49-guest-join | PASS |  |
| APT-49-invalid-token | BATCH-07 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-50 | BATCH-07 | ROUTE_RENDER | reachability | yes | yes | UA-APT-50-notetaker | PASS |  |
| APT-51 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-11-types | PASS |  |
| APT-52 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-52-notetaker-appt | PASS |  |
| APT-53 | BATCH-07 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| APT-54 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-50-notetaker | PASS |  |
| APT-55 | BATCH-07 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE EXTERNAL PROVIDER | BLOCKED — LIVE EXTERNAL PROVIDER |
| APT-56 | BATCH-07 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-57 | BATCH-07 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-58 | BATCH-07 | BACKEND_STATIC | static | yes | yes | — | NOT IMPLEMENTED |  |
| APT-59 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-59-recap | PASS |  |
| APT-59-invalid | BATCH-07 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| APT-60 | BATCH-07 | BACKEND_STATIC | static | yes | yes | UA-APT-50-notetaker | PASS |  |
| APT-61 | BATCH-07 | BACKEND_STATIC | static | yes | no | — | NOT IMPLEMENTED | NOT IMPLEMENTED |
| APT-62 | BATCH-14 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-63 | BATCH-14 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-64 | BATCH-14 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-65 | BATCH-14 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-66 | BATCH-14 | BACKEND_STATIC | static | no | no | — | PASS |  |
| APT-67 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-68 | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-69-business | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-69-calendar | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| APT-69-messaging | BATCH-14 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| CROSS-01-appointments | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-01-back | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-01-mctb | BATCH-13 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell |
| CROSS-02 | BATCH-13 | BACKEND_STATIC | static | yes | yes | UA-CROSS-02-mctb-booking | PASS |  |
| CROSS-03 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| CROSS-04 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| CROSS-05 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| CROSS-06 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| CROSS-07 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| CROSS-08 | BATCH-13 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-01 | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS | Product shell switch |
| MCTB-01-analytics | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-01-conversations | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-30-conversations | PASS |  |
| MCTB-01-home | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-01-missed-calls | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-28-missed-calls | PASS |  |
| MCTB-01-numbers | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | — | PASS |  |
| MCTB-01-setup | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-04-setup | PASS |  |
| MCTB-01-voicemail | BATCH-08 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-51-voicemail | PASS |  |
| MCTB-02 | BATCH-08 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-03 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-03-wizard | PASS |  |
| MCTB-04 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-04-setup | PASS |  |
| MCTB-05 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-05-phone | PASS |  |
| MCTB-05-live-verify | BATCH-10 | BACKEND_STATIC | static | yes | no | — | BLOCKED — LIVE PSTN | BLOCKED — LIVE PSTN |
| MCTB-06 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-06-rules | PASS |  |
| MCTB-07 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-07-consent | PASS |  |
| MCTB-08 | BATCH-10 | BACKEND_STATIC | static | yes | no | — | PASS | Press-1 runtime — backend certified |
| MCTB-09 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-07-consent | PASS |  |
| MCTB-10 | BATCH-10 | BACKEND_STATIC | static | yes | no | — | PASS | Existing consent runtime — backend certified |
| MCTB-11 | BATCH-10 | BACKEND_STATIC | static | yes | yes | UA-MCTB-11-consent-log | PASS |  |
| MCTB-11-ui | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-11-consent-log | PASS |  |
| MCTB-12 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-12-textback | PASS |  |
| MCTB-13 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-13-links | FAIL |  |
| MCTB-14 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-14-public-form | PASS |  |
| MCTB-14-invalid | BATCH-11 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-15 | BATCH-12 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-16 | BATCH-12 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-17 | BATCH-11 | BACKEND_STATIC | static | yes | no | — | INTENTIONALLY DEFERRED | INTENTIONALLY DEFERRED |
| MCTB-18 | BATCH-11 | BACKEND_STATIC | static | yes | no | — | INTENTIONALLY DEFERRED | INTENTIONALLY DEFERRED |
| MCTB-19 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-19-recovery | PASS |  |
| MCTB-20 | BATCH-10 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-21 | BATCH-11 | BACKEND_STATIC | static | yes | no | — | INTENTIONALLY DEFERRED | INTENTIONALLY DEFERRED |
| MCTB-22 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-22-exclusions | PASS |  |
| MCTB-23 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-41-notifications | PASS |  |
| MCTB-24 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-41-notifications | PASS |  |
| MCTB-25 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-41-notifications | PASS |  |
| MCTB-26 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-41-notifications | PASS |  |
| MCTB-27 | BATCH-11 | BACKEND_STATIC | static | yes | yes | UA-MCTB-41-notifications | PASS |  |
| MCTB-28 | BATCH-09 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-28-missed-calls | PASS | List/table presence only |
| MCTB-29 | BATCH-09 | BACKEND_STATIC | static | yes | yes | UA-MCTB-29-detail | PASS |  |
| MCTB-30 | BATCH-09 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-30-conversations | PASS | Inbox body text only |
| MCTB-31 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-32 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-33 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-34 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-35 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-36 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-37 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-38 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-39 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-40 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-41 | BATCH-11 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-41-notifications | FAIL |  |
| MCTB-42 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-43 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-44 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-45 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-46 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-47 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-48 | BATCH-11 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-49 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-49-voicemail-setup | PASS |  |
| MCTB-50 | BATCH-12 | BACKEND_STATIC | static | yes | yes | UA-MCTB-49-voicemail-setup | PASS |  |
| MCTB-51 | BATCH-12 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-51-voicemail | PASS |  |
| MCTB-52 | BATCH-12 | BACKEND_STATIC | static | yes | yes | UA-MCTB-51-voicemail | PASS |  |
| MCTB-53 | BATCH-12 | BACKEND_STATIC | static | yes | yes | — | PASS |  |
| MCTB-54 | BATCH-10 | ROUTE_RENDER | reachability | yes | yes | UA-MCTB-54-test | PASS |  |
| MCTB-55 | BATCH-12 | BACKEND_STATIC | static | yes | yes | UA-MCTB-54-test | PASS |  |
| MCTB-56 | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS |  |
| MCTB-57-business-hours | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-follow-up | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-schedule | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-analytics | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-conversations | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | FAIL | Legacy redirect |
| MCTB-57-voice-missed | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-57-voice-setup | BATCH-12 | ROUTE_RENDER | reachability | no | no | — | PASS | Legacy redirect |
| MCTB-58 | BATCH-12 | BACKEND_STATIC | static | no | no | — | PASS |  |
| UA-APT-05-create | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Create appointment through UI |
| UA-APT-07-edit | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Edit appointment notes and verify persistence |
| UA-APT-09-cancel | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Cancel appointment through UI |
| UA-APT-11-types | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Create booking type and verify persistence |
| UA-APT-13-public-book | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Complete public booking through UI |
| UA-APT-16-availability | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Change availability hours and verify persistence |
| UA-APT-33-reminders | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Edit reminder template and verify persistence |
| UA-APT-50-notetaker | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | Change AI Notetaker setting and verify persistence |
| UA-MCTB-05-phone | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | MCTB Phone & Forwarding save and reload |
| UA-MCTB-07-consent | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | MCTB Consent mode save and reload |
| UA-MCTB-12-textback | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | MCTB Text Back opener save and reload |
| UA-MCTB-41-notifications | BATCH-UA | TRUE_USER_ACTION | user-action | yes | no | — | — | MCTB Notifications & Handoff save and reload |

## Planned user-action flows not yet implemented

- UA-APT-03-calendar
- UA-APT-04-list
- UA-APT-22-waitlist
- UA-APT-12-booking-pages
- UA-APT-20-routing-forms
- UA-APT-17-staff
- UA-APT-18-locations
- UA-APT-49-guest-join
- UA-APT-52-notetaker-appt
- UA-APT-59-recap
- UA-MCTB-28-missed-calls
- UA-MCTB-30-conversations
- UA-MCTB-51-voicemail
- UA-MCTB-04-setup
- UA-MCTB-29-detail
- UA-MCTB-06-rules
- UA-MCTB-13-links
- UA-MCTB-19-recovery
- UA-MCTB-22-exclusions
- UA-MCTB-49-voicemail-setup
- UA-MCTB-54-test
- UA-MCTB-03-wizard
- UA-MCTB-11-consent-log
- UA-MCTB-14-public-form
- UA-CROSS-02-mctb-booking
- UA-APT-06-detail
- UA-APT-08-reschedule
- UA-APT-10-status
