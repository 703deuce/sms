# ws_1 — Telnyx toll-free MCTB voice ingress (866)

**Updated:** 2026-09-24 (UTC)  
**Status:** **ATTACHED** — use this number for CFNA certification.

---

## CFNA forward target (voice ingress)

### **`+1 866 602 0680`** (`+18666020680`)

| Field | Value |
|-------|--------|
| Workspace | `ws_1` |
| PhoneNumber ID | `cmtoszkn26t6z485u3d2w3c51` |
| Telnyx provider ID | `3020837399669245525` |
| Provider | Telnyx |
| TeXML app | `3037587396909598261` |
| Voice URL | `{APP_URL}/api/telnyx/voice/mctb-entry` |
| MCTB tenant | `ws_1` (via `MissedCallTextConfig.phoneNumberId`) |
| Press-1 | `press_1` |
| **READY FOR CFNA TEST** | **YES** |

**Not used:** `+18663464256` — blocked by active Voice Agent assignment on that DID.

---

## SMS sender (unchanged — different number)

After valid press-1 consent, PLATFORM recovery SMS sends from:

**`+1 888 504 6264`** (`+18885046264`) — Twilio parent platform sender  
PhoneNumber ID: `cmufvsanf1g0v060m13730z0q`

The **866** number is **voice ingress only**, not the SMS From address.

Set `senderMode = PLATFORM` on `ws_1` when running live cert (not done in attach script).

---

## What changed

- `MissedCallTextConfig.phoneNumberId` → `cmtoszkn26t6z485u3d2w3c51` (`+18666020680`)
- `smsPhoneNumberId` **unchanged** → `cmsgtjms84g6l2h0o255w1e3v`
- `senderMode` **unchanged** → `WORKSPACE` (flip to `PLATFORM` for platform SMS cert)
- Telnyx routing → MCTB TeXML ingress (`routePhoneToMctbCallHandlingIngress`)
- Call handling → `mctb` (`setActiveCallHandler`)

---

## Call flow

```
Public business number (+15555550188)
  → no answer / CFNA
  → +18666020680 (Telnyx)
  → MCTB TeXML → press-1 disclosure
  → press 1 → consent → recovery SMS from +18885046264 (when senderMode=PLATFORM)
  → no press 1 → no recovery SMS
```

---

## Scripts

```bash
# Inventory 800/866
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inventory-telnyx-800-numbers.ts

# Attach (already run for +18666020680)
MCTB_INGRESS_E164=+18666020680 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/attach-telnyx-800-mctb-ingress-ws1.ts
```
