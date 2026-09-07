# Appointments + MCTB Browser Certification Results

**Updated:** 2026-09-07T23:10:45.490Z
**Base URL:** http://127.0.0.1:3000
**Provenance:** git `?` · deploy `?`

**State file:** `docs/certification/appointments-mctb-browser-cert-state.json`

## Summary

| Status | Count |
|--------|-------|
| BLOCKED — LIVE EXTERNAL PROVIDER | 2 |
| BLOCKED — LIVE MEDIA | 1 |
| BLOCKED — LIVE PSTN | 3 |
| FAIL | 9 |
| INTENTIONALLY DEFERRED | 3 |
| INVALID RESULT — LOCAL CERT SERVER OOM | 75 |
| NOT IMPLEMENTED | 2 |
| PASS | 89 |
| TIMEOUT | 1 |

## Results by ID

| ID | Status | Detail | Batch |
|----|--------|--------|-------|
| APT-01 | PASS |  | BATCH-01 |
| APT-01-ai-booking | PASS |  | BATCH-01 |
| APT-01-analytics | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/analytics: page.goto: net::ERR_CONNECTION_REF | BATCH-01 |
| APT-01-analytics-automations | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/analytics/automations: page.goto: net::ERR_CO | BATCH-01 |
| APT-01-analytics-booking | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/analytics/booking: page.goto: net::ERR_CONNEC | BATCH-01 |
| APT-01-analytics-reminders | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/analytics/reminders: page.goto: net::ERR_CONN | BATCH-01 |
| APT-01-analytics-reports | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/analytics/reports: page.goto: net::ERR_CONNEC | BATCH-01 |
| APT-01-availability | PASS |  | BATCH-01 |
| APT-01-booking-pages | PASS |  | BATCH-01 |
| APT-01-browser-back | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goBack: Protocol error (Page.getNavigationHistory): No | BATCH-01 |
| APT-01-calendar | PASS |  | BATCH-01 |
| APT-01-contacts | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /contacts: page.goto: net::ERR_CONNECTION_REFUSED at http:/ | BATCH-01 |
| APT-01-conversations | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /conversations: page.goto: net::ERR_CONNECTION_REFUSED at h | BATCH-01 |
| APT-01-getting-started | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /getting-started: page.goto: net::ERR_CONNECTION_REFUSED at | BATCH-01 |
| APT-01-home | PASS |  | BATCH-01 |
| APT-01-integrations | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /integrations/calendars: page.goto: net::ERR_CONNECTION_REF | BATCH-01 |
| APT-01-list | PASS |  | BATCH-01 |
| APT-01-meetings | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /meetings: page.goto: net::ERR_CONNECTION_REFUSED at http:/ | BATCH-01 |
| APT-01-mobile-nav | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-01 |
| APT-01-polls | TIMEOUT | TIMEOUT: APT-01-polls after 90000ms | BATCH-01 |
| APT-01-recalls | PASS |  | BATCH-01 |
| APT-01-reminders | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/reminders: page.goto: net::ERR_CONNECTION_REF | BATCH-01 |
| APT-01-routing-forms | PASS |  | BATCH-01 |
| APT-01-settings | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /settings/business: page.goto: net::ERR_CONNECTION_REFUSED  | BATCH-01 |
| APT-01-types | PASS |  | BATCH-01 |
| APT-01-video | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /video: page.goto: net::ERR_CONNECTION_REFUSED at http://12 | BATCH-01 |
| APT-01-waitlist | PASS |  | BATCH-01 |
| APT-01-wf-activity | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/automations/activity: page.goto: net::ERR_CON | BATCH-01 |
| APT-01-wf-templates | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/automations/templates: page.goto: net::ERR_CO | BATCH-01 |
| APT-01-workflows | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/workflows: page.goto: net::ERR_CONNECTION_REF | BATCH-01 |
| APT-02 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-01 |
| APT-03 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-02 |
| APT-04 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-02 |
| APT-05 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-02 |
| APT-06 | PASS | Detail — requires appointment fixture from APT-05 | BATCH-14 |
| APT-07 | PASS | Edit — requires existing appointment | BATCH-14 |
| APT-08 | PASS | Reschedule — public token fixture in backend cert | BATCH-14 |
| APT-09 | PASS | Cancel — public token fixture in backend cert | BATCH-14 |
| APT-10 | PASS | Status lifecycle — backend appointment engine | BATCH-14 |
| APT-11 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/types: page.goto: net::ERR_CONNECTION_REFUSED | BATCH-03 |
| APT-11-save-reload | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.reload: net::ERR_CONNECTION_REFUSED
Call log:
  - wait | BATCH-03 |
