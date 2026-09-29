# MCTB consolidated test-and-fix pass — full report (copy-paste)

**Date:** 2026-09-29 (UTC)  
**Purpose:** Single consolidated non-human test pass before one production deploy (no new inventory; commercial certification wrapper not run).

---

## Executive summary

- Ran **consolidated test-and-fix** (no new inventory, no `run-mctb-commercial-launch-certification.sh` wrapper).
- Fixed **four** drifting/outdated tests; **no intentional product behavior changes**.
- Added repeatable runner: **`npm run test:mctb-consolidated-nonhuman-matrix`**
- **Matrix result:** **61/61 PASS** (Cloud Agent, self-hosted Redis via SSH tunnel).
- **One push to `master`:** candidate SHA **`c9752201`**

**Evidence log (agent):** `/opt/cursor/artifacts/mctb-consolidated-matrix-run-2.log`  
**Shorter index doc:** `docs/MCTB-CONSOLIDATED-NONHUMAN-TEST-MATRIX-RESULT.md`  
**Runner script:** `scripts/run-mctb-consolidated-nonhuman-matrix.sh`

---

## FAILURES FOUND AND FIXED

| Defect | Fix |
|--------|-----|
| Onboarding step order assertions stale vs current `MCTB_ONBOARDING_STEP_ORDER` | `scripts/test-mctb-onboarding-architecture.ts` |
| Press-1 DB test used workspace id without DB row (FK violation) | Isolated workspace create + cleanup in `scripts/test-mctb-press1-consent-db.ts` |
| Existing-consent ineligible reason copy says “Recovery”, not “paid” | `scripts/test-mctb-setup-consent.ts` |
| Simplified-launch pointed at deprecated `onboarding-wizard.tsx`; STOP ordering checked imports instead of `handleMctbCustomerSmsReply` body | `scripts/test-mctb-simplified-launch.ts` → `mctb-onboarding-runtime.tsx` + handler-scoped assertion |

---

## AUTOMATED TEST MATRIX

Every row is one of: **PASS** | **MANUAL PSTN REQUIRED** | **EXTERNAL APPROVAL REQUIRED** | **OUT OF SCOPE**

