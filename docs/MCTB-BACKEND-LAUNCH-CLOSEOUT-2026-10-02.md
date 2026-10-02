# MCTB Backend Launch Closeout — 2026-10-02

**Status:** STOP BEFORE PUSH  
**Remote `master` (web prod):** `e545faa7`  
**Local commits not pushed:** `b1048962` (existing-consent paid gate + launch report), `09424238` (usage test labels + AI simulate entitlement gate)

---

## Commercial limit sources

**There is no single “25 free” value in runtime code.** The “25th / 26th” wording was **stale test log copy** while the test seeds `MCTB_FREE_MONTHLY_RECOVERY_LIMIT - 1` (so with limit **10**, it is **10th allowed / 11th blocked**). Commit `09424238` fixes those log strings (local only, not pushed).

| Source | Free | Text Back (paid `recoveryPaid`) | AI Recovery (`aiRecoveryEntitled`) | Notes |
|--------|------|-----------------------------------|-------------------------------------|--------|
| `src/lib/mctb/recovery-usage-constants.ts` | **10** | **50** (`MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT`) | **100** | Authoritative constants |
| `resolveMctbMonthlyRecoveryLimit()` (same file) | 10 | 50 | 100 | Used by capabilities |
| `src/lib/mctb/recovery-usage.ts` (`reserveMctbRecoveryUnit`) | enforces resolver limit | same | same | Enforcement |
| `src/lib/mctb/capabilities.ts` | `monthlyRecoveryLimit` from resolver | same | same | API/UI read model |
| `src/lib/mctb/commercial-entitlements.ts` | entitlement flags only | no per-tier limits | no per-tier limits | Not limit numbers |
| `MCTB_PAID_RECOVERY_LIMIT_BY_TIER` | — | **starter / growth / pro / text_back → all 50** | — | No 250/750/2500 in code |
| `src/lib/products/platform-billing-catalog.ts` (marketing copy) | — | **50** in description | **100** in description | Not enforcement |
| Stripe `platform-billing-catalog-ids-live.ts` | — | price IDs only | addon price IDs | **No recovery counts in Stripe metadata** |
| `docs/MCTB-COMMERCIAL-PACKAGES.md` | **10** | **50** | **100** | Aligned with code |
| `mctb-onboarding-runtime.tsx` | hardcoded **“10 recoveries per month”** | — | — | UI copy |
| `overview-page.tsx` / `setup-overview-view.tsx` / `plan-display.ts` | from **capabilities API** | same | same | Dynamic from resolver |
| `scripts/test-mctb-capabilities-resolver.ts` | asserts **10** | **50** | **100** | |
| `scripts/test-mctb-commercial-stripe-entitlement-lifecycle.ts` | **10** | **50** | **100** | |
| `scripts/test-mctb-recovery-usage-idempotency.ts` | uses `MCTB_FREE_MONTHLY_RECOVERY_LIMIT` | — | — | Was mislabeled “25/26” in logs only |
| `docs/MCTB-CONSOLIDATED-*` / `MCTB-CODE-COMPLETENESS-INSPECTION.md` | documents **25→26** | — | — | **Conflicts with code (stale docs)** |
| Earlier product brief (owner) | **25** | **250 / 750 / 2500** (Starter/Growth/Pro) | (unspecified vs 100) | **Not implemented in code** |

**No limit values were changed in the closeout pass** (except clarifying test log text in local commit `09424238`).

### Product decision required (owner)

**A — Current codebase + `MCTB-COMMERCIAL-PACKAGES.md`:** Free **10**, Text Back **50**, AI Recovery **100**; Starter/Growth/Pro names all map to **50** today.

**B — Earlier owner model:** Free **25**, paid tiers **250 / 750 / 2,500** (specify AI Recovery monthly cap if it differs from Text Back).

Pick **A or B** before one coordinated change (constants, entitlements, Stripe copy, UI, docs, tests).

---

## Job queue lifecycle

**PASS** — `npm run test:job-queue-lifecycle` → `job_queue_lifecycle: PASS`

---

## Production configuration

Checked **production web container** (`ds8s3hjin60qs6g7s0iqkixs-*` @ `e545faa7`) and **SMS worker container** (`fd7b2fe…` @ `53933d56`).  
`scripts/mctb-production-config-inventory.ts` was **not** run inside production containers; table below is from **live Coolify inspection** (names only, no secret values).

| Item | Status |
|------|--------|
| `DATABASE_URL` (web + worker) | **PRESENT** |
| `REDIS_URL` / `QUEUE_DRIVER=bullmq` (web + worker) | **PRESENT** |
| `TELNYX_API_KEY` (web + worker) | **PRESENT** |
| `TELNYX_PUBLIC_KEY` (web) | **PRESENT** |
| Telnyx messaging profile (platform sender DB `provisioning.messagingProfileConfigured`) | **PRESENT** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (web) | **PRESENT** |
| `BREVO_API_KEY` (web + worker) | **PRESENT** |
| `NEXT_PUBLIC_APP_URL` (web) | **PRESENT** |
| `SUPABASE_SERVICE_ROLE_KEY` (web) | **PRESENT** |
| `SUPABASE_URL` (web) | **MISSING** |
| `MCTB_SMS_WORKER_HEALTH_URL` (web) | **MISSING** |
| `COOLIFY_SSH_KEY` (GitHub Actions) | **Cannot verify from cloud agent** (`gh secret list` → 401). **Circumstantial:** web @ `e545faa7`, worker image @ `53933d56`, worker `/health` has `commitSha: null`. |
| `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` (web env) | **MISSING** (canonical sender still resolves via DB `platformMctbSender` flag) |

