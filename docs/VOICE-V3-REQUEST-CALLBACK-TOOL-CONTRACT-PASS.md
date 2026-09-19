# request_callback OpenAI function contract — final pass (PR #442)

**Status:** Implemented on `cursor/voice-v3-callback-contract-2304` — **not merged, not deployed.**

---

## 1. Before / after — function description

### Before (single paragraph, ~1.1k chars)

```
Authoritative action to arrange a business callback on this call. Use when the caller asks for a callback, asks someone from the business to contact them later, cannot complete another action and wants human follow-up, or changes from another workflow such as booking or receiving a booking link to requesting a callback instead. Do not use merely because the caller has a general question you can answer from business knowledge. Before submitting, ensure only the configured callback-required information is known — reuse facts already collected during this call via update_intake and do not ask for booking-only fields (email, scheduling preference, booking notes, etc.) unless they are also required for callback. Null callback_phone uses the trusted inbound caller number when configured; provide callback_phone only when the caller wants a different number. Null reason is allowed when the reason is already stored in shared call facts. You must invoke this tool to arrange a callback — conversational reassurance alone does not record anything. Do not tell the caller that someone will call them back, that the callback is arranged, recorded, or confirmed until this tool returns callback_requested with success. If required callback facts are still missing, collect only those missing callback fields, then call this tool. If the tool fails or returns needs_information, do not claim success.
```

**Problem:** Contradicted validator-driven lifecycle (“Before submitting, ensure … is known” vs invoke early + `needs_information`). Thin negative cases and success boundary.

### After (~4.8k chars)

Structured sections in `REQUEST_CALLBACK_TOOL_DESCRIPTION`:

- **WHAT THIS TOOL DOES** — persistent human callback record; not chat / not `update_intake` alone
- **WHEN YOU MUST USE** — direct callback, office call-back, switch from booking/SEND_LINK, etc.
- **OPERATION SWITCHING** — abandon booking-only collection
- **WHEN NOT TO USE** — Q&A, booking, SEND_LINK, transfer, phone-only, conversational “call”
- **CONFIGURED REQUIREMENTS** — tenant-specific; ANI reuse
- **VALIDATOR-DRIVEN LIFECYCLE** — **may invoke before all fields known**; `needs_information` + `missingFields` loop
- **SUCCESS BOUNDARY** — only `callback_requested`
- **FAILURE / NON-SUCCESS**
- **ARGUMENTS** — pointer to parameter descriptions

**Function name:** unchanged — `request_callback`.

---

## 2. Before / after — parameter descriptions

| Param | Before | After (summary) |
|--------|--------|------------------|
| `callback_phone` | Short null = ANI/shared | E.164; null when ANI/shared satisfies policy; different number only when explicit; do not invent |
| `reason` | Short null if in facts | Service context; null if in shared facts; do not invent/embellish |
| `preferred_time` | Optional NL; not appointment | Same + explicit **does NOT schedule** / no exact-time promise |
| `notes` | Optional; not trusted config | Optional staff notes; **not substitute** for required fields; do not invent |

**Schema:** strict OpenAI function; all four properties **required** in JSON Schema with `string \| null` (unchanged wire shape).

---

## 3. Final compiled OpenAI function (callback-enabled booking test config)

Produced by `buildVoiceV3AstraFunctionTools(config)` — see test output:

`scripts/test-voice-v3-request-callback-openai-contract.ts` logs `COMPILED_REQUEST_CALLBACK_TOOL` (full JSON).

**Authorization:** `isRequestCallbackAuthorized` → `callbackRequestsEnabled === true`. Disabled configs omit the tool (`listVoiceV3AstraToolNamesForConfig`).

**Operation requirements (separate from tool schema):** `buildAstraCallbackInstructions` injects `operationRequirements.request_callback` labels + ANI policy into Astra system instructions (not duplicated as hardcoded globals in the tool description).

---

## 4. Astra selection tests (gpt-6-astra, live API)

`scripts/test-voice-v3-astra-callback-selection.ts` — **11/11 PASS** on 2026-09-19:

| Case | Label | Picked |
|------|--------|--------|
| A | `A_can_somebody_call_me_back` | `request_callback` |
| B | `B_office_give_me_a_call` | `request_callback` |
| C | `C_forget_appointment_callback` | `request_callback` |
| D | `D_book_monday_not_callback` | `set_scheduling_preference` |
| E | `E_text_booking_link_not_callback` | `send_booking_link` (with SMS disclosure in history) |
| F | `F_transfer_now_not_callback` | `transfer_call` |
| G | `G_hours_not_callback` | none |
| H | `H_callback_insufficient_facts_still_select` | `request_callback` |

Plus extra positives: `abandon_send_link`, `callback_later_human`; negative: `cancel_not_callback`.

---

## 5. Frozen regression

All **PASS** (same batch as contract correction + this pass):

- Callback: openai contract, invariants, prompt contract, shared-facts, matrix, isolation
- Microsoft: appointment management, discovery, reschedule
- SEND_LINK: 14-case matrix, SMS isolation
- Architecture: astra tool contracts audit, architecture invariants, prompts, intake, intake-objective

---

## 6. Files changed (this pass only)

| File | Change |
|------|--------|
| `src/lib/voice-v3/tools/astra-tool-contracts.ts` | Expanded `REQUEST_CALLBACK_TOOL_DESCRIPTION` |
| `src/lib/voice-v3/tools/request-callback-tool.ts` | Expanded Zod `.describe()` for all four args |
| `src/lib/voice-v3/prompts/astra-cross-tool-instructions.ts` | Align step 5 with validator-driven invoke |
| `src/lib/voice-v3/prompts/astra-callback-instructions.ts` | Remove “collect before invoke”; match lifecycle |
| `scripts/test-voice-v3-request-callback-openai-contract.ts` | **New** — compiled tool assertions |
| `scripts/test-voice-v3-callback-invariants.ts` | Updated assertions |
| `scripts/test-voice-v3-astra-callback-selection.ts` | A–H labels + H scenario |

**Not changed:** executors, persistence, Microsoft, SEND_LINK.

---

## 7. Contradictions reconciled

| Source | Issue | Fix |
|--------|--------|-----|
| Old tool description | “Before submitting, ensure … known” | Replaced with **invoke when callback identified** + executor `needs_information` |
| `astra-callback-instructions.ts` | “Collect … before invoking” | Same validator-driven wording |
| Cross-tool callback step 5 | Implied wait-until-ready | “As soon as clearly requested” + executor validates |

Single story: **delegate → `request_callback` → validate → `needs_information` loop → `callback_requested` → Amy confirms.**

---

## STOP

Do not merge or deploy until approved. Next: merge PR #442 → deploy → PSTN Cert A + B.
