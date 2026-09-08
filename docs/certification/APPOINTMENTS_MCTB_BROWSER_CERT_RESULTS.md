# Appointments + MCTB Browser Certification Results

**Updated:** 2026-09-08T01:04:20.974Z
**Base URL:** `scripts/browser-cert/browser-cert.config.ts` → previewBaseUrl
**Provenance:** git `2a0de8d749930686ba18b80205b49de80e3abdd3` · deploy `unknown`

**State file:** `docs/certification/appointments-mctb-browser-cert-state.json`
**Mode:** disposable-browser (198/198 flows checkpointed)

## Summary

| Status | Count |
|--------|-------|
| /contacts | 1 |
| /conversations | 1 |
| BLOCKED — LIVE EXTERNAL PROVIDER | 3 |
| BLOCKED — LIVE MEDIA | 1 |
| BLOCKED — LIVE PSTN | 2 |
| FAIL | 56 |
| INTENTIONALLY DEFERRED | 3 |
| NOT IMPLEMENTED | 2 |
| PASS | 129 |

### Certification tiers

| Tier | PASS count | Notes |
|------|------------|-------|
| Reachability (BATCH-01–14) | 53 | Route/render — not sufficient alone for operable features |
| Go-live cert groups (APT/MCTB/CROSS/GLOBAL) | 76 | True click/type/save/reload journeys |

