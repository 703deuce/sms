# Appointments + MCTB — Full Certification Run

**Run:** 2026-09-07T21:22:00Z  
**Command:** `npx tsx scripts/run-appointments-mctb-cert-staged.ts --fresh --continue-on-fail`  
**Full log:** `/opt/cursor/artifacts/appointments-mctb-full-cert-run.log`

## Inventory scan (pre-run)

| Product | Pages | APIs |
|---------|-------|------|
| Appointments | 53 | 64 |
| MCTB | 58 | 83 |
| Public (shared) | 4 | — |

Test scripts indexed: **31**

---

## Staged cert — all 20 batches

| # | Batch | Status | Duration | Matrix IDs |
|---|-------|--------|----------|------------|
| 1 | APT-CORE-01 | **PASS** | 1113ms | APT-ENG-001–005, APT-NAV-001 |
| 2 | APT-AI-01 | **FAIL** | 458ms | AI-APT-001–003 |
| 3 | APT-AI-02 | **PASS** | 483ms | AI-APT-004 |
| 4 | APT-WF-01 | **PASS** | 438ms | APT-AUT-001–002 |
| 5 | APT-WF-02 | **PASS** | 332ms | APT-AUT-003 |
| 6 | APT-WF-03 | **BLOCKED** | — | APT-AUT-004 (needs TEST_PHONE) |
| 7 | APT-VR-01 | **PASS** | 322ms | APT-AUT-005 |
| 8 | APT-PAY-01 | **PASS** | 325ms | APT-INT-001 |
| 9 | APT-MTG-01 | **PASS** | 322ms | AI-MTG-001–002 (notetaker) |
| 10 | APT-MTG-02 | **PASS** | 313ms | AI-MTG-003 (Transovo Video) |
| 11 | APT-PUB-01 | **PASS** | 376ms | APT-PUB-001 |
| 12 | MCTB-HO-01 | **PASS** | 323ms | MCTB-HO-001–004 |
| 13 | MCTB-RT-01 | **PASS** | 322ms | MCTB-RT-001–002 |
| 14 | MCTB-RT-02 | **PASS** | 320ms | MCTB-RT-003–004 |
| 15 | MCTB-RT-03 | **PASS** | 393ms | MCTB-RT-005 |
| 16 | MCTB-RT-04 | **PASS** | 314ms | MCTB-RT-006 |
| 17 | MCTB-RT-05 | **PASS** | 764ms | MCTB-RT-007 |
| 18 | AI-JOHN-01 | **FAIL** | 16743ms | AI-MCTB-001–003 |
| 19 | AI-TRX-01 | **FAIL** | 315ms | AI-VM-001–002 |
| 20 | MCTB-VM-01 | **PASS** | 326ms | MCTB-VM-001 |

### Totals

| PASS | FAIL | BLOCKED | TOTAL |
|------|------|---------|-------|
| **16** | **3** | **1** | **20** |

---

## Failure details

### APT-AI-01 — appointment AI hardening
- Fallback parser returned `OUT_OF_SCOPE` for `"Book the 3:30 consultation Friday."` (expected `BOOK`)
- Schema validation passed before failure

### AI-JOHN-01 — John preprod (7/9 gates)
- ✗ ELIGIBILITY: `enabled workspace eligible`
- ✗ SCHEDULING: `first process schedules` (`NOT_FORWARD_EVENT` suppression)
- DeepSeek 402 Insufficient Balance (non-gating LLM warning)
- All other gates passed: JOHN_LLM, WORKFLOW_ARCHITECT, CALL_DETECTION, SMS_TRANSPORT, CUSTOMER_CONVERSATION, OWNER_CONTROL, CALL_DATA

### AI-TRX-01 — ai transcription catalog
- `listPlatformPurchasableProducts()` returned 0 `ai_transcription` products (expected 3)
- Stripe/catalog env not configured for AI transcription tiers in this VM

---

## Supplemental tests (also run)

| Script | Result |
|--------|--------|
| `test-mctb-missed-calls-filters.ts` | PASS |
| `test-mctb-inbox-product-filter.ts` | PASS |
| `test-transovo-voicemail.ts` | PASS |

## MCTB launch readiness matrix (75 items)

| Status | Count |
|--------|-------|
| IMPLEMENTED | 33 (44%) |
| AUTOMATED_TEST_PASSED | 18 (24%) |
| LIVE_VERIFIED | 0 (0%) |
| MANUAL_HUMAN_TEST_REQUIRED | 24 (32%) |

24 items require live Twilio/carrier/Stripe/browser proof — not run in this batch.

---

## What passed (high signal)

**Appointments:** availability engine, booking protection, reminders, double-booking, tenant isolation, nav, workflow engine (11 templates), workflow scheduling, voice reminders wiring, merchant payments, **AI notetaker wiring**, **Transovo Video wiring** (26 checks), public book idempotency, booking agent layer (90+ assertions)

**MCTB:** handoff (4 modes, urgency, guided collection, templates), frozen TeXML pipeline contract, consent modes, pause/resume, consent log, architecture, voicemail entitlements, missed-call filters, inbox product filter

---

## Still not run (by design)

- Browser/UI certification
- Production build
- PSTN phone calls (press-1, existing consent)
- Live SMS to TEST_PHONE
- Live meeting bot / Telnyx video webhooks
- TFV approval / Stripe live checkout
