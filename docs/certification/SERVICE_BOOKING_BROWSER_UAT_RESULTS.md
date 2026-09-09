# Appointments + MCTB Browser Certification Results

**Updated:** 2026-09-09T01:54:13.264Z
**Base URL:** `scripts/browser-cert/browser-cert.config.ts` → previewBaseUrl
**Provenance:** git `aec7cf1b61023462b1979fac3741366849dd15a7` · deploy `aec7cf1b61023462b1979fac3741366849dd15a7`

**State file:** `docs/certification/appointments-mctb-browser-cert-state.json`
**Mode:** disposable-browser (34/34 flows checkpointed)

## Summary

| Status | Count |
|--------|-------|
| BLOCKED — LIVE EXTERNAL PROVIDER | 2 |
| FAIL | 11 |
| PASS | 17 |
| SKIPPED | 4 |

### Certification tiers

| Tier | PASS count | Notes |
|------|------------|-------|
| Reachability (BATCH-01–14) | 17 | Route/render — not sufficient alone for operable features |
| Go-live cert groups (APT/MCTB/CROSS/GLOBAL) | 0 | True click/type/save/reload journeys |

See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md` and `BROWSER_FLOW_CLASSIFICATION_AUDIT.md`.

## Results by ID

| ID | Status | Detail | Batch |
|----|--------|--------|-------|
| SB-01 | PASS |  | SB-BATCH-01 |
| SB-02 | PASS |  | SB-BATCH-01 |
| SB-03 | PASS |  | SB-BATCH-01 |
| SB-04 | FAIL | Commerce create failed — "UAT Package 132945" not listed | SB-BATCH-02 |
| SB-05 | FAIL | Commerce create failed — "UAT Membership 162228" not listed | SB-BATCH-02 |
| SB-06 | FAIL | Commerce create failed — "UAT Gift 195385" not listed | SB-BATCH-02 |
| SB-07 | FAIL | Commerce create failed — "UAT Coupon 226533" not listed | SB-BATCH-02 |
| SB-08 | FAIL | Commerce create failed — "UAT Add-on 258949" not listed | SB-BATCH-02 |
| SB-09 | FAIL | Commerce create failed — "UAT Resource 286448" not listed | SB-BATCH-02 |
| SB-10 | FAIL | Commerce create failed — "UAT Class 316814" not listed | SB-BATCH-02 |
| SB-11 | FAIL | Commerce create failed — "UAT Program 342936" not listed | SB-BATCH-02 |
| SB-12 | PASS |  | SB-BATCH-02 |
| SB-13 | PASS |  | SB-BATCH-02 |
| SB-14 | FAIL | Commerce create failed — "UAT Household 458904" not listed | SB-BATCH-02 |
| SB-15 | FAIL | Commerce create failed — "UAT Restriction 482892" not listed | SB-BATCH-02 |
| SB-16 | FAIL | Commerce create failed — "UAT Intake 508185" not listed | SB-BATCH-02 |
| SB-17 | PASS |  | SB-BATCH-02 |
| SB-18 | PASS |  | SB-BATCH-02 |
| SB-19 | PASS |  | SB-BATCH-02 |
| SB-20 | PASS |  | SB-BATCH-02 |
| SB-21 | PASS |  | SB-BATCH-02 |
| SB-22 | PASS |  | SB-BATCH-03 |
| SB-23 | PASS |  | SB-BATCH-03 |
| SB-24 | PASS |  | SB-BATCH-03 |
| SB-25 | PASS |  | SB-BATCH-03 |
| SB-26 | SKIPPED | Fixed start times — config JSON only; availability engine covered by public book flow | SB-BATCH-04 |
| SB-27 | SKIPPED | Make Me Look Busy — API/config only | SB-BATCH-04 |
| SB-28 | SKIPPED | Formal contracts + e-sign — API only | SB-BATCH-04 |
| SB-29 | SKIPPED | Invoices — API only | SB-BATCH-04 |
| SB-30 | BLOCKED — LIVE EXTERNAL PROVIDER | Booking channels (Google/Facebook/Instagram) — OAuth blocked | SB-BATCH-04 |
| SB-31 | BLOCKED — LIVE EXTERNAL PROVIDER | iCloud calendar sync — provider blocked | SB-BATCH-04 |
| SB-32 | PASS |  | SB-BATCH-05 |
| SB-33 | PASS |  | SB-BATCH-05 |
| SB-34 | PASS |  | SB-BATCH-06 |
