# MCTB number identity scope — verification report (PR #529 gate)

**Date:** 2026-09-25  
**Verdict:** **IMPLEMENTATION CORRECT — DOCUMENTATION IDENTITY SCOPE CORRECTED**  
**PR #529:** Safe to merge from a **number-identity / tenancy** perspective (subject to normal handset cert and Coolify env).

---

## Authoritative model (corrected)

| Identity | Scope |
|----------|--------|
| **#1 Customer business DID** | Per customer / workspace |
| **#2 Transovo MCTB voice-ingress DID** | **Per workspace** (Transovo-owned, assigned per tenant) |
| **#3 Transovo PLATFORM SMS sender DID** | **Global / shared** (`senderMode === PLATFORM`) |

**ws_1 exception:** One physical number (`+18666020680`) may simultaneously be ws_1 ingress **and** global platform sender. Dual-role assignment only — not the general tenancy rule.

---

## 1. Paths that assign `MissedCallTextConfig.phoneNumberId`

| Path | Mechanism |
|------|-----------|
| `src/lib/agents/missed-call-text-back/config.ts` | `updateMissedCallTextConfig` patch `phone_number_id`; default create does **not** set platform sender |
| `src/app/api/mctb/setup/route.ts` | Setup/wizard PATCH via `resolveCanonicalMctbSetupPhoneId(workspaceId, …)` — workspace-accessible phones only |
| `src/app/api/mctb/numbers/route.ts` | Explicit `phone_number_id` patch |
| `src/lib/agents/missed-call-text-back/phone-switch.ts` | Phone switch tool |
| `src/lib/mctb/texml-ingress/provision.ts` | Binds **provided** `phoneNumberId` for workspace TeXML (does not read platform env) |
| `src/lib/mctb/provisioning/telnyx-sip-ingress.ts` | Wires purchased/workspace-local DID |
| `src/lib/mctb/provisioning/provision-customer-local.ts` | Purchases/wires workspace Telnyx local |
| `src/lib/numbers/call-handling-mode.ts` | Call-handling switch |
| `src/lib/mctb/try-it/demo-voice.ts`, `src/lib/mctb/admin-test/bootstrap.ts` | Test/demo bootstrap |
| Ops scripts | `attach-mctb-number-to-workspace.ts`, `provision-ws1-*`, `heal-ws1-*`, etc. (workspace-specific) |

**Not in list:** `scripts/switch-mctb-platform-sender-to-telnyx.ts`, `platform-sender-adopt.ts` (PhoneNumber metadata only).

---

## 2. Ingress DID → workspace resolution

Incoming TeXML path:

1. `resolveMctbTexmlIngressConfig(toE164)` (`src/lib/mctb/texml-ingress/config-cache.ts`)
2. `resolveBestMctbIngressPhoneRow(toE164)` — picks phone row for **called DID**
3. `resolveMctbAssignedWorkspaceForPhone` — owner workspace where `MissedCallTextConfig.phoneNumberId === phone.id`
4. Returns `workspaceId` for consent, automation, and call handling

The **global PLATFORM SMS sender** is **not** the tenant-routing key for forwarded voice calls. Routing uses the **workspace-specific ingress DID** (identity #2).

---

## 3. New-workspace provisioning vs canonical platform sender

**Static verification:** No file under `src/lib/mctb/provisioning/`, `src/lib/mctb/texml-ingress/`, or MCTB setup APIs references `resolveCanonicalMctbPlatformSender` or `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`.

`resolveCanonicalMctbSetupPhoneId` only maps to `loadMctbSetupPhoneOptions(workspaceId)` — workspace-owned/accessible numbers, not global platform sender.

**Conclusion:** New-workspace ingress assignment is **independent** of canonical PLATFORM sender configuration.

---

## 4. Multi-workspace test

**Script:** `scripts/test-mctb-number-identity-scope.ts`

- **Static:** ingress-assignment paths must not import canonical platform sender; switch script must not touch `missedCallTextConfig`.
- **DB (when `DATABASE_URL` set):** Two workspaces with distinct ingress DIDs; global platform phone via env; asserts:
  - `ingressA` → `ws_A`, `ingressB` → `ws_B`
  - PLATFORM outbound for both uses **platform E.164**, not ingress DIDs
  - WORKSPACE mode (when authorized) uses workspace ingress `phoneNumberId`

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-number-identity-scope.ts
```

---

## 5. PLATFORM outbound test

`resolveMctbOutboundSmsRoute` (`src/lib/mctb/messaging/outbound-sms-route.ts`):

- `senderMode === "PLATFORM"` → `resolvePlatformMctbSenderRoute()` → `resolveCanonicalMctbPlatformSender()` only
- `senderMode === "WORKSPACE"` → `resolveMctbSmsSender` from `MissedCallTextConfig.phoneNumberId` / `smsPhoneNumberId`

PLATFORM path does **not** use the workspace ingress DID as `From` unless the workspace is explicitly in WORKSPACE sender mode.

---

## 6. Code correction required?

**No.** Only documentation wording was wrong. Implementation already preserved the boundary.

---

## 7. Files changed (this verification pass)

- `docs/MCTB-PLATFORM-SENDER-TELNYX-MIGRATION.md` — scope table + tenancy wording
- `docs/MCTB-PLATFORM-SENDER-TELNYX-COPY-PASTE-SUMMARY.md` — same correction
- `docs/MCTB-NUMBER-IDENTITY-VERIFICATION-REPORT.md` — this report
- `scripts/test-mctb-number-identity-scope.ts` — static + optional DB proof

---

## 8. PR #529 merge recommendation

**Safe to merge** for number-identity separation, assuming existing PR review items (handset cert, production env pointer) remain outstanding ops work — **not** blocked by ingress/platform collision.
