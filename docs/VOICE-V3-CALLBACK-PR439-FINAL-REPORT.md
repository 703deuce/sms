# PR #439 — Callback + shared facts (final pre-merge report)

**Branch:** `cursor/voice-v3-callback-shared-facts-2304`  
**Status:** Ready for review — **NOT merged, NOT deployed** (awaiting explicit approval + PSTN cert)

**SEND_LINK / Microsoft:** Frozen production baselines on `master`. This PR does **not** modify `booking-link/*`, Microsoft executors, or `send_booking_link` transport.

---

## Callback wizard UI

**Call handling step → “Callback requests” card**

- Toggle: Allow callers to request a callback (additive; independent of booking strategy).
- Checklist: each **enabled** shared `collectFields` row — required for `request_callback` before execute.
- Reset to recommended defaults (name, phone, service/reason field id).
- New agents: `callbackRequiredCollectFieldIds` seeded in `createDefaultWizardState()`.

**No duplicate callback field definitions.**

---

## Configuration example

Wizard:

```json
{
  "callbackRequestsEnabled": true,
  "callbackRequiredCollectFieldIds": ["full_name", "phone", "service", "notes"],
  "collectFields": [ "... shared definitions ..." ]
}
```

Compiled runtime:

```json
{
  "operationRequirements": {
    "book_appointment": ["name", "email", "phone", "service_reason"],
    "request_callback": ["name", "phone", "service_reason", "notes"]
  }
}
```

(`service` collect id → intake key `service_reason` via wizard mapping.)

---

## Shared-fact objective switch

`scripts/test-voice-v3-callback-shared-facts-transitions.ts` — **PASS**

- Booking path captures: name, email, service_reason; ANI for callback phone.
- `getMissingFieldsForOperation("request_callback")` → `[]` without re-asking.
- Email not in callback requirements.
- Reverse: callback-collected facts remain on call for booking after phone capture.

**PSTN cert still required:** start Microsoft booking → interrupt with “never mind, just call me back” (harder than callback-only).

---

## Astra selection (`gpt-6-astra`)

`scripts/test-voice-v3-astra-callback-selection.ts` — **10/10 PASS**

| # | Scenario | Tool |
|---|----------|------|
| 1 | Direct callback | `request_callback` |
| 2 | Abandon booking | `request_callback` |
| 3 | Abandon send link | `request_callback` |
| 4 | Hours question | *(none)* |
| 5 | Book appointment | `set_scheduling_preference` |
| 6 | Send link (consent given) | `send_booking_link` |
| 7 | Cancel | `find_appointment` |
| 8 | Transfer | `transfer_call` |

No keyword routing or planner gates added.

---

## Callback isolation

Dedicated: `src/lib/voice-v3/callback/*`, `request_callback` tool, `persist-voice-v3-callback-request.ts`.  
**Not wired:** `createCallbackRequest`, V2 callback, CRM, quick-send, appointment SMS, SEND_LINK.

---

## Regression (callback branch)

Re-run **2026-09-19** on `cursor/voice-v3-callback-shared-facts-2304` (after merge of `master` SEND_LINK freeze docs `040ebdc6`).

| Suite | Result |
|-------|--------|
| `test-voice-v3-callback-isolation.ts` | PASS |
| `test-voice-v3-callback-matrix.ts` | PASS (17) |
| `test-voice-v3-callback-wizard-roundtrip.ts` | PASS |
| `test-voice-v3-callback-shared-facts-transitions.ts` | PASS |
| `test-voice-v3-astra-callback-selection.ts` | PASS **10/10** (`gpt-6-astra`) |
| `test-voice-v3-astra-tool-contracts-audit.ts` | PASS |
| `test-voice-v3-architecture-invariants.ts` | PASS |
| `test-voice-v3-wizard-compiler.ts` | PASS |
| `test-voice-v3-booking.ts` | PASS |
| `test-voice-v3-appointment-discovery.ts` | PASS (find) |
| `test-voice-v3-cancellation.ts` | PASS |
| `test-voice-v3-reschedule.ts` | PASS |
| `test-voice-v3-send-booking-link-matrix.ts` | PASS (14) |
| `test-voice-v3-booking-link-sms-isolation.ts` | PASS |

---

## Frozen baselines untouched (code)

`git diff origin/master -- src/lib/voice-v3/booking-link/ src/lib/voice-v3/booking/ src/lib/voice-v3/microsoft/` → **0 bytes** (no executor/transport changes on this PR).

SEND_LINK production certification lives on **`master`** (`docs/VOICE-V3-SEND-LINK-FREEZE-GATE.md`, PSTN `848935bb`, call `v3:y8dG-Dreu9VRSwilAHGbozyoOB5C40rZMNzzDP5W4UcQhxXnGpU0Pw`).

---

## Files changed (PR #439 vs `master`)

```
docs/VOICE-V3-CALLBACK-SHARED-FACTS-REPORT.md
docs/VOICE-V3-CALLBACK-PR439-FINAL-REPORT.md
scripts/test-voice-v3-architecture-invariants.ts
scripts/test-voice-v3-astra-callback-selection.ts
scripts/test-voice-v3-callback-isolation.ts
scripts/test-voice-v3-callback-matrix.ts
scripts/test-voice-v3-callback-shared-facts-transitions.ts
scripts/test-voice-v3-callback-wizard-roundtrip.ts
src/components/solutions/appointment-receptionist/callback-required-fields-editor.tsx
src/components/solutions/appointment-receptionist/steps/call-handling-step.tsx
src/lib/solutions/appointment-receptionist/callback-required-field-defaults.ts
src/lib/solutions/appointment-receptionist/defaults.ts
src/lib/solutions/appointment-receptionist/merge-wizard-state-on-save.ts
src/lib/solutions/appointment-receptionist/types.ts
src/lib/voice-v3/callback/*
src/lib/voice-v3/config/agent-config.ts
src/lib/voice-v3/config/compile-voice-v3-agent-config.ts
src/lib/voice-v3/config/wizard-collect-fields-v3.ts
src/lib/voice-v3/config/wizard-control-inventory.ts
src/lib/voice-v3/intake-objective/operation-requirements.ts
src/lib/voice-v3/state/call-context.ts
src/lib/voice-v3/tools/astra-tool-contracts.ts
src/lib/voice-v3/tools/authorize-tool-for-config.ts
src/lib/voice-v3/tools/request-callback-tool.ts
src/lib/voice-v3/tools/voice-tool-catalog.ts
```

(Docs-only delta from `master` merge: `VOICE-V3-SEND-LINK-FREEZE-GATE.md`, implementation report freeze banner.)

---

## After approval

1. Merge PR #439  
2. Deploy  
3. PSTN: callback-only call  
4. PSTN: Microsoft booking → abandon → callback (no redundant questions)
