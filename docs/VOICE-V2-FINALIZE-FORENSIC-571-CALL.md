# Forensic — finalize NOT_READY on conversation `4f6d5e74-d504-4968-a2ed-9d2fd6e9b8e2`

## Root cause

`executeVoiceV2FinalizeCallerRequest` treated **all** `missingForRecord` fields as hard blockers and returned `CALLER_REQUEST_NOT_READY` **even when `bookingWorkflow.bookingConfirmed` was already true**. That contradicted product semantics: `REQUIRED_FOR_RECORD` must not block close after a successful provider book.

## ANI / phone

- Inbound PSTN calls should prefill `phone` from caller ANI (`prefillPhone` in `context-build.ts`).
- Finalize and several tool paths did not pass `fromE164` / trusted `VoiceCall.id`, and cached CallContext was not backfilled with ANI on later tool hits.
- **Effect on this call:** `phone` appeared in `missing_for_record` because structured intake never had a saved `phone` value when finalize ran, even though the caller was on PSTN.

## Name

- Telnyx message export for this call **starts ~60s in**; earlier intake is not in that transcript slice.
- No evidence in the exported tool payloads that `name` was saved before finalize; likely never captured in CallContext for this session (not provably “lost” from L2 without DB forensics).

## `mother_s_name`

- Custom field configured **`REQUIRED_FOR_RECORD`** (not before booking). Correctly did not block `BOOK`; incorrectly blocked finalize under old logic.

## Fix (this branch)

- Finalize returns **`FINALIZED`** with `primary_outcome: BOOKED` when booking already confirmed; `record_complete: false` + `missing_for_record` preserved.
- ANI backfill on context cache hits and finalize/save paths; `phone` satisfied from `CALLER_ID` without re-asking.
