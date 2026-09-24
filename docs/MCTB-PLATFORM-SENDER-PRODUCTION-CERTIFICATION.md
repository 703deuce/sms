# MCTB Platform Sender — Production Certification

**Canonical production truth for platform sender certification.**  
**Last updated:** 2026-09-24 (UTC)

**Status:** Configuration largely complete — **live handset certification NOT TESTED** (requires real PSTN/SMS on operator handset).

---

## Summary table

| Item | Result |
|------|--------|
| Production SHA | **PASS** — `faa5decf` (health 2026-09-24T18:57:44Z) |
| Model B code live | **PASS** |
| Platform owner `ws_1` | **PASS** — Transovo-controlled (admin test / unlimited MCTB signals) |
| Owner Telnyx registration blocks send | **PASS** — not a blocker under Model B |
| Coolify env vars set on production | **NOT TESTED** — agent cannot apply Coolify; see §2 |
| DB migration `senderMode` | **PASS** — column present; `ws_1` remains `WORKSPACE` until cert step 7 |
| Canonical platform PhoneNumber | **PASS** — one row, ID below |
| Runtime resolver (with expected env) | **PASS** — `readinessGreen: true` |
| Twilio parent TFN webhooks | **PASS** — inbound + status callback configured |
| TFN still on parent account | **PASS** |
| Test workspace `senderMode=PLATFORM` | **NOT TESTED** — still `WORKSPACE` on `ws_1` |
| Missed call / press-1 | **NOT TESTED** |
| Outbound SMS from `+18885046264` | **NOT TESTED** |
| Reply → customer inbox | **NOT TESTED** |
| HELP | **NOT TESTED** |
| STOP | **NOT TESTED** |
| Isolation (customer vs `ws_1`) | **NOT TESTED** |
| WORKSPACE sender regression | **NOT TESTED** |

---

## Architecture (locked)

- **PLATFORM** SMS: Twilio **parent** credentials → `From` = canonical platform TFN `+18885046264`.
- **WORKSPACE** SMS: customer Twilio **subaccount** (unchanged).
- Customer `Message` / `Conversation` / `MissedCallEvent` → **customer workspace**, not platform owner.
- Platform owner `ws_1` holds the shared `PhoneNumber` resource row only.

---

## 1. Platform owner — CONFIRMED

**`MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1`** is appropriate.

Evidence (`scripts/verify-ws1-platform-owner.ts`):

- `adminTestAccount: true`
- `unlimitedMctbTesting: true`
- `adminUnlimitedBilling` / `unlimitedCredits: true`

Telnyx `MessagingRegistration` on `ws_1` does **not** block Model B platform sends.

---

## 2. Coolify production environment — OPERATOR ACTION