Production health sample (`GET /api/health` on primary domain):

```json
{
  "commitSha": "e545faa720ad0cd2cd9cd1ed6ce1ddb166175ff3",
  "deployment": {
    "smsWorkerCommitSha": null,
    "webWorkerCommitParity": null
  }
}
```

---

## Platform sender

**READY** for Press-1 + **PLATFORM** path (production DB + Telnyx metadata; E.164 redacted in ops notes).

| Check | State |
|--------|--------|
| Provider | **Telnyx** |
| Sender configured | **YES** (canonical platform sender resolves; toll-free masked **+18***80**) |
| Messaging profile configured | **YES** (`messagingProfileConfigured: true`, profile id set) |
| Carrier verification | **APPROVED** for platform provisioning (`a2pRegistrationStatus: approved`, campaign assigned); row-level `a2pStatus` may show **PENDING** on legacy column — treat launch path as **APPROVED** with nuance |
| Outbound routing | **YES** (`smsSendingEnabled: true`, TeXML/voice ingress configured) |
| Inbound reply webhook | **YES** (Telnyx SMS ingress + platform inbound resolution; voice TeXML to MCTB entry) |
| Delivery/status callbacks | **YES** (standard `/api/telnyx/sms/status`; app base URL configured on web) |

**Note:** Transovo **platform** sender is distinct from customer-owned **+1571…** / `MASS_TEXT_MARKETING` registration on `ws_1`.

---

## Worker deployment

**WORKER AUTO DEPLOY = NOT ENABLED — missing or non-functional `COOLIFY_SSH_KEY` in GitHub Actions**

- Cannot read GitHub secret from this environment.
- **Evidence:** `.github/workflows/deploy-sms-worker.yml` exists on `origin/master`, but production worker remains on **`53933d56`** while web is **`e545faa7`** after the merge that added auto-deploy + worker `commitSha` on `/health`.

---

## Web/worker parity monitoring

**NOT ENABLED**

- `MCTB_SMS_WORKER_HEALTH_URL` **MISSING** on production web.
- `/api/health` returns `smsWorkerCommitSha: null`, `webWorkerCommitParity: null`.
- Worker `/health` on running image does not expose `commitSha` (older deploy).

**Invariant for launch ops:** web `commitSha` == SMS worker `commitSha` after deploy.

---

## High-cost boundaries

| Operation | Status |
|-----------|--------|
| Telephone purchase / ingress provision (`provision_auto`, `ensureMctbWorkspaceIngressReady`, onboarding provision actions) | **PROTECTED** — `requireSession` + Postgres **advisory lock** (`withMctbWorkspaceIngressProvisionLock`) |
| Repeated live-test initiation (`POST /api/mctb/live-test`) | **PROTECTED** — `requireSession`; start is idempotent (no dedicated rate limit) |
| Customer-triggered outbound SMS | **PROTECTED** — auth on APIs; **`sendQuickSms`** STOP/suppression + MCTB eligibility on recovery path |
| AI Recovery simulate (`POST …/lead-recovery/simulate`) | Was **UNPROTECTED** (LLM without entitlement). **Fixed locally** (`09424238`, not pushed): `assertMctbCapability(..., aiRecoveryEntitled)` |

No generalized rate-limit platform added.

---

## Remaining owner actions

1. **Product decision:** **A (10/50/100)** vs **B (25/250/750/2500 + AI cap)** — then one alignment pass.
2. **GitHub:** set **`COOLIFY_SSH_KEY`**; confirm **Deploy SMS worker** workflow runs on `master` push.
3. **Coolify web env:** set **`MCTB_SMS_WORKER_HEALTH_URL`** to worker `/health` (reachable from web container).
4. **Redeploy SMS worker** to **`e545faa7`**+ (or next batch) so **`commitSha`** matches web.
5. **`SUPABASE_URL`** on web if voicemail/storage requires it (**currently MISSING**).
6. **EXTERNAL CONFIG / accepted launch risk:** off-host Postgres/Redis backups, Supabase Storage object backup (do not build until destination/credentials supplied).

---

## Remaining CODE blockers

1. **Commercial limits unsettled** — cannot treat enforcement as final until owner picks **A** or **B**.
2. **Production web/worker version skew** — worker **`53933d56`** vs web **`e545faa7`** until auto-deploy + redeploy.
3. **Parity observability** — requires **`MCTB_SMS_WORKER_HEALTH_URL`** + worker build with health `commitSha`.

**Not blockers for this closeout:** landing page, physical PSTN, browser/590 matrix, Voice V3, optional backup automation, future Own Sender self-service.

---

## Durability (unchanged — no work this pass)

| Item | Classification |
|------|----------------|
| Local Postgres logical backup + restore drill | **READY** |
| Off-host Postgres backup | **EXTERNAL CONFIG / accepted launch risk** |
| Supabase Storage object backup | **EXTERNAL CONFIG / accepted launch risk** |
| Redis rebuild from Postgres `job_queue` | **READY** (runbook) |

---

## Local git state (do not push until approved)

```text
# Example — verify with: git log origin/master..HEAD --oneline
b1048962 MCTB backend launch pass: gate existing consent to paid plans
09424238 Closeout: clarify usage test labels; gate AI Recovery simulate API
```

Related docs:

- `docs/MCTB-BACKEND-LAUNCH-READINESS-REPORT-2026-10-02.md` (full pass report, sections A–L)
- `docs/MCTB-COMMERCIAL-PACKAGES.md` (product limits **10/50/100** today)

---

## STOP BEFORE PUSH

One reviewed batch → one push → one deploy → `scripts/verify-mctb-production-topology.ts` with production URLs.
