# MCTB Platform Sender — Production Certification

**Status:** IN PROGRESS — merge complete; deployment and platform Twilio prerequisites **not green**

**Last updated:** 2026-09-24 (UTC)

---

## Deployment

| Item | Value |
|------|--------|
| Feature branch | `cursor/mctb-platform-sender-impl-2304` |
| Branch HEAD (pre-merge) | `bdf8052f` |
| PR | #495 |
| Merge to `master` | Fast-forward `1691b386` → `bdf8052f` |
| Merge timestamp | 2026-09-24 ~18:18 UTC |
| Expected production SHA | `bdf8052f` |
| **Deployed SHA (health)** | `1691b386` (as of 2026-09-24T18:24:59Z) |
| Health | `GET /api/health` → `ok: true`, commitSha still prior release |

**Action required:** Wait for Coolify automatic deploy from `master` push. Re-check health until `commitSha` starts with `bdf8052f`. Do **not** run platform adoption against old runtime.

---

## Pre-merge verification (completed)

- Working tree clean at `bdf8052f`
- No `src/lib/voice-v3/**` files in branch diff
- Tests passed: `test-mctb-platform-sender`, `test-twilio-sms-webhook-signature`, `test-mctb-sms-sender-strict`, `test-mctb-durable-inbound-architecture`, `test-mass-texting-boundary`
- `test-call-handling-ownership.ts` **fails on `master` and branch** (line 176 — `resolve-ai-receptionist.ts` string assertion); **pre-existing**, not introduced by platform sender

---

## Migration

| Item | Status |
|------|--------|
| Migration | `20260924180000_mctb_platform_sender_mode` |
| `prisma migrate deploy` | **NOT RUN** — blocked until deployed SHA = `bdf8052f` per runbook order |

After deploy, run on production DB host:

```bash
npx prisma migrate deploy
```

Verify `MissedCallTextConfig.senderMode` exists; all existing rows remain default `WORKSPACE`.

---

## Platform owner — registration readiness

Inspection script: `scripts/inspect-mctb-platform-owner-registration.ts`

Run (production DB + Twilio credentials):

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=<verified-owner> \
MCTB_PLATFORM_SENDER_E164=+18885046264 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-mctb-platform-owner-registration.ts
```

### Findings (environment connected to agent `DATABASE_URL`, owner default `ws_1`)

| Check | Result |
|-------|--------|
| Workspace ID | `ws_1` (`MCTB_PLATFORM_OWNER_WORKSPACE_ID` unset → default) |
| Registration exists | yes |
| Provider | **telnyx** (not Twilio) |
| overallStatus | `in_review` |
| messagingEnabled | false |
| subaccountSid present | **no** |
| messagingServiceSid present | yes |
| `isMessagingSendAuthorized` | **no** |
| `sendViaRegistration` prerequisites | **no** |
| Twilio list: `+18885046264` | **found on parent account** (`source: parent`, SID present) |
| Registration `phoneE164` | `+18663464256` (different number) |

### STOP — account ownership mismatch

`sendViaRegistration` → `requireSubaccount(reg)` uses **Twilio subaccount** credentials on the **platform-owner workspace’s** `MessagingRegistration`.

Current default owner `ws_1` is **Telnyx-registered without Twilio subaccount**. The approved platform TFN appears on the **Twilio parent** account, not on that subaccount.

**Do not** run `setup-mctb-platform-sender.ts` for production send until:

1. **`PLATFORM_OWNER_WORKSPACE_ID`** is set to the workspace that owns the correct **Twilio** `MessagingRegistration` (subaccount + auth token), **and**
2. That subaccount (or configured Messaging Service) is verified to **send from `+18885046264`**, **or**
3. An intentional, reviewed account move attaches the TFN to the subaccount used by `requireSubaccount` (no auto-transfer in scripts).

Also: DB query showed **0** workspaces with `messagingProvider=twilio` and non-null `subaccountSid` in this database snapshot — confirm production DB identity before trusting this count.

---

## Platform sender adoption

| Step | Status |
|------|--------|
| `setup-mctb-platform-sender.ts` | **NOT RUN** (blocked by registration STOP + undeployed SHA) |
| `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | **NOT SET** |

---

## Twilio webhooks

| Callback | URL |
|----------|-----|
| Inbound SMS | `POST https://<APP_URL>/api/twilio/inbound` |
| Status | `POST https://<APP_URL>/api/twilio/message-status` |

**NOT configured** in this pass (blocked until platform owner + adoption).

Configure at **Incoming Phone Number** or **Messaging Service** level for `+18885046264` once account ownership is resolved.

`APP_URL` must match the public HTTPS origin Twilio calls (signature validation uses `resolveTwilioWebhookRequestUrl`).

---

## Test workspace / PLATFORM mode

**NOT enabled.** No controlled workspace selected; no `senderMode=PLATFORM` changes.

---

## Live certification (PSTN / SMS)

**NOT PERFORMED** — prerequisites failed:

- Deployed SHA not updated
- Platform-owner Twilio registration not satisfied
- Platform number not adopted
- Webhooks not configured

---

## Regressions

Not re-run in production after deploy (deploy pending).

---

## Outstanding issues (block broader rollout)

1. **Coolify deploy** — production health still on `1691b386`; wait and verify `bdf8052f`.
2. **Platform owner workspace** — must not default to `ws_1` if that workspace is Telnyx-only; designate Transovo Twilio ISV owner workspace and set `MCTB_PLATFORM_OWNER_WORKSPACE_ID`.
3. **Twilio subaccount vs parent TFN** — `+18885046264` on parent account vs `requireSubaccount` on owner registration; resolve before first live SMS.
4. **Migration** — apply after deploy.
5. **Controlled workspace cert** — only after 1–4 are green.

---

## Next steps (operator)

1. Confirm Coolify build finished; health `commitSha` = `bdf8052f`.
2. `npx prisma migrate deploy`.
3. Re-run `inspect-mctb-platform-owner-registration.ts` with correct `PLATFORM_OWNER_WORKSPACE_ID`.
4. Fix Twilio account/subaccount relationship if inspection still fails.
5. Run `setup-mctb-platform-sender.ts` twice (idempotency check).
6. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`; redeploy if required.
7. Configure Twilio webhooks on TFN (or owning Messaging Service).
8. Enable `senderMode=PLATFORM` on **one** internal test workspace only.
9. Execute PSTN matrix (§16–20 in deployment runbook).
