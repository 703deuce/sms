# MCTB ingress read/provision split — implementation report

**Date:** 2026-10-03  
**Branch:** `cursor/mctb-ingress-read-provision-split-f350`  
**PR:** https://github.com/703deuce/sms/pull/578 (draft)

---

## Root cause

The handoff was correct on both defects:

1. **Validity** — `ensureMctbWorkspaceIngressReady()` treated “onboarding has a toll-free” as provisioned, so ws_1 kept **+18666020680** (canonical platform SMS sender) as `MissedCallTextConfig.phoneNumberId` / CFNA target. The toll-free pool also allowed reuse when `platformMctbSender: true` but `mctbRole` was not `platform_mctb_sender` (dual-role legacy row).

2. **Performance** — Every `GET /api/mctb/onboarding` and `GET /api/mctb/setup` called `ensureMctbWorkspaceIngressReady()`, which ran TeXML mode provision, routing warm, and platform-sender ensure even when ingress looked “done.”

**Implementation note:** Validity on reads uses **persisted** DB/onboarding markers (`mctb_texml` routing owner, `mctbSipIngress`, etc.), not live Telnyx verification on each GET (per product amendment).

---

## Code changes

| Area | Files / functions |
|------|-------------------|
| Validity (read-only) | `src/lib/mctb/provisioning/workspace-ingress-validity.ts` — `assessWorkspaceDedicatedMctbIngress()` |
| Read API | `src/lib/mctb/provisioning/get-workspace-ingress-status.ts` — `getWorkspaceIngressStatus()` |
| Idempotent provision | `src/lib/mctb/provisioning/ensure-workspace-ingress.ts` — fast path when valid; else `provisionMctbWorkspaceTollFreeIngress()` |
| Pool / provision | `telnyx-toll-free-ingress-pool.ts`, `provision-workspace-toll-free-ingress.ts` — block `platformMctbSender`; skip pool pick; fall through to purchase |
| GET routes | `src/app/api/mctb/onboarding/route.ts`, `src/app/api/mctb/setup/route.ts` — read-only ingress status; removed ingress ensure from GET and from `business_line` POST side effect |
| Trial status | `src/lib/mctb/onboarding/trial-number.ts` — no write-on-read; invalid ingress → `provisioned: false` |
| Forward target guard | `src/lib/mctb/production-forward-target.ts` — refuses platform sender / canonical platform ID |
| Tests / ops | `scripts/test-mctb-workspace-ingress-lifecycle.ts`, `scripts/migrate-ws1-dedicated-mctb-ingress.ts`; updated static contract scripts |

---

## GET behavior (before vs after)

| | **Before** | **After (this branch)** |
|---|------------|-------------------------|
| Onboarding/setup GET | `ensureMctbWorkspaceIngressReady()` → TeXML PATCH, warm, sender ensure | `getWorkspaceIngressStatus()` → Prisma + config reads only |
| External Telnyx on wizard Next | Often yes (~40s reported) | **After deploy + valid ingress:** should be DB-only (verify in browser post-deploy) |
| Writes on read | Possible via trial-number auto-save | Removed that auto-save path |

---

## Provision behavior

- **Idempotency:** Unchanged lock (`withMctbWorkspaceIngressProvisionLock`); valid dedicated ingress → same `phoneNumberId` / E.164, no repurchase (covered in `test-mctb-workspace-ingress-lifecycle.ts`).
- **Invalid legacy (platform sender as ingress):** Treated as not ready → explicit `provision_workspace_ingress` / ensure path must assign a **different** dedicated TFN.
- **Concurrent:** Lifecycle test asserts one canonical assignment under concurrent provision calls.

---

## ws_1 migration

| | Value |
|---|--------|
| **Platform SMS sender (unchanged)** | **+18666020680** (`cmtoszkn26t6z485u3d2w3c51`) |
| **OLD ingress (invalid)** | Same as platform sender — correctly flagged `platform_sender` |
| **NEW dedicated ingress** | **Not assigned yet** — dry-run against prod DB after pool fix: assignable pool for `ws_1` is **empty**; `purchaseTelnyxTollFree` returned `no_telnyx_toll_free_available` |
| **TeXML** | No new ingress DID to route until purchase/pool assignment succeeds |

After **merge + deploy**, run:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/migrate-ws1-dedicated-mctb-ingress.ts
```

Optional workspace override:

```bash
MCTB_WS1_MIGRATION_WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/migrate-ws1-dedicated-mctb-ingress.ts
```

Resolve Telnyx inventory/purchase (or ops assignment of a non-platform TFN to ws_1) if migration still returns `no_telnyx_toll_free_available`.

---

## Owner action (when new ingress exists)

```
FORWARD 571-477-6175 TO: <new dedicated toll-free — NOT +18666020680>
```

Until migration succeeds, the UI should show **unprovisioned / invalid ingress** (not the platform sender as CFNA target) once this build is live.

**Do not** tell the owner to forward to the platform SMS sender (+18666020680). That number remains the platform recovery SMS sender only.

---

## Fresh workspace / browser proof

Not completed in the implementation pass: needs **deployed** app + handoff §15 browser run.

Post-deploy checklist:

1. Authenticate with isolated certification identity.
2. Enter MCTB onboarding in browser.
3. Reach ingress provisioning; allow **one** `provision_workspace_ingress` mutation.
4. Receive ONE dedicated toll-free ingress.
5. Navigate backward/forward/reload — same ingress, no extra purchase.
6. Configure Existing Consent + Transovo platform sender.
7. Stop at external CFNA/live-test boundary.

Verify: business line ≠ ingress ≠ platform sender role (distinct phone-number resources).

Post-deploy onboarding latency: record route/step, request, server duration, visible transition, whether Telnyx was contacted — several Next/Back/refresh cycles **after** ingress exists; expect no repeated Telnyx provisioning traffic.

---

## Tests run

```bash
npx tsx scripts/test-mctb-workspace-ingress-ensure.ts
npx tsx scripts/test-mctb-e2e-bootstrap-static.ts
npx tsx scripts/test-mctb-trial-ingress-provision-contract.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-workspace-ingress-lifecycle.ts
```

All reported **PASS** (lifecycle DB section requires `DATABASE_URL`).

---

## Product invariant (locked)

For every normal MCTB customer workspace:

- **Business line** → customer’s existing telephone number  
- **MCTB ingress** → dedicated Transovo toll-free DID assigned to that workspace for CFNA/voice ingress  
- **Platform SMS sender** → canonical Transovo platform sender used for outbound recovery SMS  

These are distinct roles. A platform sender **must not** qualify as dedicated MCTB ingress merely because it is toll-free.

---

## Next steps

1. Merge/deploy PR #578.  
2. Run ws_1 migration when Telnyx can supply or assign a dedicated TFN.  
3. Browser onboarding latency check (no Telnyx on wizard navigation after provision).  
4. Resume clean-customer onboarding test using the **new** dedicated ingress only.

---

## Related docs

- `docs/MCTB-ONBOARDING-INGRESS-DESIGN-CRITIQUE.md`
- `docs/MCTB-WHY-WS1-SHOWED-PLATFORM-NUMBER-AS-INGRESS.md`
- `docs/MCTB-INGRESS-VS-SENDER-AND-2026-10-03-CALL.md`
