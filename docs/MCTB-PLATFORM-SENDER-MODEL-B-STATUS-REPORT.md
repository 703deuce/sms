# MCTB Platform Sender — Model B Status Report (copy-friendly)

**Generated:** 2026-09-24 (UTC)  
**Purpose:** Single file summary of ownership model, bootstrap, merge/deploy, adoption, and what remains before live certification.

---

## Ownership model (authoritative)

```
TRANSOVO / TWILIO PARENT ACCOUNT
│
├── Shared MCTB Platform Sender
│   └── +1 888 504 6264  (+18885046264)
│       └── PLATFORM-mode MCTB workspaces (many customers)
│
├── Customer A workspace
│   ├── unique MCTB forwarding / ingress DID
│   └── optional own verified sender → Customer A Twilio subaccount
│
└── Customer B, C, … (same pattern)
```

**Rules:**

| Path | Auth | Send from |
|------|------|-----------|
| `senderMode = PLATFORM` + canonical `platform_mctb_sender` + Twilio | **Parent** Twilio credentials (`getLiveParentClient()`) | `+18885046264` (from canonical `PhoneNumber.e164`, not hard-coded in send code) |
| `senderMode = WORKSPACE` + customer Twilio number | Customer workspace `MessagingRegistration` → **subaccount** | Customer’s verified sender |

**Forbidden:**

- Moving `+18885046264` to a subaccount just to satisfy `requireSubaccount()`.
- Generic fallback: “subaccount missing → use parent” for any workspace sender.
- Requiring platform-owner workspace `MessagingRegistration` to be Twilio-ready for Model B PLATFORM sends (owner can be Telnyx in DB; parent Twilio authorizes PLATFORM SMS).

**Data ownership (unchanged):**

- `Message.workspaceId`, `Conversation.workspaceId`, `MissedCallEvent.workspaceId`, Lead Recovery → **customer workspace**.
- Platform-owner workspace only holds the **shared `PhoneNumber` resource row** (DB owner), not customer conversations.

---

## Why the original merge (`bdf8052f`) could not send PLATFORM SMS

- Approved TFN lives on **Twilio parent account**.
- Default assumed owner `ws_1` had **Telnyx** `MessagingRegistration`, no Twilio `subaccountSid`.
- `sendViaRegistration` → `twilio-adapter` → `requireSubaccount(reg)` — correct for **customer** senders, wrong for **Transovo parent** platform sender.

**Model B fix:** Parent send only when **all** of:

1. `authorizedPhoneNumberId` is present  
2. `authorizedPhoneNumberId === resolveCanonicalMctbPlatformSender().phoneNumberId`  
3. Phone row has `platform_mctb_sender` role  
4. `provider = twilio`  
5. `isPhoneAuthorizedForOutboundSms(phoneNumberId).allowed` (e.g. TFV approved on row)

Otherwise → **no** parent credentials (returns `null` and falls through only for non-platform paths; WORKSPACE missing subaccount still **fails**, does not use parent).

---

## Bootstrap sequence (verified in source)

**Setup does NOT read `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` as a prerequisite.**

Correct production order:

1. Deploy Model B code on `master`  
2. Set `MCTB_PLATFORM_OWNER_WORKSPACE_ID` (explicit; setup script **requires** this env — no silent default in `setup-mctb-platform-sender.ts`)  
3. Run `setup-mctb-platform-sender.ts` with `MCTB_PLATFORM_SENDER_E164=+18885046264`  
   - Uses `adoptMctbPlatformSenderFromParentAccount()` — **does not** transfer number to subaccount  
   - **Does not** purchase number or resubmit TFV  
4. Obtain `phoneNumberId` from script output  
5. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=<that id>` on Coolify / production env  
6. Restart / redeploy so `resolveCanonicalMctbPlatformSender()` resolves the row  
7. Configure Twilio SMS webhooks on parent-owned TFN  
8. Enable `senderMode=PLATFORM` on **one** test workspace only  
9. Live PSTN certification  

**Important:** The old `importTwilioNumbersIntoWorkspace()` path would provision a subaccount and could **transfer** parent numbers — **not** used for platform setup anymore.

---

## Git / merge / deploy

| Item | Value |
|------|--------|
| Platform sender (initial) | PR #495, merge `bdf8052f` |
| Model B fix | PR #496, branch `cursor/mctb-platform-parent-twilio-send-2304` |
| **Merged to `master`** | **`faa5decf`** (`fix(mctb): bootstrap parent TFN adoption without subaccount transfer`) |
| Production health (checked 2026-09-24T18:55:21Z) | `commitSha` = **`faa5decf`** — Model B code **live** |

---

## Tests run before merge (all passed)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-parent-twilio-gate.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-sender.ts
npx tsx scripts/test-twilio-sms-webhook-signature.ts
npx tsx scripts/test-mctb-sms-sender-strict.ts
npx tsx scripts/test-mctb-durable-inbound-architecture.ts
npx tsx scripts/test-mass-texting-boundary.ts
```

