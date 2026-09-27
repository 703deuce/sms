# MCTB launch audit (evidence snapshot)

**Date:** 2026-09-27  
**Scope:** Inventory only — no launch fixes in the Voice-freeze pass.  
**Method:** Route/manifest review, existing `scripts/test-mctb-*` coverage, static codebase audit. Production PSTN/SMS live tests marked **NOT RUN** (Cloud Agent cannot certify Telnyx PSTN).

## Summary

| Verdict | Rationale |
|---------|-----------|
| **MCTB_LAUNCH_STATE: NOT_READY** | Core routes and backends are largely present; end-to-end production certification (CFNA → Press-1 → SMS → reply/STOP, platform sender on live traffic) still requires manual/live gates per `docs/V1-PRODUCTION-CERTIFICATION.md` and `npm run test:v1-production-readiness`. |

---

## Launch matrix

Status legend: **PASS** | **PARTIAL** | **FAIL** | **NOT RUN** | **NOT APPLICABLE**

| Area | Feature | UI Exists | Backend Exists | Runtime Connected | Production Test Needed | Status | Exact gap |
|------|---------|-----------|----------------|-------------------|------------------------|--------|-----------|
| Acquisition | Marketing landing → signup | PARTIAL | PASS | NOT RUN | Yes | PARTIAL | MCTB-focused landing work on separate branches; verify production funnel URL |
| Acquisition | Login / session | PASS | PASS | PASS | Smoke | PASS | — |
| Acquisition | Workspace creation on signup | PASS | PASS | NOT RUN | Yes | PARTIAL | `api/auth/signup` creates workspace; free-plan/MCTB entitlement wiring needs live verify |
| Acquisition | Default post-login → MCTB | PASS | PASS | PASS | Smoke | PASS | `resolvePostLoginPath` + `MCTB_V1_PRIMARY` |
| Setup | Guided wizard `/mctb/setup/start` | PASS | PARTIAL | NOT RUN | Yes | PARTIAL | Wizard + section routes exist; readiness completion vs click-through needs live audit |
| Setup | Phone & forwarding | PASS | PASS | NOT RUN | Yes | PARTIAL | `test-mctb-setup-phone-forwarding.ts`, carrier guides; live CFNA verify on real carrier |
| Setup | Transovo number / assignment | PASS | PASS | NOT RUN | Yes | PARTIAL | Platform sender assignment scripts; live number attach |
| Setup | Missed-call rules | PASS | PASS | NOT RUN | Smoke | PARTIAL | Route + APIs; trigger matrix on real dispositions |
| Setup | Consent (press_1 + existing_consent) | PASS | PASS | NOT RUN | Yes | PARTIAL | `test-mctb-consent-modes.ts`; both modes must stay |
| Setup | Text back templates | PASS | PASS | NOT RUN | Yes | PARTIAL | Spec 10 surfaces; platform template restrictions in platform mode |
| Setup | Recovery controls | PASS | PASS | NOT RUN | Smoke | PARTIAL | Legacy business-hours/follow-up redirect to recovery |
| Setup | Voicemail setup | PASS | PASS | NOT RUN | Yes | PARTIAL | Inbox + setup routes |
| Setup | Exclusions | PASS | PASS | NOT RUN | Smoke | PARTIAL | — |
| Setup | Notifications | PASS | PASS | NOT RUN | Smoke | PARTIAL | — |
| Setup | Test & activate | PASS | PASS | NOT RUN | Yes | PARTIAL | `test-mctb-try-it-*`; real call evidence |
| Setup | Onboarding `/onboarding/mctb` | PASS | PARTIAL | NOT RUN | Yes | PARTIAL | `test-mctb-onboarding-wizard-flow.ts` |
| Runtime | TeXML CFNA ingress | N/A | PASS | PASS | Yes | NOT RUN | `test-mctb-final-pipeline-contract.ts`, `verify:mctb-final-pipeline` — PSTN cert manual |
| Runtime | Press-1 IVR + DTMF | N/A | PASS | PASS | Yes | NOT RUN | Frozen pipeline; live Press-1 required |
| Runtime | existing_consent auto-SMS | N/A | PASS | PASS | Yes | NOT RUN | texml-status path |
| Runtime | Workspace/line resolution | N/A | PASS | PARTIAL | Yes | NOT RUN | `test-mctb-ingress-phone-row.ts` |
| Runtime | SMS outbound delivery | N/A | PASS | PASS | Yes | NOT RUN | Provider + platform sender |
| Runtime | STOP / HELP / opt-out | N/A | PASS | PASS | Yes | NOT RUN | `platform-sender-suppression` |
| Runtime | Voicemail record/transcribe | PARTIAL | PASS | NOT RUN | Yes | PARTIAL | Multiple voicemail tests; AI summary partial failures possible |
| Product | Overview `/mctb` | PASS | PASS | NOT RUN | Yes | PARTIAL | Spec 01; KPI authority vs list |
| Product | Missed calls list/detail | PASS | PASS | NOT RUN | Yes | PARTIAL | `/mctb/missed-calls[/:id]` |
| Product | Conversations | PASS | PASS | NOT RUN | Yes | PARTIAL | `/mctb/conversations`; shared inbox engine |
| Product | Voicemail inbox | PASS | PASS | NOT RUN | Yes | PARTIAL | `/mctb/voicemail` |
| Product | Analytics | PASS | PASS | NOT RUN | Yes | PARTIAL | `/mctb/analytics` |
| Product | Compliance consent ledger | PASS | PASS | NOT RUN | Smoke | PARTIAL | `/mctb/compliance/consent` |
| Product | Public request form | PASS | PASS | NOT RUN | Smoke | PARTIAL | `/f/mctb/[token]` |
| Product | AI lead recovery | PASS | PASS | NOT RUN | Yes | PARTIAL | `/mctb/ai-recovery`; live SMS runbook manual |
| Messaging | Platform sender mode | PARTIAL | PASS | PARTIAL | Yes | PARTIAL | `test-mctb-platform-sender*.ts`; template lockdown UX |
| Messaging | Customer-owned A2P | PARTIAL | PASS | NOT RUN | Yes | PARTIAL | TFV gates `test-mctb-tfv-gates.ts` |
| Plan | Free plan / volume limits | PARTIAL | PASS | NOT RUN | Yes | PARTIAL | Billing entitlements; verify in staging |
| Plan | Paid upgrade paths | PARTIAL | PASS | NOT RUN | Yes | PARTIAL | — |
| Legacy | `/voice/*` MCTB redirects | PASS | PASS | PASS | Smoke | PASS | Middleware + legacy routes preserved |