| Area | Test / coverage | Result | Fix made | Evidence |
|------|-----------------|--------|----------|----------|
| **1** Account / workspace / product access | Capabilities, stripe entitlement lifecycle, onboarding entry, first-run policy | **PASS** | — | Matrix `1-*`, guards |
| **2** First-run wizard state machine | Wizard policy/flow, business line persist, live-test evidence (no fake PSTN pass) | **PASS** | Onboarding architecture test | Matrix `2-*` |
| **3** Automatic Transovo number provisioning | Provision contract + E2E with `MCTB_CERT_SKIP_LIVE_DID_PURCHASE=1` | **PASS** | Press-1 DB isolation | Matrix `3-*` |
| **4** Capability / entitlement security | `test-mctb-capabilities-resolver`, existing consent attestation, platform template enforcement, AI gate | **PASS** | — | Guards + matrix |
| **5** Platform template authority | Platform template enforcement, message template unit test | **PASS** | — | Guards |
| **6** Recovery configuration | Setup recovery, schedule pause, paused call fallback, max messages field | **PASS** | — | Matrix `6-*`, `7-max-messages` |
| **7** Recovery eligibility | Cooldown eligibility, messaging provider eligibility | **PASS** | — | Matrix `7-cooldown`, `11-messaging-eligibility` |
| **8** Free usage 25→26 | `test-mctb-recovery-usage-idempotency` (DB logical boundary) | **PASS** | — | Matrix `8-usage-25-26` |
| **9** Press-1 consent logic | Consent modes, press-1 DB linkage, final pipeline contract | **PASS** | Press-1 DB test | Matrix `9-*` |
| **10** Existing consent | Existing consent attestation, setup consent model | **PASS** | Setup-consent assertion | Matrix `10-*`, `21-consent-setup` |
| **11** Outbound recovery job | BullMQ worker test, dispatch worker contract, PSTN readiness (code) | **PASS** | — | Matrix `31-*`, `38-pstn-readiness` |
| **12** Inbound caller reply | Caller-replied inbound path, inbound notification plan | **PASS** | Simplified-launch STOP ordering | Matrix `12-*`, `19-simplified-launch` |
| **13** Conversations (backend contracts) | Caller-replied path, tenant isolation (partial) | **PASS** | — | Matrix `12-*`, `28-*` |
| **14** Missed calls | Missed-calls filters, setup sections | **PASS** | — | Matrix `13-*`, `14-*` |
| **15** Consent log | `test-mctb-consent-log` | **PASS** | — | Matrix `15-consent-log` |
| **16** Voicemail | Lifecycle, hermetic AI, inbox row, entitlements, workspace | **PASS** | — | Matrix `16-*` |
| **17** Normal business notification | Handoff recipient destination, email delivery contract, Brevo E2E (capture mode) | **PASS** | — | Matrix `17-*` |
| **18** Urgent notification | Urgent handoff guards, lead-recovery policy separation | **PASS** | — | Matrix `18-*` |
| **19** STOP / HELP | Simplified launch protocol helpers + STOP before lead recovery in handler | **PASS** | Simplified-launch test | Matrix `19-simplified-launch` |
| **20** Exclusions | `test-mctb-setup-exclusions` | **PASS** | — | Matrix `20-exclusions` |
| **21** Request form / links | Setup links, setup notifications | **PASS** | — | Matrix `21-*` |
| **22** AI Recovery | AI recovery entitlement gate | **PASS** | — | Matrix `22-ai-gate` |
| **23** Own sender | Platform sender, sender mode persist, TFV gates (simulation) | **PASS** (pre-approval) | — | Matrix `23-*`; live TFV → **EXTERNAL APPROVAL REQUIRED** |
| **24** Analytics | Analytics range, engine matrix | **PASS** | — | Matrix `24-*` |
| **25** Overview | Getting-started readiness/shell; pass-6 reconciliation (partial cross-check) | **PASS** (automated slice) | — | Matrix `26-*`, `27-pass6`; full Overview UI → **MANUAL** |
| **26** Setup overview | Getting-started readiness, setup sections | **PASS** | — | Matrix `14-*`, `26-*` |
| **27** Onboarding ↔ permanent Setup round-trip | Pass-6 final reconciliation | **PASS** (scripted) | — | Matrix `27-pass6` |
| **28** Multi-tenancy / authorization | Platform inbound tenant isolation, number identity scope | **PASS** | — | Matrix `28-*` |
| **29** Webhook idempotency / security | Final pipeline verify, pipeline contract, inbound paths | **PASS** (contracts) | — | Matrix `31-*`; live Telnyx replay → **MANUAL** |
| **30** Failure matrix | Covered by existing unit tests in matrix; no full Redis-outage sim expanded | **PASS** (partial) | — | Not exhaustive chaos testing |
| **31** Redis / BullMQ regression | Guards, `test:sms-worker-bullmq`, verify final pipeline, Cloud Agent tunnel | **PASS** | — | Matrix `31-*` |
| **32** Performance / redundant fetch | Not expanded per instruction | **OUT OF SCOPE** | — | — |
| **33** UI functional smoke | Browser/component walkthrough | **MANUAL** | — | Old browser cert shows 404s on some `/mctb/setup/*` routes — separate UI pass |
| **34** Fixture / dev leak | `verify-mctb-production-no-dev-issue-badge`, stage2 presentation | **PASS** | — | Matrix `34-*` |
| **35** Database / migration | No schema change in this candidate | **OUT OF SCOPE** | — | — |
| **36** Build | MCTB matrix green; full repo `tsc` may still fail on unrelated `newui-transplant/` | **PARTIAL** | — | Run `npm run test:mctb-consolidated-nonhuman-matrix` for MCTB gate |
| **37** Consolidate before deploy | Single `master` push with all fixes | **PASS** | — | SHA `c9752201` |
| **38** One production deployment | Push triggers Coolify; verify health SHA after build | **IN PROGRESS** | — | See PRODUCTION section below |
| **Physical PSTN / handset** | Real call, CFNA, DTMF, SMS on phone, reply, heard audio | **MANUAL PSTN REQUIRED** | — | Golden-path for you |
| **External carrier** | TFV / 10DLC / customer-owned sender approval | **EXTERNAL APPROVAL REQUIRED** | — | — |

---

## PRODUCTION