Set on production Coolify (then restart/redeploy):

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1
MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q
```

Preserve existing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (or equivalent parent token envs), and `APP_URL`.

**Note:** With exactly one `platform_mctb_sender` row in DB, `resolveCanonicalMctbPlatformSender()` can resolve without the phone ID env, but **set both vars explicitly** for production clarity.

**Agent result:** **NOT TESTED** (no Coolify API access from cloud agent).

---

## 3. Deployed runtime — PASS

| Check | Value |
|-------|--------|
| `GET /api/health` | `ok: true` |
| `commitSha` | `faa5decff2d94fe3bea7c4a6e26bedf52ccc08de` |

Readiness script (`scripts/verify-mctb-platform-production-readiness.ts`) with explicit env:

| Check | Result |
|-------|--------|
| Canonical sender found | yes |
| `phoneNumberId` | `cmufvsanf1g0v060m13730z0q` |
| `e164` | `+18885046264` |
| `workspaceId` | `ws_1` |
| `provider` | `twilio` |
| `mctbRole` | `platform_mctb_sender` |
| Outbound SMS authorized (TFV) | yes |
| Model B parent path eligible | yes |
| Owner reg provider | `telnyx` — **does not block** |

---

## 4. Production database — PASS

| Check | Result |
|-------|--------|
| Migration `20260924180000_mctb_platform_sender_mode` | Applied (no pending on agent DB) |
| `MissedCallTextConfig.senderMode` | Present |
| `ws_1` `senderMode` | `WORKSPACE` (unchanged) |
| Unique platform row for `+18885046264` | **1** — `cmufvsanf1g0v060m13730z0q` |
| Second adoption run | `already_configured` (idempotent) |

---

## 5. Twilio parent TFN webhooks — PASS

Configured via `scripts/configure-mctb-platform-tfn-webhooks.ts` on parent-owned `+18885046264`:

| Callback | URL |
|----------|-----|
| Inbound SMS | `POST {APP_URL}/api/twilio/inbound` |
| Status | `POST {APP_URL}/api/twilio/message-status` |

Outbound Model B sends also set `statusCallback` on `messages.create` (same URL) — number-level callback aligns with implementation.

**Do not print** full URLs in logs with secrets; verify `APP_URL` matches Twilio signature validation origin.

Read-only recheck (`inspect-twilio-platform-tfn.ts`): parent ownership, SMS capable, `smsUrlConfigured` / `statusCallbackConfigured` = true.

---

## 6. Controlled test workspace (pre-cert snapshot) — `ws_1`

**Do not enable PLATFORM until operator runs live cert (step 7 below).**

| Field | Value |
|-------|--------|
| Workspace ID | `ws_1` |
| Name | Blue Ridge Realty (internal/test) |
| MCTB ingress `phoneNumberId` | `cmsgtjms84g6l2h0o255w1e3v` |
| `smsPhoneNumberId` | `cmsgtjms84g6l2h0o255w1e3v` (unchanged if PLATFORM enabled) |
| `senderMode` (current) | `WORKSPACE` |
| Consent | `press_1` (from workspace MCTB settings) |
| Public business line | `+15555550188` (workspace config) |

**Cert step 7 (operator):** Change **only** `senderMode` → `PLATFORM`. Do **not** change `phoneNumberId` / ingress DID. Platform TFN is SMS sender only, not CFNA destination.

---

## 7. Readiness gate before live call

| Gate | Status |
|------|--------|
| Production healthy | **PASS** |
| Model B SHA deployed | **PASS** |
| Migration applied | **PASS** |
| Canonical platform PhoneNumber | **PASS** |
| Platform TFN outbound authorized | **PASS** |
| Parent Twilio credentials in env | **PASS** (agent env; confirm on Coolify) |
| Twilio inbound webhook | **PASS** |
| Signature validation enabled | **PASS** (implementation; verify `APP_URL`) |
| Test workspace `senderMode=PLATFORM` | **PENDING** — operator |
| Ingress DID unchanged | **PASS** (not modified) |
| Press-1 path | **NOT TESTED** (live) |

---

## 8–15. Live certification — NOT TESTED

Cloud agent **cannot** place PSTN calls or receive SMS on a handset.

Operator runbook (one controlled handset):

1. Set `senderMode=PLATFORM` on `ws_1` only.
2. Call public business number → no answer → CFNA → workspace ingress DID.
3. Press **1** — verify consent.
4. Verify SMS **From `+18885046264`** (not ingress DID).
5. Reply — verify RESOLVED → `ws_1` inbox / Lead Recovery; not duplicated; not routed as generic-only.
6. **HELP** — Transovo-level response, no tenant leak.
7. **STOP** — platform suppression; block subsequent PLATFORM send to same handset.
8. Confirm `Message`/`Conversation`/`MissedCallEvent` `workspaceId` = `ws_1` (customer), not conflated with platform-owner conversation leakage.

After success: **STOP** — no bulk PLATFORM, no onboarding default change.

---

## 16. Regression — NOT TESTED

- Existing `WORKSPACE` MCTB customers unchanged in DB.
- Call Handling / Voice V3: no changes in this workstream.

---

## Reference IDs

| Key | Value |
|-----|--------|
| Production code SHA | `faa5decf` |
| Platform TFN E.164 | `+18885046264` |
| Platform PhoneNumber ID | `cmufvsanf1g0v060m13730z0q` |
| Platform owner workspace | `ws_1` |
| Twilio Incoming SID (adopted) | `PN75089bc5a9cd5d832d29a81296856d94` |

---

## Scripts

```bash
# Owner check
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-ws1-platform-owner.ts

# Readiness (set env as on Coolify)
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-mctb-platform-production-readiness.ts

# Webhooks (already run once; safe to re-run)
npx tsx scripts/configure-mctb-platform-tfn-webhooks.ts

# TFN read-only
npx tsx scripts/inspect-twilio-platform-tfn.ts
```

---

## Related docs

- Implementation: `docs/MCTB-PLATFORM-SENDER-IMPLEMENTATION-REPORT.md`
- Operator copy-paste snapshot: `docs/MCTB-PLATFORM-SENDER-MODEL-B-STATUS-REPORT.md` (point-in-time; **this file is canonical for certification status**)
