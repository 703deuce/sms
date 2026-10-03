# MCTB onboarding: ingress checks, repeated “ensure,” and wizard slowness

Consolidated notes from product/engineering review (for handoff). Covers: why the wizard showed/reused 866, why “already has toll-free” checks exist, and why setup feels slow (~40s between steps).

---

## Part 1 — Why does setup check “already has a toll-free (866)?”

### Intended behavior (what onboarding should feel like)

Open the wizard → get **one new toll-free ingress** → that’s the CFNA forward target. There should not be a branch that says “oh, you already have an 866, never mind.”

### It’s not really “checking for 866”

The code does not special-case 866. It checks something broader:

**“Does this workspace already have a toll-free marked as provisioned in MCTB onboarding state?”**

That comes from `getTrialNumberStatus()` → `workspaceTollFreeNumber` / `trialNumber` (any toll-free NPA: 800, 833, 844, 855, **866**, 877, 888).

In `ensureMctbWorkspaceIngressReady()` the gate is:

- not provisioned yet, **or**
- no E.164, **or**
- E.164 is **not** North American toll-free  

→ only then call “buy/pool a new ingress.”

If onboarding already says “provisioned” with **any** toll-free (including 866), it **skips** buy/pool and reuses that row. That’s why `ws_1` never got a fresh number when re-running the wizard.

### Intended flow (new workspace)

When ingress mode is `toll_free_texml` (default):

1. `ensureMctbWorkspaceIngressReady()` runs during setup / onboarding API.
2. If the workspace has **no** suitable toll-free ingress yet, it calls `provisionMctbWorkspaceTollFreeIngress()`:
   - Try **`pickTelnyxTollFreeIngressE164()`** — assign an unblocked toll-free from the Telnyx pool (800/866 preferred).
   - Else **purchase** a new toll-free via `MCTB_TRIAL_TOLL_FREE_AREA_CODES` (888, 877, 866, 855, 844, 833, 800).
   - **Refuse** any row with `platform_mctb_sender` (`refuse_platform_sender_as_ingress`).
   - Set `MissedCallTextConfig.phoneNumberId` to that ingress DID only.
3. Separately, `ensureMctbPlatformSenderDefault()` sets **sender** to the canonical platform SMS number (`smsPhoneNumberId`), which must **not** be the ingress DID.
4. UI forward target comes from `getProductionMctbForwardTargetE164()` → workspace **ingress** `phoneNumberId`, not the platform sender.

Other workspaces in prod already have **dedicated** ingress like `+18885559001` / `+18885559003` — that path works as designed.

### What `ws_1` already had (before re-running the wizard)

On **`ws_1`**, **+18666020680** was already stored as:

| Flag / record | Value |
|---------------|--------|
| `phone_numbers.settingsJson.platformMctbSender` | **true** (canonical platform SMS sender in DB) |
| `missedCallTextConfig.phoneNumberId` | **same row** (voice ingress / CFNA target) |
| MCTB onboarding `workspaceTollFreeNumber` / `trialNumber` | **same E.164** (marked provisioned) |
| TeXML ingress | wired on that DID |

So **`ws_1` predates the strict split**: one toll-free was used for cert as both platform sender and voice ingress. That is **not** what we want for customer onboarding going forward.

### Why re-running the wizard did **not** buy a new 800/866

Gap in **`ensureMctbWorkspaceIngressReady()`** (`ensure-workspace-ingress.ts`):

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

- `workspaceIngressAlreadyReady()` returns **not ready** if `platform_mctb_sender`.
- Import path returns **`refuse_platform_sender_as_ingress`**.

Those guards only run **when provision runs**. They do **not** run when the early idempotency branch reuses “already provisioned” 866.

After that, setup still:

- Calls `provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, pid)` on the **existing** `phoneNumberId` (re-confirms TeXML on 866).
- Returns `productionForwardE164` = **866** → wizard carrier steps use **866** as “forward here.”

So: the wizard did not “pick platform sender” in the purchase step; it **reused legacy `ws_1` state** and skipped provisioning.

### Why the “already provisioned” check exists (engineering vs product)

It’s **idempotency**, not “find an 866”:

- Setup/onboarding APIs get hit **many times** (page load, wizard steps, refresh, back button).
- Without “already done,” each call could try to pool/purchase again → duplicate numbers, races, double Telnyx orders.
- Pattern: **first time provision; later calls no-op** if state says provisioned.

That’s reasonable for **retries during the same onboarding**.

It is **not** reasonable when:

- State is **wrong** (platform sender stored as “your ingress”), or
- User **re-runs** setup on a **cert/legacy** workspace (`ws_1`), or
- You want a clean start but old `workspaceTollFreeNumber` still points at the bad DID.

For a **true new customer**, “already has toll-free” should almost never be true on the **first** successful provision — only on **subsequent HTTP calls** in the same flow.

Legitimate cases for idempotency:

1. Same wizard session, multiple API calls — don’t buy five toll-frees because the phone step loaded five times.
2. Resume onboarding — same ingress, don’t purchase again.
3. Deploy/restart — worker retries without duplicating inventory.

What it does **not** do well today:

- **Validate** stored number is **dedicated ingress** (not `platformMctbSender`).
- **Distinguish** valid resume vs legacy bad assignment.
- **Reset** when ingress === platform sender.

### What onboarding should align to

**First-time path:**

- Provision **once** → persist ingress id + E.164 → UI always uses that forward target.
- Retries: “if **this workspace’s canonical ingress** is already set **and valid**, don’t buy again” — not “if any toll-free is in JSON, skip.”