---

## Database migration

- Migration: `20260924180000_mctb_platform_sender_mode`  
- Agent run: `npx prisma migrate deploy` → **no pending migrations** (21 applied).  
- Confirm on Coolify production DB: column `MissedCallTextConfig.senderMode` exists; existing rows stay **`WORKSPACE`** unless you explicitly change one test workspace.

---

## Platform TFN adoption (run against agent-connected DB)

Command used:

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
MCTB_PLATFORM_SENDER_E164=+18885046264 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/setup-mctb-platform-sender.ts
```

**First run:** `action: created`  
**Second run:** `action: already_configured` (idempotent — same ID)

| Field | Value |
|-------|--------|
| `phoneNumberId` | `cmufvsanf1g0v060m13730z0q` |
| `e164` | `+18885046264` |
| `workspaceId` (resource owner row) | `ws_1` |
| `twilioSid` | `PN75089bc5a9cd5d832d29a81296856d94` |

**You must set on production (Coolify):**

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1   # or your chosen Transovo system workspace — must match adoption
MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q
```

Then **redeploy / restart** so runtime resolver sees the env ID.

**Note:** Using `ws_1` here is the workspace ID used for the **platform PhoneNumber row** in this run. Set `MCTB_PLATFORM_OWNER_WORKSPACE_ID` explicitly in production; do not rely on code defaults for operations. Owner’s Telnyx registration does **not** block Model B sends once the above env + adoption are in place.

---

## Twilio parent TFN (read-only, pre-webhook)

- Number on **parent** account, SMS/MMS capable.  
- Webhooks were **not** configured in the last automated step (script available: `scripts/configure-mctb-platform-tfn-webhooks.ts`).

**Configure manually or via script:**

| Callback | URL |
|----------|-----|
| Inbound SMS | `POST https://<production APP_URL>/api/twilio/inbound` |
| Status | `POST https://<APP_URL>/api/twilio/message-status` |

`APP_URL` must match the public HTTPS origin Twilio calls (signature validation).

---

## Inspection commands

```bash
# DB fingerprint (no secrets)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-production-db-fingerprint.ts

# Parent TFN metadata (read-only)
npx tsx scripts/inspect-twilio-platform-tfn.ts

# Model B readiness (requires MCTB_PLATFORM_OWNER_WORKSPACE_ID)
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/inspect-mctb-platform-owner-registration.ts
```

---

## NOT done yet (blocks live certification)

- **Coolify env:** `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` set + redeploy (if not already on production server).  
- **Twilio webhooks** on `+18885046264`.  
- **One test workspace** `senderMode` → `PLATFORM` (do **not** change `phoneNumberId` / ingress DID).  
- **Live PSTN:** missed call → press 1 → SMS from `+18885046264` → reply → HELP → STOP.  
- **No** bulk PLATFORM rollout; **no** changing onboarding defaults.

---

## Key source files (Model B)

| File | Role |
|------|------|
| `src/lib/mctb/messaging/platform-parent-twilio-send.ts` | Parent Twilio send + eligibility gate |
| `src/lib/mctb/messaging/platform-sender-adopt.ts` | Adopt parent TFN without subaccount transfer |
| `src/lib/mctb/messaging/platform-sender-config.ts` | `resolveCanonicalMctbPlatformSender()` |
| `src/lib/messaging/registration-processor.ts` | Tries platform parent send before `requireSubaccount` |
| `scripts/setup-mctb-platform-sender.ts` | Idempotent adoption CLI |
| `scripts/test-mctb-platform-parent-twilio-gate.ts` | Gate + bootstrap invariants |

---

## TFV risk

- **Low** while the number stays on the parent account (no move, no re-verification).  
- **High** if moving parent → subaccount without confirmed TFV portability — **do not do** for this sender.

---

## Voice V3

No Voice V3 / LiveKit / GPT-Live changes in this workstream.

---

## Full certification doc (longer)

See also: `docs/MCTB-PLATFORM-SENDER-PRODUCTION-CERTIFICATION.md` (may be partially stale vs this report; prefer this file for Model B + `faa5decf` timeline).