See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md` and `BROWSER_FLOW_CLASSIFICATION_AUDIT.md`.

## Results by ID

| ID | Status | Detail | Batch |
|----|--------|--------|-------|
| APT-01 | PASS |  | CERT-APT |
| APT-01-ai-booking | PASS |  | BATCH-01 |
| APT-01-analytics | PASS |  | BATCH-01 |
| APT-01-analytics-automations | PASS |  | BATCH-01 |
| APT-01-analytics-booking | PASS |  | BATCH-01 |
| APT-01-analytics-reminders | PASS |  | BATCH-01 |
| APT-01-analytics-reports | PASS |  | BATCH-01 |
| APT-01-availability | PASS |  | BATCH-01 |
| APT-01-booking-pages | PASS |  | BATCH-01 |
| APT-01-browser-back | FAIL | back navigation lost context | BATCH-01 |
| APT-01-calendar | PASS |  | BATCH-01 |
| APT-01-contacts | PASS |  | BATCH-01 |
| APT-01-conversations | PASS |  | BATCH-01 |
| APT-01-getting-started | PASS |  | BATCH-01 |
| APT-01-home | PASS |  | BATCH-01 |
| APT-01-integrations | PASS |  | BATCH-01 |
| APT-01-list | PASS |  | BATCH-01 |
| APT-01-meetings | PASS |  | BATCH-01 |
| APT-01-mobile-nav | PASS |  | BATCH-01 |
| APT-01-polls | PASS |  | BATCH-01 |
| APT-01-recalls | PASS |  | BATCH-01 |
| APT-01-reminders | PASS |  | BATCH-01 |
| APT-01-routing-forms | PASS |  | BATCH-01 |
| APT-01-settings | PASS |  | BATCH-01 |
| APT-01-types | PASS |  | BATCH-01 |
| APT-01-video | PASS |  | BATCH-01 |
| APT-01-waitlist | PASS |  | BATCH-01 |
| APT-01-wf-activity | PASS |  | BATCH-01 |
| APT-01-wf-templates | PASS |  | BATCH-01 |
| APT-01-workflows | PASS |  | BATCH-01 |
| APT-02 | PASS |  | CERT-APT |
| APT-03 | PASS |  | CERT-APT |
| APT-04 | PASS |  | CERT-APT |
| APT-05 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-05-form-visible | PASS |  | BATCH-02 |
| APT-06 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-07 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-08 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-09 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-10 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-11 | FAIL | locator.fill: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('input[name="name"], input[placeholder*="name" | CERT-APT |
| APT-11-save-reload | PASS |  | BATCH-03 |
| APT-12 | PASS |  | CERT-APT |
| APT-13 | PASS |  | CERT-APT |
| APT-13-full-flow | PASS | Requires fixture booking page slug — admin surface verified in APT-12 | BATCH-04 |
| APT-13-invalid-slug | FAIL | invalid public slug should show error state | BATCH-04 |
| APT-14 | PASS |  | CERT-APT |
| APT-15 | PASS |  | CERT-APT |
| APT-16 | FAIL | Minimum notice input not found | CERT-APT |
| APT-17 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save/i }).first() to b | CERT-APT |
| APT-18 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save/i }).first() to b | CERT-APT |
| APT-19 | BLOCKED — LIVE EXTERNAL PROVIDER | External Calendar Blocking | CERT-APT |
| APT-20 | PASS |  | CERT-APT |
| APT-21 | PASS |  | CERT-APT |
| APT-22 | PASS |  | CERT-APT |
| APT-23 | PASS |  | CERT-APT |
| APT-24 | PASS |  | CERT-APT |
| APT-25 | PASS |  | CERT-APT |
| APT-26 | PASS |  | CERT-APT |
| APT-27 | PASS |  | CERT-APT |
| APT-28 | PASS |  | CERT-APT |
| APT-29 | PASS |  | CERT-APT |
| APT-30 | PASS |  | CERT-APT |
| APT-31 | PASS |  | CERT-APT |
| APT-32 | PASS |  | CERT-APT |
| APT-33 | PASS |  | CERT-APT |
| APT-34 | PASS |  | CERT-APT |
| APT-34-ui | PASS |  | BATCH-05 |
| APT-35 | PASS |  | CERT-APT |
| APT-36 | PASS |  | CERT-APT |
| APT-37 | PASS |  | CERT-APT |
| APT-38 | PASS |  | CERT-APT |
| APT-39 | PASS |  | CERT-APT |
| APT-40 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save/i }).first() to b | CERT-APT |
| APT-41 | PASS |  | CERT-APT |
| APT-42 | PASS |  | CERT-APT |
| APT-43 | PASS |  | CERT-APT |
| APT-44 | PASS |  | CERT-APT |
| APT-45 | BLOCKED — LIVE PSTN | Caller Amy | CERT-APT |
| APT-46 | PASS |  | CERT-APT |
| APT-47 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-48 | BLOCKED — LIVE MEDIA | Transovo Video Host | CERT-APT |
| APT-49 | FAIL | Invalid guest token should show error state | CERT-APT |
| APT-49-invalid-token | PASS |  | BATCH-07 |
| APT-50 | FAIL | No notetaker toggle found | CERT-APT |
| APT-51 | PASS |  | CERT-APT |
| APT-52 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-53 | FAIL | No appointment types available — seed types first | CERT-APT |
| APT-54 | FAIL | No notetaker toggle found | CERT-APT |
| APT-55 | BLOCKED — LIVE EXTERNAL PROVIDER | Notetaker Meeting Lifecycle | CERT-APT |
| APT-56 | PASS |  | CERT-APT |
| APT-57 | PASS |  | CERT-APT |
| APT-58 | NOT IMPLEMENTED | Searchable Meeting Notes | CERT-APT |
| APT-59 | FAIL | Invalid recap token should show error state | CERT-APT |
| APT-59-invalid | PASS |  | BATCH-07 |
| APT-60 | FAIL | No notetaker toggle found | CERT-APT |
| APT-61 | NOT IMPLEMENTED | Automatic External Meeting Creation | CERT-APT |
| APT-62 | PASS |  | CERT-APT |
| APT-63 | PASS |  | CERT-APT |
| APT-64 | PASS |  | CERT-APT |
| APT-65 | PASS |  | CERT-APT |
| APT-66 | PASS |  | CERT-APT |
| APT-67 | PASS |  | CERT-APT |
| APT-68 | PASS |  | CERT-APT |
| APT-69 | PASS |  | CERT-APT |
| APT-69-business | PASS |  | BATCH-14 |
| APT-69-calendar | PASS |  | BATCH-14 |
| APT-69-messaging | PASS |  | BATCH-14 |
| CROSS-01 | FAIL | locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('option', { name: 'Missed Call Text Back' } | CERT-CROSS |
| CROSS-01-appointments | PASS |  | BATCH-13 |
| CROSS-01-back | PASS |  | BATCH-13 |
| CROSS-01-mctb | PASS |  | BATCH-13 |
| CROSS-02 | /contacts | Shared Contacts | CERT-CROSS |
| CROSS-03 | /conversations | Shared Conversations | CERT-CROSS |
| CROSS-04 | PASS |  | CERT-CROSS |
| CROSS-05 | FAIL | No appointment types available — seed types first | CERT-CROSS |
| CROSS-06 | FAIL | No appointment types available — seed types first | CERT-CROSS |
| CROSS-07 | FAIL | No appointment types available — seed types first | CERT-CROSS |
| CROSS-08 | BLOCKED — LIVE EXTERNAL PROVIDER | External Video → AI Notetaker | CERT-CROSS |
| GLOBAL-01 | PASS |  | CERT-GLOBAL |
| GLOBAL-02 | FAIL | Public route /recap/invalid-token-xyz should show safe error state | CERT-GLOBAL |
| GLOBAL-03 | FAIL | Timezone/hours not visible on availability | CERT-GLOBAL |
| GLOBAL-04 | PASS |  | CERT-GLOBAL |
| MCTB-01 | PASS |  | CERT-MCTB |
| MCTB-01-analytics | PASS |  | BATCH-08 |
| MCTB-01-conversations | PASS |  | BATCH-08 |
| MCTB-01-home | PASS |  | BATCH-08 |
| MCTB-01-missed-calls | PASS |  | BATCH-08 |
| MCTB-01-numbers | PASS |  | BATCH-08 |
| MCTB-01-setup | PASS |  | BATCH-08 |
| MCTB-01-voicemail | PASS |  | BATCH-08 |
| MCTB-02 | PASS |  | CERT-MCTB |
| MCTB-03 | PASS |  | CERT-MCTB |
| MCTB-04 | PASS |  | CERT-MCTB |
| MCTB-05 | FAIL | MCTB phone setup did not render after reload | CERT-MCTB |
| MCTB-05-live-verify | BLOCKED — LIVE PSTN | Carrier forwarding verification requires live call | BATCH-10 |
| MCTB-06 | PASS |  | CERT-MCTB |
| MCTB-07 | PASS |  | CERT-MCTB |
| MCTB-08 | FAIL | Press-1 runtime diagnostics surface not available | CERT-MCTB |
| MCTB-09 | FAIL | MCTB consent mode did not persist after reload | CERT-MCTB |
| MCTB-10 | FAIL | MCTB consent mode did not persist after reload | CERT-MCTB |
| MCTB-11 | PASS |  | CERT-MCTB |
| MCTB-11-ui | PASS |  | BATCH-10 |
| MCTB-12 | PASS |  | CERT-MCTB |
| MCTB-13 | FAIL | /mctb/setup/links: 404 | CERT-MCTB |
| MCTB-14 | FAIL | Invalid MCTB request form token should error | CERT-MCTB |
| MCTB-14-invalid | PASS |  | BATCH-11 |
| MCTB-15 | PASS |  | CERT-MCTB |
| MCTB-16 | PASS |  | CERT-MCTB |
| MCTB-17 | INTENTIONALLY DEFERRED | Local 10DLC Sender | CERT-MCTB |
| MCTB-18 | INTENTIONALLY DEFERRED | Dedicated Text Number Voice Behavior | CERT-MCTB |
| MCTB-19 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save changes/i }).firs | CERT-MCTB |
| MCTB-20 | FAIL | expected redirect to /mctb/setup/recovery; legacy route still served | CERT-MCTB |
| MCTB-21 | INTENTIONALLY DEFERRED | Optional One-Time Follow-Up | CERT-MCTB |
| MCTB-22 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save changes/i }).firs | CERT-MCTB |
| MCTB-23 | PASS |  | CERT-MCTB |
| MCTB-24 | PASS |  | CERT-MCTB |
| MCTB-25 | PASS |  | CERT-MCTB |
| MCTB-26 | PASS |  | CERT-MCTB |
| MCTB-27 | PASS |  | CERT-MCTB |
| MCTB-28 | PASS |  | CERT-MCTB |
| MCTB-29 | FAIL | No missed call detail link available — seed fixture missed call | CERT-MCTB |
| MCTB-30 | PASS |  | CERT-MCTB |
| MCTB-31 | FAIL | 404 | CERT-MCTB |
| MCTB-32 | FAIL | 404 | CERT-MCTB |
| MCTB-33 | FAIL | 404 | CERT-MCTB |
| MCTB-34 | FAIL | 404 | CERT-MCTB |
| MCTB-35 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-36 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-37 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-38 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-39 | PASS |  | CERT-MCTB |
| MCTB-40 | PASS |  | CERT-MCTB |
| MCTB-41 | FAIL | 404 | CERT-MCTB |
| MCTB-42 | FAIL | 404 | CERT-MCTB |
| MCTB-43 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-44 | FAIL | /mctb/setup/notifications: 404 | CERT-MCTB |
| MCTB-45 | PASS |  | CERT-MCTB |
| MCTB-46 | FAIL | 404 | CERT-MCTB |
| MCTB-47 | PASS |  | CERT-MCTB |
| MCTB-48 | FAIL | /mctb/setup/links: 404 | CERT-MCTB |
| MCTB-49 | FAIL | locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /save changes/i }).firs | CERT-MCTB |
| MCTB-50 | PASS |  | CERT-MCTB |
| MCTB-51 | PASS |  | CERT-MCTB |
| MCTB-52 | PASS |  | CERT-MCTB |
| MCTB-53 | PASS |  | CERT-MCTB |
| MCTB-54 | PASS |  | CERT-MCTB |
| MCTB-55 | PASS |  | CERT-MCTB |
| MCTB-56 | PASS |  | CERT-MCTB |
| MCTB-57 | FAIL | expected redirect to /mctb/conversations; landed on /conversations | CERT-MCTB |
| MCTB-57-business-hours | FAIL | expected redirect to /mctb/setup/recovery; legacy route still served | BATCH-12 |
| MCTB-57-follow-up | FAIL | expected redirect to /mctb/setup/recovery; legacy route still served | BATCH-12 |
| MCTB-57-schedule | PASS |  | BATCH-12 |
| MCTB-57-voice-analytics | PASS |  | BATCH-12 |
| MCTB-57-voice-conversations | FAIL | expected redirect to /mctb/conversations; landed on /conversations | BATCH-12 |
| MCTB-57-voice-missed | PASS |  | BATCH-12 |
| MCTB-57-voice-setup | PASS |  | BATCH-12 |
| MCTB-58 | PASS |  | CERT-MCTB |
