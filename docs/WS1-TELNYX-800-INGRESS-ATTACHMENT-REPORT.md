# ws_1 — Attach existing Telnyx 800 MCTB ingress (report)

**Date:** 2026-09-24 (UTC)  
**Workspace:** `ws_1`  
**STOP:** No `+1800…` number exists in the Telnyx account visible to this environment’s API key. **No ingress change was applied.**

---

## Architecture reminder

| Role | Number | Provider |
|------|--------|----------|
| Voice ingress / CFNA destination | Telnyx toll-free (target: `+1800…`) | Telnyx → MCTB TeXML → press-1 |
| PLATFORM recovery SMS sender | `+18885046264` | Twilio parent (`cmufvsanf1g0v060m13730z0q`) |

Press **1** → consent → SMS from **Twilio** `+18885046264`, **not** from the Telnyx ingress DID.  
No press-1 → **no** recovery SMS (press-1 mode).

---

## 1. Telnyx account inventory (read-only API)

**Total numbers in account:** 4  
**Numbers with literal NPA `800` (`+1800…`):** **0**

| E.164 | Telnyx ID | Status | Notes |
|-------|-----------|--------|--------|
| `+15717491060` | `3042368840018167204` | active | Local 571 — not toll-free |
| `+18666020680` | `3020837399669245525` | active | Toll-free **866** (not 800) |
| `+15714073615` | `3019061761975256346` | active | Local 571 — **current ws_1 MCTB ingress** (`MissedCallTextConfig.phoneNumberId`) |
| `+18663464256` | `3015888798992041067` | active | Toll-free **866** — ws_1 row, MCTB TeXML settings; not current `phoneNumberId` |

**Command:** `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inventory-telnyx-800-numbers.ts`

---

## 2. Selection result (800 prefix)

**No eligible `+1800…` number to select.**  
Per instructions: do **not** purchase, port, or use the Twilio platform TFN for voice.

---

## 3–4. Attachment / TeXML routing

**NOT PERFORMED** — blocked on missing `+1800…` inventory.

When a `+1800…` number exists, use:

```bash
MCTB_INGRESS_E164=+1800XXXXXXX \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/attach-telnyx-800-mctb-ingress-ws1.ts
```

This script (no purchase):

1. `importTelnyxNumbersIntoWorkspace` for `ws_1` if needed  
2. `routePhoneToMctbCallHandlingIngress` (canonical MCTB TeXML)  
3. `setActiveCallHandler({ handler: "mctb" })`  
4. Updates **`MissedCallTextConfig.phoneNumberId` only** — preserves `smsPhoneNumberId`

Dry run: `DRY_RUN=1` with the same script.

---

## 5. Platform SMS sender (unchanged)

| Field | Value |
|-------|--------|
| E.164 | `+18885046264` |
| PhoneNumber ID | `cmufvsanf1g0v060m13730z0q` |
| Role | `platform_mctb_sender` |
| Provider | Twilio parent |

**Not modified.**

For certification (when ingress is set):

- `senderMode = PLATFORM` → outbound from `+18885046264` via Model B parent path  
- Ingress DID remains separate from SMS sender  

---

## 6. Press-1 behavior

Unchanged. Consent mode on `ws_1`: **press_1** (workspace MCTB settings).

---

## 7. Current ws_1 tenant resolution (unchanged)

| Field | Current value |
|-------|----------------|
| `MissedCallTextConfig.phoneNumberId` | `cmsgtjms84g6l2h0o255w1e3v` |
| Ingress E.164 | `+15714073615` (Telnyx 571 local) |
| `senderMode` | `WORKSPACE` |
| `smsPhoneNumberId` | `cmsgtjms84g6l2h0o255w1e3v` (unchanged in this pass) |

Calls to `+15714073615` should resolve to `ws_1` via existing config.

---

## 9. Configuration summary

| Item | Value |
|------|--------|
| Workspace | `ws_1` |
| MCTB `senderMode` | `WORKSPACE` (not flipped in this pass) |
| MCTB ingress PhoneNumber ID | `cmsgtjms84g6l2h0o255w1e3v` |
| MCTB ingress E.164 | `+15714073615` |
| Ingress provider | telnyx |
| Target toll-free 800 ingress | **not assigned** |
| Press-1 | enabled (`press_1`) |
| Platform sender | `+18885046264` (Twilio parent) |
| Platform PhoneNumber ID | `cmufvsanf1g0v060m13730z0q` |

### **READY FOR CFNA TEST (to new `+1800…` ingress): NO**

Reason: no `+1800…` number in Telnyx account for this API key.

---

## Operator next steps

1. **Confirm Telnyx account** — If `+1800…` numbers exist elsewhere, point production `TELNYX_API_KEY` at that account or import numbers into this account (no purchase from this task).  
2. Re-run `scripts/inventory-telnyx-800-numbers.ts`.  
3. Run `attach-telnyx-800-mctb-ingress-ws1.ts` with `MCTB_INGRESS_E164=+1800…`.  
4. Use that **exact E.164** as CFNA forward target; after press-1, expect SMS from **`+18885046264`**.

**Optional (requires your explicit approval — not 800):** `+18666020680` is an unused **866** toll-free on `ws_1` (not current MCTB ingress). Only use if you waive the literal-800 requirement.

---

## Scripts added

- `scripts/inventory-telnyx-800-numbers.ts`  
- `scripts/attach-telnyx-800-mctb-ingress-ws1.ts`
