# MCTB toll-free purchase investigation — `no_telnyx_toll_free_available`

**Date:** 2026-10-03  
**Scope:** Diagnostic + minimal fix for purchase fallback only (PR #578 read/provision split unchanged).

---

## Final report (summary)

| Field | Value |
|-------|--------|
| **LOCAL ELIGIBLE POOL** | **0** assignable for `ws_1` (2 Telnyx-owned TFNs in account; both blocked — platform sender + voice agent) |
| **TELNYX TFN SEARCH** | **available** (all configured NPAs return inventory via `GET /available_phone_numbers`) |
| **ROOT CAUSE OF `no_telnyx_toll_free_available`** | Purchase fallback called `messagingOnboarding.purchaseNumber()` with **standard** acquire guard. Workspaces that already have a messaging registration (e.g. `ws_1` with `+15717491060`) hit `MESSAGING_NUMBER_EXISTS`; errors were swallowed in a loop → returned `null`. **Not** Telnyx inventory exhaustion. |
| **CODE DEFECT** | **yes** — wrong purchase channel for MCTB dedicated ingress |
| **FILES CHANGED** | `src/lib/mctb/provisioning/purchase-telnyx-toll-free-ingress.ts` (new), `provision-workspace-toll-free-ingress.ts`, `scripts/diagnose-mctb-toll-free-purchase.ts`, `scripts/test-mctb-workspace-ingress-ensure.ts` |
| **READY_TO_PROVISION_TFN** | **YES** (after fix + `TRANSOVO_ALLOW_NUMBER_PURCHASE=1`; Telnyx search returns TFNs; premium acquire guard passes for `ws_1`) |

---

## 1. Trace: `purchaseTelnyxTollFree()` → `no_telnyx_toll_free_available`

### Call chain (before fix)

1. `provisionMctbWorkspaceTollFreeIngressLocked()` — pool empty / invalid ingress → `purchaseTelnyxTollFree(workspaceId)`
2. `purchaseTelnyxTollFreeDefault()`:
   - `messagingOnboarding.start(workspaceId)`
   - For each NPA in `MCTB_TRIAL_TOLL_FREE_AREA_CODES` (`888`, `877`, `866`, …):
     - `telnyxProvider.searchNumbers(areaCode)` → `GET /available_phone_numbers`
     - Pick **only** `isPreferredMctbIngressTollFreeE164` (**800** and **866** only)
     - `messagingOnboarding.purchaseNumber(workspaceId, candidate, "telnyx")`
   - Any exception → `continue`; if all NPAs fail → `return null`
3. `provisionMctbWorkspaceTollFreeIngressLocked()` — `if (!e164) return { ok: false, error: "no_telnyx_toll_free_available" }`

### Telnyx search (read path)

- **Endpoint:** `GET /available_phone_numbers` (`telnyxProvider.searchNumbers`)
- **Query:** `filter[country_code]=US`, `filter[features]=sms,voice`, `filter[limit]=20`, `filter[national_destination_code]=<NPA>`
- **Account:** production API key via `assertTelnyxConfigured()` (org subaccount context unchanged)

### Purchase (old path)

- **Not** raw search — went through `messaging/service.ts` `purchaseNumber`
- **Guard:** `assertCanPurchaseNumber(workspaceId, { source: "standard" })` → blocks if `messagingRegistration.phoneSid` is set
- **Buy:** `telnyxProvider.buyPhoneNumber` → `POST /number_orders` with dual-provision connection + messaging profile

### Condition for `no_telnyx_toll_free_available`

`purchaseTelnyxTollFree()` returned `null` — either no search candidate (old: only 800/866 preferred within each NPA) **or** every `purchaseNumber` attempt threw (confirmed for `ws_1`: messaging number already registered).

---

## 2. Read-only Telnyx search results (production credentials)

Run: `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diagnose-mctb-toll-free-purchase.ts`

| NPA | Results (limit 20) | Preferred 800/866 in page |
|-----|-------------------|---------------------------|
| 888 | 20 | 0 (but 20 valid toll-free) |
| 877 | 20 | 0 |
| 866 | 20 | 20 |
| 855 | 20 | 0 |
| 844 | 20 | 0 |
| 833 | 20 | 0 |
| 800 | 11 | 11 |

`filter[phone_number_type]=toll_free` also returns inventory (e.g. 20 on 888, 11 on 800).

**Conclusion:** `TELNYX_TOLL_FREE_INVENTORY_UNAVAILABLE` is **not** supported by evidence.

---

## 3. Code defect (demonstrated)

| Observation | Implication |
|-------------|-------------|
| `ws_1` `messagingRegistration.phoneSid` set | Standard purchase path returns `MESSAGING_NUMBER_EXISTS` |
| Simulated `purchaseNumber(ws_1, +18667480540)` | Error: *"A phone number is already registered for messaging on this workspace…"* |
| `assertCanPurchaseNumber(ws_1, { source: "premium" })` | `{ ok: true }` |
| Telnyx search returns `+18667480540` etc. | Inventory exists |

**Mismatch:** MCTB **voice ingress** is a second DID role; it must not use the messaging onboarding single-number gate.

### Fix (minimal)

- New `purchaseTelnyxTollFreeForMctbIngress()`:
  - `assertCanPurchaseNumber(..., { source: "premium" })`
  - Search all configured NPAs; prefer 800/866, else any North American toll-free in results
  - `POST /number_orders` with `connection_id: MCTB_TEXML_DEFAULT_APP_ID` (frozen TeXML ingress), **without** claiming `messagingRegistration`
- `purchaseTelnyxTollFreeDefault()` delegates to that helper

No change to GET/read path, platform-sender guards, or TeXML runtime.

---

## 4. Fallback path validation (expected after deploy)

| Case | Expected |
|------|----------|
| Local pool assignable | Reuse via `pickTelnyxTollFreeIngressE164` |
| Pool empty | Telnyx search + premium order path |
| Platform sender in pool | Blocked; purchase or other TFN |
| Valid dedicated ingress | `assessWorkspaceDedicatedMctbIngress` → no purchase |
| Concurrent provision | Existing advisory lock unchanged |

**Do not** run `migrate-ws1-dedicated-mctb-ingress.ts` repeatedly until deploy + explicit approval. One migration after `READY_TO_PROVISION_TFN` is confirmed in production.

---

## 5. Operator checklist (after merge/deploy #578 + this fix)

1. Verify production SHA / `TRANSOVO_ALLOW_NUMBER_PURCHASE=1` where purchases are intended.
2. Run migration **once:** `scripts/migrate-ws1-dedicated-mctb-ingress.ts`
3. Confirm `+18666020680` remains platform SMS sender only; note **new** dedicated ingress E.164.
4. **FORWARD 571-477-6175 TO:** `<new dedicated toll-free>` (not 866).
5. Wizard GET latency check (no Telnyx on navigation after provision).
6. Fresh-customer onboarding test; then live CFNA call on new ingress.

---

## Related

- `docs/MCTB-INGRESS-READ-PROVISION-SPLIT-REPORT.md`
- PR #578
