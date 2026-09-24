# MCTB Platform Sender — Production Certification

**Status:** IN PROGRESS — platform sender merged & deployed; **Model B source fix on branch** (not merged); adoption/webhooks/live cert **not started**

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
| **Deployed SHA (health)** | `bdf8052f` (verified 2026-09-24T18:31:04Z) |
| Health | `GET /api/health` → `ok: true`, `commitSha` = `bdf8052f…` |

Follow-up doc-only push `61d80fea` on `master` (cert + inspect script) — redeploy optional; platform sender code is `bdf8052f`.

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
| `prisma migrate deploy` | Run against agent DB: **no pending migrations** (21 applied). Operator should confirm `senderMode` column exists on production Coolify DB. |

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

## TWILIO PLATFORM ACCOUNT OWNERSHIP RESOLUTION

### Production deployment

- Coolify / health: **`bdf8052f`** live at `GET /api/health` (2026-09-24T18:31:04Z).
- GitHub Actions on `master` show fast-fail CI (environmental); deploy succeeded via Coolify.

### Production DB

| Check | Result |
|-------|--------|
| Agent `DATABASE_URL` host fingerprint | `aws-…us-east-2.pooler.supabase.com` (masked) |
| Workspaces | 2 |
| Active PhoneNumbers | 5 (0 Twilio, 5 Telnyx in snapshot) |
| MessagingRegistrations | 1 |
| Twilio regs with `subaccountSid` | **0** |
| **PRODUCTION DB CONFIRMED** | **LIKELY YES** — health SHA matches merged platform-sender release; operator must confirm Coolify `DATABASE_URL` host matches this fingerprint. Prior `ws_1` Telnyx findings apply to this DB. |

### Twilio parent account (read-only API)

| Field | Value |
|-------|--------|
| Parent Account SID configured | yes (masked `AC…e40f`) |
| Parent auth (`TWILIO_*`) | configured in agent env |
| Platform TFN `+18885046264` on parent | **yes** (`ownedByParentAccount: true`) |
| Incoming PhoneNumber SID | masked `PN…6d94` |
| SMS / MMS capability | true / true |
| Messaging Service on number | not required for direct `From` send |
| Webhooks on number | not configured yet (`smsUrl` / `statusCallback` empty) — expected pre-cert |

### Twilio subaccounts

- Sample list: **11** active subaccounts under parent (ISV model).
- **None** own `+18885046264` (number only on parent).
- DB has **zero** workspace Twilio registrations with `subaccountSid` — customer Twilio send path is not represented in this DB snapshot; unrelated to platform TFN placement.

### Platform TFN state

- Ownership: **parent account** (intentional Transovo platform resource).
- TFV: approved in Twilio console (not re-fetched in this pass); import via `setup-mctb-platform-sender.ts` persists TFV in `PhoneNumber.settingsJson`.
- **Do not move** to subaccount for `sendViaRegistration` convenience.

### `requireSubaccount` — why it blocked PLATFORM

- `requireSubaccount()` in `twilio-adapter.ts` is an **ISV/workspace architectural choice** for customer-owned numbers on Twilio **subaccounts**, not a universal Twilio API rule.
- `getLiveParentClient()` is already used for **parent-account** operations (e.g. subaccount provisioning).
- PLATFORM MCTB path on `master` still calls `sendViaRegistration` → Twilio provider → `requireSubaccount(reg)` using platform-owner workspace registration → **fails** when owner reg is Telnyx / no subaccount.

### Selected model

**B — Parent-account platform sender credentials** (product intent confirmed).

- WORKSPACE + customer Twilio → unchanged subaccount path.
- PLATFORM + canonical `platform_mctb_sender` + `provider=twilio` → **parent** `getLiveParentClient().messages.create({ from: platform E.164 })`.
- Customer `Message` / `Conversation` / `MissedCallEvent` `workspaceId` unchanged.

### Required source change (implemented, **not merged**)

**Branch:** `cursor/mctb-platform-parent-twilio-send-2304`

| File | Change |
|------|--------|
| `src/lib/mctb/messaging/platform-parent-twilio-send.ts` | **NEW** — `trySendMctbPlatformParentTwilio` gated on `authorizedPhoneNumberId === resolveCanonicalMctbPlatformSender().phoneNumberId` |
| `src/lib/messaging/registration-processor.ts` | Invoke platform parent send **before** `requireSubaccount` path |
| `src/lib/sms/send-quick.ts` | Allow send when canonical platform phone is authorized even if owner `MessagingRegistration` is not messaging-ready |
| `src/lib/mctb/platform-owner-workspace.ts` | `requireMctbPlatformOwnerWorkspaceId()` for explicit setup (no silent `ws_1` in ops scripts) |
| `scripts/inspect-production-db-fingerprint.ts`, `scripts/inspect-twilio-platform-tfn.ts` | Diagnostics |

**Safety:** No generic “missing subaccount → parent” fallback. Parent credentials only when phone ID is the **canonical** MCTB platform sender.

### Required Twilio operational change

- After merge of Model B fix + adoption: set inbound + status webhooks on TFN (or owning Messaging Service).
- Set `MCTB_PLATFORM_OWNER_WORKSPACE_ID` and `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` explicitly in production env.

### TFV risk

- **Low** if number stays on parent (no move, no re-verification).
- **High** if TFN is moved parent → subaccount without Twilio TFV portability proof — **not recommended**.

### Next exact step (before platform-number adoption)

1. **Merge** `cursor/mctb-platform-parent-twilio-send-2304` → deploy.
2. Set `MCTB_PLATFORM_OWNER_WORKSPACE_ID` (Transovo resource workspace; not assumed `ws_1`).
3. Run `setup-mctb-platform-sender.ts` (idempotent).
4. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`.
5. Configure Twilio webhooks.
6. One test workspace `senderMode=PLATFORM` → live cert.

---

## Outstanding issues (block broader rollout)

1. **Model B send path** — on branch; merge + deploy required before live PLATFORM SMS.
2. **Platform owner env** — set `MCTB_PLATFORM_OWNER_WORKSPACE_ID` deliberately; do not rely on `ws_1` default for ops.
3. **Platform PhoneNumber row** — not adopted in DB yet (`0` Twilio phones in snapshot).
4. **Twilio webhooks** — not configured on TFN.
5. **Controlled workspace cert** — after 1–4.

---

## Next steps (operator)

1. Merge `cursor/mctb-platform-parent-twilio-send-2304`; verify health SHA after deploy.
2. Confirm `senderMode` column on production DB (`prisma migrate deploy` if pending on Coolify DB).
3. Set `MCTB_PLATFORM_OWNER_WORKSPACE_ID`; run `inspect-mctb-platform-owner-registration.ts` with `REQUIRE_EXPLICIT_PLATFORM_OWNER=1`.
4. Run `setup-mctb-platform-sender.ts` twice (idempotency check).
5. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`; redeploy if required.
6. Configure Twilio webhooks on TFN (or owning Messaging Service).
7. Enable `senderMode=PLATFORM` on **one** internal test workspace only.
8. Execute PSTN matrix (§16–20 in deployment runbook).