| Item | Value |
|------|--------|
| **Master SHA (candidate)** | `c9752201d83859d9d39a32da4072ca63972a0ada` (short: `c9752201`) |
| **Production SHA at report time** | `ad7ca4aa727117f58ec06235029ba25acea9423a` via `GET /api/health` on production FQDN (Coolify `COOLIFY_FQDN`) — **behind master** until Coolify finishes (~15 min typical) |
| **Build** | Normal `master` → Coolify web app `ds8s3hjin60qs6g7s0iqkixs` |
| **Migrations** | Deploy script `scripts/deploy-db-migrations.sh` on container start when `DATABASE_URL` set |
| **Redis** | `transovo-bullmq-redis` on Coolify (AOF, auth, volume, noeviction) |
| **BullMQ** | `QUEUE_DRIVER=bullmq`, producers → Postgres outbox → Redis → embedded `worker:all` |
| **Embedded worker** | `EMBEDDED_JOB_WORKER=1`, `DISABLE_INPROCESS_WORKER=1` (production intent) |
| **MCTB guards** | Included in matrix step `31-guards` — **PASS** |
| **Cloud Agents** | `.cursor/environment.json` bootstrap + tunnel; preload overrides Upstash `REDIS_URL` for tsx scripts |

**After deploy:** confirm `commitSha` on `/api/health` equals `c9752201`, then production-safe smokes only (not full golden-path PSTN).

---

## REMAINING MANUAL TESTS FOR YOU

Only items that genuinely need your physical action or human judgment:

1. Real fresh signup / customer experience where judgment matters (do not use your real production customer account in automation).
2. Actual **business-line CFNA** configuration on your carrier.
3. **Real PSTN call** to your public business number.
4. **Real carrier forwarding** verification (call business line, let ring unanswered, evidence on server).
5. **Actual disclosure audio** heard over PSTN (Press-1 mode).
6. **Actual DTMF Press 1** on a live call.
7. **Actual recovery SMS** received on your handset.
8. **Actual SMS reply** from your handset.
9. **Actual notification** in the **configured recipient** external inbox (recipient A ≠ login email B).
10. **Voicemail** record/playback experience on handset.
11. **STOP/HELP from handset** if you want physical protocol validation (optional if logical tests suffice).
12. **Browser golden-path** — wizard Next/Back, setup deep links, conversations/missed call detail (section 33; fix any 404 routes found during walkthrough).

---

## EXTERNAL APPROVAL TESTS

- TFV / 10DLC / customer-owned sender **carrier approval** (and similar genuine external dependencies).
- Do not fake carrier approval in production.

---

## READY FOR ONE MANUAL GOLDEN-PATH WALKTHROUGH

**YES** — for code and automated integration: **61/61** non-human matrix **PASS** on `master` `c9752201`.

**WAIT** on starting golden-path until production **`commitSha`** matches **`c9752201`** and you are satisfied with production-safe smokes.

---

## HOW TO RE-RUN

```bash
# From repo root; Cloud Agent auto-sources Redis tunnel when SSH to coolify-server works
npm run test:mctb-consolidated-nonhuman-matrix
```

Commercial guards only (subset):

```bash
bash scripts/run-mctb-commercial-launch-guards.sh
```

**Do not** use this pass as a substitute for:

- `run-mctb-commercial-launch-certification.sh` (includes live DID purchase unless skipped)
- Your physical PSTN golden-path
- Full browser certification suite

---

## INFRASTRUCTURE BASELINE (unchanged — do not reopen unless regression)

Production MCTB producers → Postgres durable job/outbox → self-hosted Coolify Redis → BullMQ → embedded `worker:all` → MCTB handlers.

- Dedicated `transovo-bullmq-redis` (Redis 7.2, private network, auth, volume, AOF, RDB, noeviction, limits, healthcheck, restart policy).
- `QUEUE_DRIVER=bullmq`, `EMBEDDED_JOB_WORKER=1`, `DISABLE_INPROCESS_WORKER=1`.
- Cloud Agents: SSH tunnel to `127.0.0.1:63790` + `/workspace/.env` + preload override (do not switch back to Upstash for BullMQ tests).
- Upstash rollback on server: **not deleted** (per instruction).
- Voice / LiveKit: **not touched** in this pass.

---

## ORIGINAL READINESS INVENTORY CONTEXT

The earlier repository-backed inventory (**58 READY TO TEST**, etc.) was **wiring/traceability**, not executed E2E customer tests. This pass **executes** what can be proven without your handset or external carrier approval, fixes deterministic failures, and bundles into **one** `master` deploy candidate.

Redis/BullMQ production consumer gap identified earlier is addressed; this matrix assumes that baseline holds unless a test shows regression.

---

*End of report.*
