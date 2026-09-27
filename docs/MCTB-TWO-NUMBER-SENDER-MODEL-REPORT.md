# MCTB Two-Number Model — Audit, UI, and Persistence Report

**Date:** 2026-09-24 (UTC)  
**Context:** Live PLATFORM recovery SMS succeeded from **+1 888-504-6264** after forwarded press-1 on ws_1. This document locks the **ingress vs SMS sender** product model for copy/paste and operator reference.

**Implementation PR:** [#498](https://github.com/703deuce/sms/pull/498) — branch `cursor/mctb-sender-mode-ui-2304`

---

## Architecture (permanent)

There are **two different phone-number concepts** in MCTB. Do not mix them.

### 1. MCTB ingress / call-forwarding number

Every workspace has its own number that unanswered business calls are **forwarded TO** (CFNA).

```
Business public number
  → no answer / CFNA
  → workspace-specific Telnyx toll-free (or ingress DID)
  → MCTB voice runtime (TeXML / press-1)
```

- **DB field:** `MissedCallTextConfig.phoneNumberId`
- **Role:** Identifies workspace on **voice** ingress; receives forwarded calls
- **Is NOT** necessarily the SMS sender

### 2. MCTB SMS sender

Customer chooses **how recovery SMS** are sent:

| Mode | Customer-facing label | Runtime |
|------|----------------------|---------|
| **PLATFORM** | Transovo Platform Number | `senderMode = PLATFORM` → canonical **platform sender resolver** → today Twilio parent **+18885046264** (infrastructure; not shown in UI) |
| **WORKSPACE** | My Verified Number | `senderMode = WORKSPACE` → `smsPhoneNumberId` → customer's verified toll-free or 10DLC |

**Durable workspace choice for platform:** `senderMode = PLATFORM` — **not** `senderPhoneNumber = +18885046264`.

Future: platform pool, Telnyx platform TFN, rotation/migration — resolver owns physical sender; workspaces do not store literal platform E.164 as their “selection.”

### Field semantics (do not infer legacy coupling)

| Field | Meaning |
|-------|---------|
| `phoneNumberId` | Voice ingress / forwarding destination |
| `senderMode` | `PLATFORM` or `WORKSPACE` |
| `smsPhoneNumberId` | Customer's outbound sender when `WORKSPACE`; optional stored value when `PLATFORM` (runtime ignores while PLATFORM active) |

**Wrong model:** `phoneNumberId == outbound SMS sender`

**Correct:**

- **PLATFORM:** `phoneNumberId` → ingress; `senderMode = PLATFORM` → platform resolver
- **WORKSPACE:** `phoneNumberId` → ingress; `senderMode = WORKSPACE`; `smsPhoneNumberId` → verified customer sender

---

## 1. Existing setup UI behavior (before UI lock)

| Surface | Behavior |
|--------|----------|
| **Phone & Forwarding** (`setup-phone-forwarding-view.tsx`) | Business line + **forwarding destination** (`phoneNumberId` / production forward E.164). |
| **Misleading copy (fixed in PR)** | Ingress block said **“Text-back sender · Ready/Pending”** — implied 866 ingress was SMS From. |
| **Text Back** | Template + timing only — **no sender mode** UI. |
| **Consent** | “Text-back sender” used **ingress** (`phoneNumberId`), not `smsPhoneNumberId` / `senderMode`. |
| **Setup overview / Home** | `senderLabel` used `smsPhoneNumberId \|\| phoneNumberId` — often showed **ingress**, not platform vs workspace. |

There was **no** customer **PLATFORM vs WORKSPACE** control in UI. `senderMode` existed in DB/API; ws_1 was set manually for cert.

---

## 2. Existing API / persistence behavior (before fixes)

- `sender_mode` patchable via `updateMissedCallTextConfig`; setup POST did **not** accept `senderMode` from UI.
- **Legacy coupling:** on ingress change, POST could set `sms_phone_number_id` = new `phone_number_id`.
- **Stale repair on GET:** `sms_phone_number_id: sanitizedSms \|\| sanitizedPhone` — tied ingress to SMS even in **PLATFORM** mode.
- **Runtime (already correct, unchanged):** `resolveMctbOutboundSmsRoute` — `PLATFORM` → canonical platform sender; `WORKSPACE` → `smsPhoneNumberId`. Model B parent-Twilio send path **not redesigned**.

---

## 3. Files changed (PR #498)

- `src/components/mctb/setup/mctb-text-message-sender-section.tsx` — new UI
- `src/components/mctb/setup/setup-text-back-view.tsx` — sender section + save
- `src/app/api/mctb/setup/route.ts` — `senderMode`, decoupling, validation
- `src/lib/mctb/setup-sender-patch.ts` — patch/repair rules
- `src/lib/mctb/sender-mode-ui.ts` — labels, filters, summaries
- `src/components/mctb/setup/setup-phone-forwarding-view.tsx` — ingress copy only
- `src/components/mctb/setup/setup-consent-view.tsx` — sender summary labels
- `src/lib/mctb/setup-overview-model.ts`, `src/lib/mctb/overview.ts` — overview sender labels
- `scripts/test-mctb-setup-sender-mode-boundary.ts` — regression script
- `scripts/enable-ws1-mctb-platform-sender-mode.ts` — cert-only ws_1 PLATFORM flip (separate PR #497)

---

## 4. Final PLATFORM UI (customer-facing)

**Location:** Setup → **Text Back** → **Text message sender**

- **(•) Transovo Platform Number**
  - Copy: *No number setup required. Transovo manages the sending number.*
- **Do NOT display** `+18885046264` (or any platform E.164) as the customer’s selection.

---

## 5. Final WORKSPACE UI (customer-facing)

- **( ) My Verified Number**
  - Copy: *Send from a verified number connected to your workspace.*
- **Choose a sender** dropdown when WORKSPACE is selected:
  - Workspace-owned numbers only
  - **Exclude** `platform_mctb_sender` row
  - **Exclude** voice-only / non-messaging-authorized as usable senders (show disabled + label when needed)
  - Example row: `(866) 123-4567 — Toll-free — Verified`

**Phone & Forwarding** remains **calls only** — forward destination, not SMS sender picker.

---

## 6. Persistence rules (API)

| Customer action | `phoneNumberId` | `senderMode` | `smsPhoneNumberId` |
|-----------------|-----------------|--------------|---------------------|
| Select **Transovo Platform Number** | **Unchanged** | `PLATFORM` | **Not required** on save; not forced to platform PhoneNumber id |
| Select **My Verified Number** + pick | **Unchanged** | `WORKSPACE` | Selected eligible id |
| Change forwarding / ingress only | Updated | **Unchanged** | **No auto-copy** from ingress |

Switch **WORKSPACE → PLATFORM:** ingress unchanged; stored `smsPhoneNumberId` may remain for switching back.  
Switch **PLATFORM → WORKSPACE:** ingress unchanged; use stored or newly selected `smsPhoneNumberId`.

**POST body (Text Back save):**

```json
{
  "senderMode": "PLATFORM"
}
```

or

```json
{
  "senderMode": "WORKSPACE",
  "smsPhoneNumberId": "<workspace-eligible-phone-number-id>"
}
```

Do **not** send `phoneNumberId` when only changing sender mode.

---

## 7. Regression scenarios (A–D)

| Test | Config | Expected |
|------|--------|----------|
| **A — PLATFORM** | `phoneNumberId` = Telnyx ingress; `senderMode = PLATFORM` | Voice via ingress; SMS via platform resolver (888 today) |
| **B — WORKSPACE** | Same ingress; `senderMode = WORKSPACE`; `smsPhoneNumberId` = verified customer sender | Voice via ingress; SMS from customer number (e.g. 571 Telnyx) |
| **C — PLATFORM → WORKSPACE** | Toggle mode + pick sender | **Ingress unchanged** |
| **D — WORKSPACE → PLATFORM** | Toggle mode | **Ingress unchanged**; `smsPhoneNumberId` may remain stored |

---

## 8. Automated tests

```bash
npx tsx scripts/test-mctb-setup-sender-mode-boundary.ts
```

Covers: no ingress→SMS auto-copy on phone change; PLATFORM stale repair does not copy ingress into `smsPhoneNumberId`; platform TFN filtered from workspace picker.

**Cert script (ws_1 only, not bulk):**

```bash
WORKSPACE_ID=ws_1 npx tsx scripts/enable-ws1-mctb-platform-sender-mode.ts
```

**Readiness:**

```bash
npx tsx scripts/verify-mctb-platform-production-readiness.ts
```

---

## 9. PLATFORM runtime preserved

- **No changes** to Model B `platform-parent-twilio-send`, `resolveMctbOutboundSmsRoute` platform branch, or TeXML ingress.
- Live proof: recovery SMS **From (888) 504-6264** after forwarded press-1 with `senderMode = PLATFORM` on ws_1.

---

## 10. Why 571 appeared before 888

- `senderMode` was **WORKSPACE** → outbound used `smsPhoneNumberId` (**+15714073615**, Telnyx 571).
- After **PLATFORM** + qualifying forward + press-1 → **+18885046264** (expected).

Voice ingress (**+18666020680** on ws_1) ≠ SMS From. Forwarding fixes **eligibility** (`NOT_FORWARD_EVENT`); **senderMode** fixes **From**.

---

## 11. iPhone CFNA dial code (ws_1 ingress reference)

Forward **no answer** to ingress **+1 866-602-0680**, ~10s ring (AT&T wireless pattern, live-verified style):

```text
*61*18666020680*11*10#
```

Cancel no-answer forward:

```text
#61#
```

Dial from the **business line phone**, not by calling 866 directly for production tests.

---

## 12. Coolify / env (recommended)

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1
MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q
```

Single `platform_mctb_sender` row can resolve without env; set both for production clarity. Redeploy after env change.

**Canonical platform PhoneNumber (today):**

- ID: `cmufvsanf1g0v060m13730z0q`
- E.164: `+18885046264`
- Role: `platform_mctb_sender` (infrastructure — not customer UI selection)

---

## 13. Remaining gaps before reply / HELP / STOP certification

Manual handset on production/staging:

1. **Reply** to 888 → conversation in customer workspace (platform inbound tenant resolution).
2. **HELP** on platform TFN.
3. **STOP** on platform TFN (platform-wide suppression semantics).
4. **WORKSPACE** regression: customer with own verified sender still sends from their number.
5. Deploy PR **#498** so Setup → Text Back exposes sender mode in UI.

Do **not** bulk-enable `senderMode=PLATFORM` for all workspaces.

---

## 14. Product principles (locked)

- Customer chooses **sender mode**, not Transovo’s literal platform number.
- **PLATFORM** = free or paid eligible; entitlements may gate availability later — not hard-coded “free only.”
- **phoneNumberId** for forwarding stays separate from Text Message Sender UI.
- No onboarding default flip in this pass; ws_1 cert workspace may use PLATFORM intentionally.

---

## Governing sentence

**Manifest says what must exist; the two-number model says voice ingress and SMS sender are different objects; `senderMode` is the durable customer choice for platform vs own verified sender; the platform resolver owns the physical From line.**
