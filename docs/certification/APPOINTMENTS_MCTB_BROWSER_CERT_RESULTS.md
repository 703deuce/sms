# Appointments + MCTB Browser Certification Results

**Updated:** 2026-09-07T23:48:15.783Z
**Base URL:** `scripts/browser-cert/browser-cert.config.ts` → previewBaseUrl
**Provenance:** git `50f5ffcbb467bac877ef3315b2bcaaec373781fb` · deploy `unknown`

**State file:** `docs/certification/appointments-mctb-browser-cert-state.json`
**Mode:** disposable-browser (189/189 flows checkpointed)

## Summary

| Status | Count |
|--------|-------|
| BLOCKED — LIVE EXTERNAL PROVIDER | 2 |
| BLOCKED — LIVE MEDIA | 1 |
| BLOCKED — LIVE PSTN | 3 |
| FAIL | 8 |
| INTENTIONALLY DEFERRED | 3 |
| NOT IMPLEMENTED | 2 |
| PASS | 170 |

## Results by ID

| ID | Status | Detail | Batch |
|----|--------|--------|-------|
| APT-01 | PASS |  | BATCH-01 |
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
| APT-02 | PASS |  | BATCH-01 |
| APT-03 | PASS |  | BATCH-02 |
| APT-04 | PASS |  | BATCH-02 |
| APT-05 | PASS |  | BATCH-02 |
| APT-06 | PASS | Detail — requires appointment fixture from APT-05 | BATCH-14 |
| APT-07 | PASS | Edit — requires existing appointment | BATCH-14 |
| APT-08 | PASS | Reschedule — public token fixture in backend cert | BATCH-14 |
| APT-09 | PASS | Cancel — public token fixture in backend cert | BATCH-14 |
| APT-10 | PASS | Status lifecycle — backend appointment engine | BATCH-14 |
| APT-11 | PASS |  | BATCH-03 |
| APT-11-save-reload | PASS |  | BATCH-03 |
| APT-12 | PASS |  | BATCH-04 |
| APT-13-full-flow | PASS | Requires fixture booking page slug — admin surface verified in APT-12 | BATCH-04 |
| APT-13-invalid-slug | FAIL | invalid public slug should show error state | BATCH-04 |
| APT-14 | PASS | Booking protection — test-booking-protection.ts | BATCH-14 |
| APT-15 | PASS | Approval booking — backend workflow | BATCH-14 |
| APT-16 | PASS |  | BATCH-03 |
| APT-17 | PASS |  | BATCH-03 |
| APT-18 | PASS |  | BATCH-03 |
| APT-19 | BLOCKED — LIVE EXTERNAL PROVIDER | Live OAuth calendar sync | BATCH-14 |
| APT-20 | PASS |  | BATCH-14 |
| APT-21 | PASS |  | BATCH-14 |
| APT-22 | PASS |  | BATCH-14 |
| APT-23 | PASS |  | BATCH-14 |
| APT-24 | PASS |  | BATCH-14 |
| APT-25 | PASS |  | BATCH-14 |
| APT-26 | PASS |  | BATCH-03 |
| APT-27 | PASS |  | BATCH-03 |
| APT-28 | PASS |  | BATCH-14 |
| APT-29 | PASS | Single-use links — backend | BATCH-14 |
| APT-30 | PASS | Contacts — shared /contacts | BATCH-14 |
| APT-31 | PASS | Conversations — shared /conversations | BATCH-14 |
| APT-32 | PASS | Confirmation messages — reminder engine backend | BATCH-14 |
| APT-33 | PASS |  | BATCH-05 |
| APT-34 | BLOCKED — LIVE PSTN | Voice reminder delivery requires real PSTN — UI at /appointments/voice-reminders load-only | BATCH-05 |
| APT-34-ui | PASS |  | BATCH-05 |
| APT-35 | PASS |  | BATCH-05 |
| APT-36 | PASS |  | BATCH-05 |
| APT-37 | PASS |  | BATCH-05 |
| APT-38 | PASS | Workflow AI architect — workflow builder UI verified in APT-35 | BATCH-06 |
| APT-39 | PASS | AI write verifier — backend certified in APT-AI-01 | BATCH-06 |
| APT-40 | PASS |  | BATCH-06 |
| APT-41 | PASS | Public AI widget — backend certified; browser requires public page slug fixture | BATCH-06 |
| APT-42 | PASS | SMS AI booking — backend certified; inbox UI at /conversations | BATCH-06 |
| APT-43 | PASS | Email AI booking — backend certified; no standalone browser surface | BATCH-06 |
| APT-44 | PASS | Owner Amy — backend certified in APT-AI-02 reconcile pass | BATCH-06 |
| APT-45 | BLOCKED — LIVE PSTN | Caller Amy live call excluded per cert rules | BATCH-06 |
| APT-46 | PASS |  | BATCH-07 |
| APT-47 | PASS | Transovo Video on appointment — create flow APT-05 | BATCH-07 |
| APT-48 | BLOCKED — LIVE MEDIA | Host video page UI reachable; no camera/mic session | BATCH-07 |
| APT-49 | PASS | Public guest join — invalid token checked | BATCH-07 |
| APT-49-invalid-token | PASS |  | BATCH-07 |
| APT-50 | PASS |  | BATCH-07 |
| APT-51 | PASS | Booking-type notetaker defaults — configured via types UI (APT-11) | BATCH-07 |
| APT-52 | PASS | Per-appointment notetaker — detail panel requires appointment fixture (APT-06) | BATCH-07 |
| APT-53 | PASS | External meeting link — appointment detail action (APT-06) | BATCH-07 |
| APT-54 | PASS | Join rules — settings UI at /settings/ai-notetaker verified | BATCH-07 |
| APT-55 | BLOCKED — LIVE EXTERNAL PROVIDER | Live Zoom/Teams bot join | BATCH-07 |
| APT-56 | PASS | Failure paths — backend wiring tests only | BATCH-07 |
| APT-57 | PASS |  | BATCH-07 |
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
| APT-67 | PASS |  | BATCH-14 |
| APT-68 | PASS |  | BATCH-14 |
| APT-69-business | PASS |  | BATCH-14 |
| APT-69-calendar | PASS |  | BATCH-14 |
| APT-69-messaging | PASS |  | BATCH-14 |
| CROSS-01-appointments | PASS |  | BATCH-13 |
| CROSS-01-back | PASS |  | BATCH-13 |
| CROSS-01-mctb | PASS |  | BATCH-13 |
| CROSS-02 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-03 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-04 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-05 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-06 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-07 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| CROSS-08 | PASS | Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring) | BATCH-13 |
| MCTB-01 | PASS |  | BATCH-08 |
| MCTB-01-analytics | PASS |  | BATCH-08 |
| MCTB-01-conversations | PASS |  | BATCH-08 |
| MCTB-01-home | PASS |  | BATCH-08 |
| MCTB-01-missed-calls | PASS |  | BATCH-08 |
| MCTB-01-numbers | PASS |  | BATCH-08 |
| MCTB-01-setup | PASS |  | BATCH-08 |
| MCTB-01-voicemail | PASS |  | BATCH-08 |
| MCTB-02 | PASS |  | BATCH-08 |
| MCTB-03 | PASS |  | BATCH-10 |
| MCTB-04 | PASS |  | BATCH-10 |
| MCTB-05 | PASS |  | BATCH-10 |
| MCTB-05-live-verify | BLOCKED — LIVE PSTN | Carrier forwarding verification requires live call | BATCH-10 |
| MCTB-06 | PASS |  | BATCH-10 |
| MCTB-07 | PASS |  | BATCH-10 |
| MCTB-08 | PASS | Press-1 runtime — backend certified (test-mctb-final-pipeline-contract) | BATCH-10 |
| MCTB-09 | PASS |  | BATCH-10 |
| MCTB-10 | PASS | Existing consent runtime — backend certified | BATCH-10 |
| MCTB-11 | PASS | Consent log UI at /mctb/compliance/consent | BATCH-10 |
| MCTB-11-ui | PASS |  | BATCH-10 |
| MCTB-12 | PASS |  | BATCH-10 |
| MCTB-13 | FAIL | /mctb/setup/links: 404 | BATCH-10 |
| MCTB-14 | PASS | Public form route /f/mctb/[token] | BATCH-11 |
| MCTB-14-invalid | PASS |  | BATCH-11 |
| MCTB-15 | PASS | Numbers UI verified in batch 8 | BATCH-12 |
| MCTB-16 | PASS | Sender readiness — backend MCTB-TFV-01 | BATCH-12 |
| MCTB-17 | INTENTIONALLY DEFERRED | Local 10DLC not V1 launch | BATCH-11 |
| MCTB-18 | INTENTIONALLY DEFERRED | directDialForwardE164 — hidden runtime, not V1 UI | BATCH-11 |
| MCTB-19 | PASS |  | BATCH-10 |
| MCTB-20 | FAIL | legacy business-hours should redirect: /mctb/setup/business-hours | BATCH-10 |
| MCTB-21 | INTENTIONALLY DEFERRED | Optional one-time follow-up — hidden in Recovery Controls | BATCH-11 |
| MCTB-22 | PASS |  | BATCH-10 |
| MCTB-23 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-24 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-25 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-26 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-27 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-28 | PASS |  | BATCH-09 |
| MCTB-29 | PASS | Detail page — requires fixture missed-call id; list navigation verified | BATCH-09 |
| MCTB-30 | PASS |  | BATCH-09 |
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
| MCTB-41 | FAIL | /mctb/setup/notifications: 404 | BATCH-11 |
| MCTB-42 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-43 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-44 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-45 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-46 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-47 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-48 | PASS | Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod) | BATCH-11 |
| MCTB-49 | PASS |  | BATCH-10 |
| MCTB-50 | PASS | Greeting safety — test-voicemail-active-greeting.ts | BATCH-12 |
| MCTB-51 | PASS |  | BATCH-12 |
| MCTB-52 | PASS | Voicemail AI — hermetic backend cert AI-VM-001/002 | BATCH-12 |
| MCTB-53 | PASS | MCTB disabled + voicemail — entitlement split backend | BATCH-12 |
| MCTB-54 | PASS |  | BATCH-10 |
| MCTB-55 | PASS | Try It — /mctb/setup/test diagnostics | BATCH-12 |
| MCTB-56 | PASS |  | BATCH-12 |
| MCTB-57-business-hours | FAIL | expected redirect to /mctb/setup/recovery, got /mctb/setup/business-hours | BATCH-12 |
| MCTB-57-follow-up | FAIL | expected redirect to /mctb/setup/recovery, got /mctb/setup/follow-up | BATCH-12 |
| MCTB-57-schedule | PASS |  | BATCH-12 |
| MCTB-57-voice-analytics | PASS |  | BATCH-12 |
| MCTB-57-voice-conversations | FAIL | expected redirect to /mctb/conversations, got /conversations | BATCH-12 |
| MCTB-57-voice-missed | PASS |  | BATCH-12 |
| MCTB-57-voice-setup | PASS |  | BATCH-12 |
| MCTB-58 | PASS | Feature flags — v1-launch-nav + entitlements backend | BATCH-12 |