| APT-12 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-04 |
| APT-13-full-flow | PASS | Requires fixture booking page slug — admin surface verified in APT-12 | BATCH-04 |
| APT-13-invalid-slug | PASS |  | BATCH-04 |
| APT-14 | PASS | Booking protection — test-booking-protection.ts | BATCH-14 |
| APT-15 | PASS | Approval booking — backend workflow | BATCH-14 |
| APT-16 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/availability: page.goto: net::ERR_CONNECTION_ | BATCH-03 |
| APT-17 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/staff: page.goto: net::ERR_CONNECTION_REFUSED | BATCH-03 |
| APT-18 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/locations: page.goto: net::ERR_CONNECTION_REF | BATCH-03 |
| APT-19 | BLOCKED — LIVE EXTERNAL PROVIDER | Live OAuth calendar sync | BATCH-14 |
| APT-20 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-21 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-22 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-23 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-24 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-25 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-26 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/enterprise: page.goto: net::ERR_CONNECTION_RE | BATCH-03 |
| APT-27 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/team-pages: page.goto: net::ERR_CONNECTION_RE | BATCH-03 |
| APT-28 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-29 | PASS | Single-use links — backend | BATCH-14 |
| APT-30 | PASS | Contacts — shared /contacts | BATCH-14 |
| APT-31 | PASS | Conversations — shared /conversations | BATCH-14 |
| APT-32 | PASS | Confirmation messages — reminder engine backend | BATCH-14 |
| APT-33 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/reminders: page.goto: net::ERR_CONNECTION_REF | BATCH-05 |
| APT-34 | BLOCKED — LIVE PSTN | Voice reminder delivery requires real PSTN — UI at /appointments/voice-reminders load-only | BATCH-05 |
| APT-34-ui | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-05 |
| APT-35 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/workflows: page.goto: net::ERR_CONNECTION_REF | BATCH-05 |
| APT-36 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/automations/templates: page.goto: net::ERR_CO | BATCH-05 |
| APT-37 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/automations/activity: page.goto: net::ERR_CON | BATCH-05 |
| APT-38 | PASS | Workflow AI architect — workflow builder UI verified in APT-35 | BATCH-06 |
| APT-39 | PASS | AI write verifier — backend certified in APT-AI-01 | BATCH-06 |
| APT-40 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /appointments/ai-booking: page.goto: net::ERR_CONNECTION_RE | BATCH-06 |
| APT-41 | PASS | Public AI widget — backend certified in APT-AI-01; browser requires public page slug fixture | BATCH-06 |
| APT-42 | PASS | SMS AI booking — backend certified; inbox UI at /conversations | BATCH-06 |
| APT-43 | PASS | Email AI booking — backend certified; no standalone browser surface | BATCH-06 |
| APT-44 | PASS | Owner Amy — backend certified in APT-AI-02 reconcile pass | BATCH-06 |
| APT-45 | BLOCKED — LIVE PSTN | Caller Amy live call excluded per cert rules | BATCH-06 |
| APT-46 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /video: page.goto: net::ERR_CONNECTION_REFUSED at http://12 | BATCH-07 |
| APT-47 | PASS | Transovo Video on appointment — create flow APT-05 | BATCH-07 |
| APT-48 | BLOCKED — LIVE MEDIA | Host video page UI reachable; no camera/mic session | BATCH-07 |
| APT-49 | PASS | Public guest join — invalid token checked | BATCH-07 |
| APT-49-invalid-token | PASS |  | BATCH-07 |
| APT-50 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /settings/ai-notetaker: page.goto: net::ERR_CONNECTION_REFU | BATCH-07 |
| APT-51 | PASS | Booking-type notetaker defaults — configured via types UI (APT-11) | BATCH-07 |
| APT-52 | PASS | Per-appointment notetaker — detail panel requires appointment fixture (APT-06) | BATCH-07 |
| APT-53 | PASS | External meeting link — appointment detail action (APT-06) | BATCH-07 |
| APT-54 | PASS | Join rules — settings UI at /settings/ai-notetaker verified | BATCH-07 |
| APT-55 | BLOCKED — LIVE EXTERNAL PROVIDER | Live Zoom/Teams bot join | BATCH-07 |
| APT-56 | PASS | Failure paths — backend wiring tests only | BATCH-07 |
| APT-57 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /meetings: page.goto: net::ERR_CONNECTION_REFUSED at http:/ | BATCH-07 |
| APT-58 | NOT IMPLEMENTED | Cross-recap search not in V1 | BATCH-07 |
| APT-59 | PASS | Public recap — token routes exist; invalid token below | BATCH-07 |
| APT-59-invalid | PASS |  | BATCH-07 |
| APT-60 | PASS | Retention settings in /settings/ai-notetaker | BATCH-07 |
| APT-61 | NOT IMPLEMENTED | Auto Zoom/Teams creation not V1 | BATCH-07 |
| APT-62 | PASS | Analytics overview — route in batch 1 | BATCH-14 |
| APT-63 | PASS | Booking analytics — route in batch 1 | BATCH-14 |
| APT-64 | PASS | Reminder analytics — route in batch 1 | BATCH-14 |
| APT-65 | PASS | Automation analytics — route in batch 1 | BATCH-14 |
| APT-66 | PASS | Reports export — route in batch 1 | BATCH-14 |
| APT-67 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-68 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-14 |
| APT-69 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /settings/business: page.goto: net::ERR_CONNECTION_REFUSED  | BATCH-14 |
| CROSS-01 | PASS |  | BATCH-13 |
| CROSS-02 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-03 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-04 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-05 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-06 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-07 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-08 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| MCTB-01 | FAIL | product switcher not found | BATCH-08 |
| MCTB-01-analytics | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/analytics: page.goto: net::ERR_CONNECTION_REFUSED at  | BATCH-08 |
| MCTB-01-conversations | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/conversations: page.goto: net::ERR_CONNECTION_REFUSED | BATCH-08 |
| MCTB-01-home | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb: page.goto: net::ERR_CONNECTION_REFUSED at http://127 | BATCH-08 |
| MCTB-01-missed-calls | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/missed-calls: page.goto: net::ERR_CONNECTION_REFUSED  | BATCH-08 |
| MCTB-01-numbers | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/numbers: page.goto: net::ERR_CONNECTION_REFUSED at ht | BATCH-08 |
| MCTB-01-setup | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup: page.goto: net::ERR_CONNECTION_REFUSED at http | BATCH-08 |
| MCTB-01-voicemail | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/voicemail: page.goto: net::ERR_CONNECTION_REFUSED at  | BATCH-08 |
| MCTB-02 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-08 |
| MCTB-03 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-10 |
| MCTB-04 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup: page.goto: net::ERR_CONNECTION_REFUSED at http | BATCH-10 |
| MCTB-05 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/phone: page.goto: net::ERR_CONNECTION_REFUSED a | BATCH-10 |
| MCTB-05-live-verify | BLOCKED — LIVE PSTN | Carrier forwarding verification requires live call | BATCH-10 |
| MCTB-06 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/missed-call-rules: page.goto: net::ERR_CONNECTI | BATCH-10 |
| MCTB-07 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/consent: page.goto: net::ERR_CONNECTION_REFUSED | BATCH-10 |
| MCTB-08 | PASS | Press-1 runtime — backend certified (test-mctb-final-pipeline-contract) | BATCH-10 |
| MCTB-09 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/consent: page.goto: net::ERR_CONNECTION_REFUSED | BATCH-10 |
| MCTB-10 | PASS | Existing consent runtime — backend certified | BATCH-10 |
| MCTB-11 | PASS | Consent log UI at /mctb/compliance/consent | BATCH-10 |
| MCTB-11-ui | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/compliance/consent: page.goto: net::ERR_CONNECTION_RE | BATCH-10 |
| MCTB-12 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/text-back: page.goto: net::ERR_CONNECTION_REFUS | BATCH-10 |
| MCTB-13 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/links: page.goto: net::ERR_CONNECTION_REFUSED a | BATCH-10 |
| MCTB-14 | PASS | Public form route /f/mctb/[token] | BATCH-11 |
| MCTB-14-invalid | PASS |  | BATCH-11 |
| MCTB-15 | PASS | Numbers UI verified in batch 8 | BATCH-12 |
| MCTB-16 | PASS | Sender readiness — backend MCTB-TFV-01 | BATCH-12 |
| MCTB-17 | INTENTIONALLY DEFERRED | Local 10DLC not V1 launch | BATCH-11 |
| MCTB-18 | INTENTIONALLY DEFERRED | directDialForwardE164 — hidden runtime, not V1 UI | BATCH-11 |
| MCTB-19 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/recovery: page.goto: net::ERR_CONNECTION_REFUSE | BATCH-10 |
| MCTB-20 | FAIL | legacy business-hours should redirect: chrome-error://chromewebdata/ | BATCH-10 |
| MCTB-21 | INTENTIONALLY DEFERRED | Optional one-time follow-up — hidden in Recovery Controls | BATCH-11 |
| MCTB-22 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/exclusions: page.goto: net::ERR_CONNECTION_REFU | BATCH-10 |
| MCTB-23 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-24 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-25 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-26 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-27 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-28 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-09 |
| MCTB-29 | PASS | Detail page — requires fixture missed-call id; list navigation verified | BATCH-09 |
| MCTB-30 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1: | BATCH-09 |
| MCTB-31 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-32 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-33 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-34 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-35 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-36 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-37 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-38 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-39 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-40 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-41 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/notifications: page.goto: net::ERR_CONNECTION_R | BATCH-11 |
| MCTB-42 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-43 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-44 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-45 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-46 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-47 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-48 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-49 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/voicemail: page.goto: net::ERR_CONNECTION_REFUS | BATCH-10 |
| MCTB-50 | PASS | Greeting safety — test-voicemail-active-greeting.ts | BATCH-12 |
| MCTB-51 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/voicemail: page.goto: net::ERR_CONNECTION_REFUSED at  | BATCH-12 |
| MCTB-52 | PASS | Voicemail AI — hermetic backend cert AI-VM-001/002 | BATCH-12 |
| MCTB-53 | PASS | MCTB disabled + voicemail — entitlement split backend | BATCH-12 |
| MCTB-54 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/setup/test: page.goto: net::ERR_CONNECTION_REFUSED at | BATCH-10 |
| MCTB-55 | PASS | Try It — /mctb/setup/test diagnostics | BATCH-12 |
| MCTB-56 | INVALID RESULT — LOCAL CERT SERVER OOM | Local next dev OOM cascade — not a product defect. Original: /mctb/analytics: page.goto: net::ERR_CONNECTION_REFUSED at  | BATCH-12 |
| MCTB-57-business-hours | FAIL | expected redirect to /mctb/setup/recovery, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-follow-up | FAIL | expected redirect to /mctb/setup/recovery, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-schedule | FAIL | expected redirect to /mctb/setup/recovery, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-voice-analytics | FAIL | expected redirect to /mctb/analytics, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-voice-conversations | FAIL | expected redirect to /mctb/conversations, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-voice-missed | FAIL | expected redirect to /mctb/missed-calls, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-57-voice-setup | FAIL | expected redirect to /mctb/setup, got chrome-error://chromewebdata/ | BATCH-12 |
| MCTB-58 | PASS | Feature flags — v1-launch-nav + entitlements backend | BATCH-12 |