---

## P0 — launch blockers

Issues that would break **ad → signup → setup → CFNA → Press-1 (or existing consent) → SMS → dashboard evidence** if confirmed on production:

1. **Live PSTN CFNA + TeXML path not certified in this environment** — requires real carrier forward + unanswered call (`NOT RUN`).
2. **Press-1 and existing_consent both** must pass on production DIDs — synthetic scripts pass; PSTN **NOT RUN**.
3. **Platform sender on live Telnyx** — assignment + outbound + inbound STOP at shared sender (`test-mctb-platform-sender-combined-cert.ts` exists; production **NOT RUN**).
4. **Signup → MCTB entitlement + default landing** — code paths present; confirm workspace gets MCTB product and lands on `/mctb` without chooser loop (**live smoke**).
5. **Forwarding verification truth** — UI must not show “verified” without server evidence (spec 08; **live smoke**).

---

## P1 — should fix before paid traffic

1. **Overview KPI parity** with missed calls list and analytics (spec 01 single metrics authority).
2. **Wizard vs setup overview** duplicate or divergent state (one backend, two UIs — verify save/reload).
3. **AI lead recovery** launch visibility vs policy (`/mctb/ai-recovery`) — ensure eligibility matches plan and does not bypass platform sender rules.
4. **Appointments/booking surfaces under `/mctb/*`** — present in routes but not primary launch IA; risk of customer confusion if linked from nav.
5. **Legacy `/voice/missed-calls` migration** — redirects exist; ensure all shell links use `/mctb/*`.
6. **`npm run test:v1-production-readiness`** — run in CI/staging and clear FAIL rows before paid acquisition.

---

## P2 — can wait

1. Full MCTB page-spec visual parity (Mode 4 / Kimi rebuild completeness).
2. Smart Routing in nav (`SMART_ROUTING_IN_V1_NAV`) — deferred product per V1 scope.
3. Mass SMS / appointments customer-visible surfaces (already hidden via launch registry).
4. Voicemail AI summary polish when transcription partial.
5. Cross-sell / Voice upsell (explicitly out of scope for freeze pass).

---

## Tests currently available (representative)

Run selectively (many require `DATABASE_URL`):

| Script | Focus |
|--------|--------|
| `npx tsx scripts/test-launch-product-availability.ts` | Voice hidden / redirect |
| `npx tsx scripts/test-mctb-nav-ia.ts` | MCTB-only nav |
| `npx tsx scripts/test-mctb-final-pipeline-contract.ts` | TeXML pipeline guards |
| `npx tsx scripts/test-mctb-consent-modes.ts` | Consent modes |
| `npx tsx scripts/test-mctb-platform-sender-combined-cert.ts` | Platform sender |
| `npx tsx scripts/test-mctb-onboarding-wizard-flow.ts` | Onboarding |
| `npm run verify:mctb-final-pipeline` | Pipeline lock |
| `npm run test:v1-production-readiness` | V1 gate (orchestration) |

---

## Production / manual tests still required

1. One **Press-1** missed call: CFNA → disclosure → DTMF 1 → compliance SMS → opener → reply → STOP.
2. One **existing_consent** missed call: greeting/hangup → auto SMS → reply → STOP.
3. **Forwarding verification** from mobile on declared carrier.
4. **Platform sender** inbound STOP on shared number (tenant resolution).
5. **MCTB overview** shows same-day missed call and recovery state as detail page.
6. `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md` if AI recovery is launch-visible.

---

## MCTB_LAUNCH_STATE

**NOT_READY** — pending live telephony/SMS certification and V1 production readiness gate, not pending Voice freeze work.