**“Valid”** should mean at least:

- dedicated ingress role (`customer_mctb`, not `platform_mctb_sender`),
- matches `missedCallTextConfig.phoneNumberId`,
- TeXML route verified.

If any of that fails → **provision a new one**, even if onboarding says provisioned.

### Engineering fixes (product terms)

1. **`ensureMctbWorkspaceIngressReady`**: treat ingress as “needs provision” when current ingress/trial E.164 is `platformMctbSender` or equals canonical platform sender id.
2. **`ws_1` one-time migration**: dedicated pooled/purchased toll-free ingress; keep **866** only as platform `smsPhoneNumberId`.
3. **Setup UI guard**: never display forward target if it is the platform sender record.

**Code references:** `ensure-workspace-ingress.ts`, `provision-workspace-toll-free-ingress.ts`, `telnyx-toll-free-ingress-pool.ts`, `production-forward-target.ts`, `runtime-sms-phone-id.ts`, `platform-sender-config.ts`.

Related incident docs: `docs/MCTB-WHY-WS1-SHOWED-PLATFORM-NUMBER-AS-INGRESS.md`, `docs/MCTB-INGRESS-VS-SENDER-AND-2026-10-03-CALL.md`.

---

## Part 2 — Why does “ensure” run again and again? Why ~40s between wizard steps?

### Expected model

1. **Once** (explicit step or first phone step): buy/assign toll-free → write `phone_numbers` + `missedCallTextConfig.phoneNumberId` + onboarding state → point Telnyx at TeXML.
2. **Every wizard page after that**: read those rows and return JSON. **No** Telnyx purchase, **no** re-routing, **no** “ensure” side effects on GET.

That’s “check the database.” After first provision, reads should be DB (+ light config), not full provision pipeline.

### What actually happens today

Almost every wizard step load runs **`ensureMctbWorkspaceIngressReady()`** on:

- `GET /api/mctb/onboarding`
- `GET /api/mctb/setup`
- several onboarding POST paths

That helper was meant for **“make sure ingress exists”** (retries, workers), but it’s on **read paths**, so it runs **on every navigation**.

Even when it **does not** buy a new number (e.g. `ws_1` / 866), it still runs at the end of **every** call:

```ts
await ensureMctbPlatformSenderDefault(workspaceId).catch(() => undefined);
// ...
if (pid) {
  await provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, pid).catch(() => undefined);
  await warmMctbInboundRoutingProfileForWorkspace(workspaceId).catch(() => undefined);
}
```

`provisionMctbPhoneTexmlIngressModeForWorkspace` is **not** a DB read. It:

- loads config/consent/schedule from DB,
- **HTTP preflight** to the TeXML entry URL,
- **Telnyx API** (patch TeXML app, route the DID again),
- updates `phone_numbers.settingsJson`.

So **~40 seconds** between steps is largely **repeated Telnyx + preflight + DB writes**, not “which number is in the database.”

Onboarding `GET` also runs **`syncTrialTollFreeVerification`** (and other work) before returning step state — more cost on every load.

### Why “ensure” was put on every request

Defensive intent (not “buy another number every time”):

- Refresh mid-step → don’t leave user without ingress.
- After deploy, re-patch Telnyx so voice still works.
- Workers share the same helper.

That’s **repair/ops** logic, not **wizard read** logic. On every `GET` it causes:

- slow steps,
- duplicate Telnyx traffic,
- reusing bad “already provisioned” state without fixing ingress.

There is **no product benefit** to full TeXML re-provision on each “Next” when the workspace already has a valid ingress row.

### “Why check if it already has a toll-free?” (retry vs forever)

For a **new** workspace, that check only prevents **duplicate purchases in the same minute** (double-click, remount, two tabs).

It should **not** mean “forever skip provisioning because onboarding JSON says provisioned” when that number is wrong (e.g. platform sender).

After first successful provision, the fast path should be:

- `missedCallTextConfig.phoneNumberId` + `phone_numbers.e164` exist, **and**
- ingress is valid (not platform sender, TeXML configured),

→ **return immediately**, no Telnyx.

Not: “`trialNumber` exists → run full ensure pipeline again.”

### Direct Q&A

| Question | Answer |
|----------|--------|
| Why run multiple times for the same 866? | Every onboarding/setup **GET** calls `ensureMctbWorkspaceIngressReady`, which **re-runs TeXML routing** even when no new number is bought. |
| Shouldn’t it buy once and then only read DB? | **Yes.** |
| Why would it need to purchase again? | It **shouldn’t**, except first provision or explicit reprovision. |
| Why ~40s between pages? | **Repeated ensure + Telnyx + preflight**, not a simple DB lookup. |

### Recommended code changes

1. **Split** `ensureMctbWorkspaceIngressReady` into:
   - **`provisionWorkspaceIngressOnce`** — buy/pool, Telnyx wire, writes DB (dedicated onboarding action or first phone POST only).
   - **`getWorkspaceIngressStatus`** — read DB only, fast.
2. **Remove** ensure/provision from `GET` onboarding/setup; only invoke provision on explicit action (e.g. `provision_workspace_ingress` or first phone step POST).
3. **Validity gate**: “already provisioned” = canonical ingress in DB is **valid**, not merely `workspaceTollFreeNumber` set.
4. Optional UX: one screen **“Setting up your forwarding number…”** during the one-shot provision instead of blocking every step.

---

*End of handoff document.*
