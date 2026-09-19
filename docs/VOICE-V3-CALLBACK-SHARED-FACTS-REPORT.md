# Voice V3 — Shared call facts + `request_callback` (implementation report)

**Branch:** `cursor/voice-v3-callback-shared-facts-2304`  
**Status:** Not merged / not deployed (awaiting explicit approval)

## Legacy callback discovered (not wired)

| Path | Role |
|------|------|
| `src/lib/callback-requests/service.ts` | Platform callback CRUD + in-app/email notifications |
| `src/lib/voice-receptionist-wizard/operating-maturity/callback-overdue-job.ts` | V2 SLA scan |
| `src/app/api/callback-requests/route.ts` | REST API |
| Smart routing runtimes | Enqueue via `createCallbackRequest` |
| Prisma `CallbackRequest` (`callback_requests`) | Shared table |

V3 uses **direct Prisma create** in `persist-voice-v3-callback-request.ts` with `metadata.source = VOICE_V3` and **does not** import `createCallbackRequest`.

## Safe reuse (infrastructure only)

- `getPrisma` / `CallbackRequest` model
- `normalizePhoneE164`
- Existing intake-objective: `mergeIntakeUpdate`, `CapturedField`, `getMissingFieldsForOperation`
- Tool catalog / authorize patterns (same as `send_booking_link`)

## Architecture

### Shared facts

Call-scoped intake in `VoiceV3CallContext.intake.values` (`CapturedField` with `source`, `updatedAt`). Telephony ANI in `context.telephony.inboundCallerE164`.

### Per-operation requirements

`config.operationRequirements.request_callback` compiled from wizard via `callbackRequiredIntakeKeys()`.  
`getMissingFieldsForOperation("request_callback", …)` delegates to `getMissingCallbackRequirementKeys()` (phone can satisfy via ANI when `callbackUseAniByDefault`).

Booking (`book_appointment`), SEND_LINK, transfer, cancel/reschedule requirements unchanged.

### Additive capability

`request_callback` gated only by `callHandling.callbackRequestsEnabled`, independent of `scheduling.bookingStrategy`.

## Tool

**Name:** `request_callback`  
**Description:** see `REQUEST_CALLBACK_TOOL_DESCRIPTION` in `src/lib/voice-v3/tools/astra-tool-contracts.ts`

**Schema (strict):**

- `callback_phone`: string | null  
- `reason`: string | null  
- `preferred_time`: string | null  
- `notes`: string | null  

## Automated tests

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-isolation.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-callback-matrix.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-astra-tool-contracts-audit.ts
# Optional live Astra selection (OPENAI_API_KEY):
npx tsx scripts/test-voice-v3-astra-callback-selection.ts
```

## PSTN readiness

Ready for **one** supervised PSTN callback certification call after merge approval; not certified on this branch in Cloud Agent environment.

## Remaining risks

- Wizard UI for `callbackRequiredCollectFieldIds` is compile-time only (defaults: name, phone, reason field); optional field picker UI not added in this pass.
- `CallbackRequest.status` remains `new` at row level; V3 lifecycle `REQUESTED` lives under `metadata.voiceV3.lifecycleStatus`.
- Real GPT-6 Astra selection cert requires `OPENAI_API_KEY` locally.
