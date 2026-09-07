# Appointments + MCTB Certification Results

**Updated:** 2026-09-07T21:47:09.507Z
**Authority:** docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md

## Summary

| Status | Count |
|--------|-------|
| PASS | 30 |
| FAIL | 12 |
| BLOCKED | 1 |
| TIMEOUT | 0 |

## Batches

| Batch | Phase | Status | Duration | Command |
|-------|-------|--------|----------|---------|
| STATIC-01 | 1-static | PASS | 327ms | `npx tsx scripts/generate-appointments-mctb-cert-matrix.ts` |
| STATIC-02 | 1-static | PASS | 322ms | `npx tsx scripts/generate-settings-coverage-proof.ts` |
| STATIC-03 | 1-static | PASS | 327ms | `npx tsx scripts/generate-route-api-classification.ts` |
| STATIC-04 | 1-static | PASS | 354ms | `npx tsx scripts/generate-appointments-mctb-inventory.ts` |
| TSC-01 | 2-typecheck | PASS | 44620ms | `npx tsc --noEmit` |
| APT-ENG-01 | 3-appointments-unit | PASS | 964ms | `npx tsx scripts/test-availability-engine.ts && npx tsx scrip` |
| APT-ENG-02 | 3-appointments-unit | PASS | 1017ms | `npx tsx scripts/test-appointments-double-booking.ts && npx t` |
| APT-AI-01 | 4-appointments-api | FAIL | 445ms | `npx tsx scripts/test-appointment-ai-hardening.ts` |
| APT-AI-02 | 4-appointments-api | FAIL | 522ms | `npx tsx scripts/test-appointment-booking-agent-layer.ts` |
| APT-WF-01 | 4-appointments-api | PASS | 436ms | `npx tsx scripts/test-appointment-workflows-hardening.ts` |
| APT-WF-02 | 4-appointments-api | PASS | 323ms | `npx tsx scripts/test-appointment-workflows-scheduling.ts` |
| APT-WF-03 | 4-appointments-api | BLOCKED — PSTN | —ms | `npx tsx scripts/test-appointment-workflow-minutes.ts` |
| APT-VR-01 | 4-appointments-api | PASS | 314ms | `npx tsx scripts/test-appointment-voice-reminders.ts` |
| APT-PAY-01 | 4-appointments-api | PASS | 316ms | `npx tsx scripts/test-merchant-payments.ts` |
| APT-PUB-01 | 4-appointments-api | PASS | 366ms | `npx tsx scripts/test-book-idempotency.ts` |
| APT-MTG-01 | 4-appointments-api | PASS | 310ms | `npx tsx scripts/test-voice-notetaker-wiring.ts` |
| APT-MTG-02 | 4-appointments-api | PASS | 310ms | `npx tsx scripts/test-transovo-video-wiring.ts` |
| MCTB-FILTER-01 | 5-mctb-unit | PASS | 316ms | `npx tsx scripts/test-mctb-missed-calls-filters.ts` |
| MCTB-INBOX-01 | 5-mctb-unit | PASS | 322ms | `npx tsx scripts/test-mctb-inbox-product-filter.ts` |
| MCTB-VM-01 | 5-mctb-unit | PASS | 309ms | `npx tsx scripts/test-mctb-voicemail-entitlements.ts` |
| MCTB-TFV-01 | 5-mctb-unit | FAIL | 758ms | `npx tsx scripts/test-mctb-tfv-gates.ts` |
| MCTB-HO-01 | 6-mctb-api | PASS | 313ms | `npx tsx scripts/test-mctb-handoff.ts` |
| MCTB-RT-01 | 6-mctb-api | PASS | 315ms | `npx tsx scripts/test-mctb-final-pipeline-contract.ts` |
| MCTB-RT-02 | 6-mctb-api | PASS | 314ms | `npx tsx scripts/test-mctb-consent-modes.ts` |
| MCTB-RT-03 | 6-mctb-api | PASS | 377ms | `npx tsx scripts/test-mctb-schedule-pause.ts` |
| MCTB-RT-04 | 6-mctb-api | PASS | 315ms | `npx tsx scripts/test-mctb-consent-log.ts` |
| MCTB-RT-05 | 6-mctb-api | PASS | 608ms | `npx tsx scripts/test-missed-call-text-back-architecture.ts` |
| MCTB-RT-06 | 6-mctb-api | FAIL | 438ms | `npx tsx scripts/test-mctb-engine-matrix.ts` |
| AI-JOHN-01 | 7-cross-ai | FAIL | 4828ms | `npm run test:john-preprod` |
| AI-TRX-01 | 7-cross-ai | FAIL | 299ms | `npm run test:ai-transcription` |
| DEFECT-01 | 1-static | FAIL | —ms | `true` |

## Known defects

- **MCTB-DEFECT-SETUP-LINKS:** /mctb/setup/links missing — request form + defaultLinkUrl runtime exists
- **MCTB-LEGACY-SCHED-001:** Legacy business-hours fields — backward compat only; Business Hours UI must not return

## Matrix coverage

Total matrix cases: **300**
Cases with batch mapping: **43**
UI-deferred cases require separate browser pass.