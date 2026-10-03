# Why ws_1 setup showed the platform sender (866) as CFNA / ingress

## Your question

You re-ran the MCTB wizard on **workspace `ws_1`**. Carrier forwarding instructions showed **+1 (866) 602-0680**, which looks like the **platform text-back sender**. You expected the wizard to **buy or assign a new toll-free** (800 / 866 / 833 / …) dedicated as **ingress only**, never the platform SMS number.

**You are correct about intended behavior.** What happened is a **state + idempotency gap on `ws_1`**, not the greenfield path new workspaces are supposed to take.

---

## Intended flow (new workspace)

When ingress mode is `toll_free_texml` (default):

1. `ensureMctbWorkspaceIngressReady()` runs during setup / onboarding API.
2. If the workspace has **no** suitable toll-free ingress yet, it calls `provisionMctbWorkspaceTollFreeIngress()`:
   - Try **`pickTelnyxTollFreeIngressE164()`** — assign an unblocked toll-free from the Telnyx pool (800/866 preferred).
   - Else **purchase** a new toll-free via `MCTB_TRIAL_TOLL_FREE_AREA_CODES` (888, 877, 866, 855, 844, 833, 800).
   - **Refuse** any row with `platform_mctb_sender` (`refuse_platform_sender_as_ingress`).
   - Set `MissedCallTextConfig.phoneNumberId` to that ingress DID only.
3. Separately, `ensureMctbPlatformSenderDefault()` sets **sender** to the canonical platform SMS number (`smsPhoneNumberId`), which must **not** be the ingress DID (`runtime-sms-phone-id.ts` comment: *"PLATFORM recovery SMS must not use the CFNA ingress toll-free"*).
4. UI forward target comes from `getProductionMctbForwardTargetE164()` → workspace **ingress** `phoneNumberId`, not the platform sender.

Other workspaces in prod already have **dedicated** ingress like `+18885559001` / `+18885559003` on `mctb_p0pf_*` workspaces — that is the path working as designed.

---

## What `ws_1` already had (before you re-ran the wizard)

On `ws_1`, **+18666020680** is stored as:

| Flag / record | Value |
|---------------|--------|
| `phone_numbers.settingsJson.platformMctbSender` | **true** (canonical platform SMS sender in DB) |
| `missedCallTextConfig.phoneNumberId` | **same row** (voice ingress / CFNA target) |
| MCTB onboarding `workspaceTollFreeNumber` / `trialNumber` | **same E.164** (marked provisioned) |
| TeXML ingress | wired on that DID (`lastProvisionedAt` ~2026-10-02 when you went through setup again) |

So **`ws_1` predates the strict split**: one toll-free was used for **cert** as both platform sender and voice ingress. That is **not** what we want for customer onboarding going forward.

---

## Why re-running the wizard did **not** buy a new 800/866

The bug/gap is in **`ensureMctbWorkspaceIngressReady()`** (`ensure-workspace-ingress.ts`):

```ts
const needsTollFree =
  !prior.provisioned ||
  !prior.trialNumber?.e164 ||
  !isNorthAmericaTollFreeE164(prior.trialNumber.e164);

if (needsTollFree) {
  await provisionMctbWorkspaceTollFreeIngress(workspaceId);
} else {
  // Reuse prior trialNumber — NO provision call
  phoneNumberId = prior.trialNumber?.phoneNumberId;
  e164 = prior.trialNumber?.e164;
}
```

For `ws_1`:

- Onboarding already said **provisioned** with **866** (toll-free).
- So `needsTollFree` is **false**.
- **`provisionMctbWorkspaceTollFreeIngress()` never runs** — no pool pick, no purchase.

Inside `provisionMctbWorkspaceTollFreeIngress`, there **is** a guard:

- `workspaceIngressAlreadyReady()` returns **not ready** if `parseMctbPhoneRole === platform_mctb_sender`.
- Import path returns **`refuse_platform_sender_as_ingress`** if the number is platform sender.

Those guards only matter **when provision runs**. They do **not** run when the early idempotency branch reuses “already provisioned” 866.

After that, setup still:

- Calls `provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, pid)` on the **existing** `phoneNumberId` (re-confirms TeXML on 866).
- Returns `productionForwardE164` = **866** → wizard carrier steps use **866** as “forward here.”

So: **the wizard did not “choose” the platform number fresh; it reused legacy `ws_1` state and skipped provisioning.**

---

## Why it “looks for” 800 / 866 toll-free at all

That is correct product behavior for **new** workspaces:

- Pool + purchase logic only considers **North American toll-free** NPAs (800, 833, 844, 855, 866, 877, 888).
- Ingress is **supposed** to be a **new or pooled** toll-free on the **workspace**, not the customer’s 571 business line.

`ws_1` never entered purchase/pool on your re-run because it thought ingress was **already done**.

---

## How this could have happened originally (cert / `ws_1`)

Likely sequence over months of cert work (not your fault):

1. Platform adopted **866** as the single Transovo MCTB platform sender on `ws_1`.
2. Early MCTB cert wired **the same DID** as TeXML CFNA ingress and stored it in onboarding + `missedCallTextConfig`.
3. Later code added **pool assignment**, **purchase**, and **`refuse_platform_sender_as_ingress`** for **new** provisions — but **did not migrate `ws_1`** or **invalidate** “provisioned” when ingress row is `platformMctbSender`.

Re-running the wizard **does not reset** that; it is treated as success path “already have toll-free.”

---

## What should change (engineering)

1. **`ensureMctbWorkspaceIngressReady`**: treat ingress as “needs provision” when current ingress/trial E.164 is `platformMctbSender` or `phoneNumberId ===` canonical platform sender id (same check as `workspaceIngressAlreadyReady`).
2. **`ws_1` one-time migration**: assign a **dedicated** pooled/purchased toll-free ingress; move `phoneNumberId` to it; keep **866** only as platform `smsPhoneNumberId`.
3. **Setup UI guard**: never display forward target if `isPlatformMctbSenderPhoneRecord(forwardTarget)`.

---

## What you should do operationally (until migration)

- Do not use `ws_1` as the template for “new customer” onboarding proof.
- For real customers, use workspaces that get **888-555-90xx**-style ingress (or fix `ws_1` via migration above).
- Forward **571 → dedicated ingress**, not “whatever number setup showed” if it matches platform sender.

---

*Code references: `ensure-workspace-ingress.ts`, `provision-workspace-toll-free-ingress.ts`, `telnyx-toll-free-ingress-pool.ts`, `production-forward-target.ts`, `runtime-sms-phone-id.ts`, `platform-sender-config.ts`.*
