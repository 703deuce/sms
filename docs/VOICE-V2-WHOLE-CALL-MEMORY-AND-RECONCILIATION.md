# Voice V2 — whole-call memory and post-call reconciliation

## A. Live memory

- **Authority:** `resolveVoiceV2CallerFieldState` / `resolveVoiceV2KnownCallerState` in `src/lib/voice-v2/intake/caller-field-state.ts` — one read layer over pinned `intakeSchema` + `intakeState` on `VoiceV2CallContext`.
- **Readiness:** `getIntakeReadiness` delegates to the same resolver (built-in and custom wizard keys are equivalent).
- **Tool responses:** `save_intake_fields` Telnyx JSON includes `known_caller_fields` and `missing_for_booking_only`.
- **Requirements:** `REQUIRED_BEFORE_BOOKING` blocks booking only when still missing; `REQUIRED_FOR_RECORD` never blocks successful primary actions (finalize semantics unchanged).
- **ANI:** `callerAniE164` + `phone` prefill; different callback → `callback_number` without overwriting ANI.
- **Pinning:** `capabilities.intakeSchemaRevision` set at context build from enrollment revision; L2 payload retains `intakeSchema` for the active call.
- **Tests:** `scripts/test-voice-v2-whole-call-memory-headless.ts` (arbitrary keys: `dinosaury`, `mother_s_name`).

## B. Recording

- Telnyx dual-channel recording remains started on answered inbound (existing `startCallRecording`).
- `call.recording.saved` → `voice_recording_ingest` persists `VoiceRecording` (channels default 2).
- Voice V2 post-call pipeline enqueued from ingest when agent is Voice V2 One Amy (or `metadata.voiceV2OneAmy`).

## C. Deepgram post-call

- **Credential:** `DEEPGRAM_API_KEY` (existing server env — not duplicated).
- **Model:** prerecorded `nova-3`, `smart_format=true`, `multichannel=true` when channels > 1 (`src/lib/transcription/deepgram-prerecorded.ts`).
- **Source:** Telnyx **recording URL/audio only** — not Flux live text, not Telnyx conversation messages.
- **Async:** `voice_v2_post_call_transcription` job on `voice-calls` queue; hangup/finalize never awaits transcription.
- **Persistence:** `VoiceTranscript` with `provider=deepgram_post_call_v2`; call `metadata.voiceV2PostCallTranscription` status.

## D. Post-call field extraction (LLM-driven)

- **Pinned schema:** loaded from L2 `CallContext.payload` at reconcile time (`intakeSchema` + `intakeSchemaRevision`).
- **Dynamic extraction task:** `buildDynamicExtractionSchema` — the LLM is asked for **exactly** the enabled fields on that call (built-ins + arbitrary custom keys). No hardcoded field list.
- **Extraction:** `extractPostCallFieldCandidatesWithAi` — **one** async structured JSON LLM pass (`structured-extraction.ts` via `mctbSemanticStructuredJson`). Not a conversational agent; no tools/book/transfer/SMS.
- **Input:** full ordered Deepgram transcript (caller + agent/Amy), speaker attribution, field metadata (label, type, requirement, question text), live values for comparison only.
- **Output:** strict JSON per field — `FOUND | NOT_FOUND | AMBIGUOUS`, `value`, `confidence`, `evidence[]`, `isExplicitCorrection`.
- **No regex/rule primary extraction.** If LLM extraction fails → live record unchanged, `EXTRACTION_FAILED` on reconciliation metadata (bounded job retry).
- **Normalization:** phone/email via intake normalizers when evidence is clear (`normalize-extracted-value.ts`).

## E. Deterministic reconciliation

- **Verdicts:** `MATCH` | `CORRECT` | `REVIEW` | `MISSING` (`reconcileVoiceV2PostCallRecord`) — compares live CallContext vs LLM candidates; thresholds on confidence/corrections.
- **Provenance:** `metadata.voiceV2PostCallReconciliation`, `voiceV2ReconciledIntake`, live values preserved in reconciliation field rows.
- **Action safety:** reconciliation does not call booking/cancel/reschedule/transfer/SMS APIs.
- **Tests:** `scripts/test-voice-v2-post-call-reconciliation-headless.ts`.

## F. Summary

- **Canonical order:** recording → Deepgram → persist transcript → **LLM field extraction** → deterministic reconciliation → recompute record completeness → **final summary** (`final-summary.ts`).
- `persistFinalSummaryAfterReconciliation` updates `VoiceConversationInsight.summary` and `metadata.voiceV2FinalSummaryAuthority=RECONCILED`.
- Hangup-time `processPostCall` insight is provisional; reconciled summary replaces it after the post-call job.

## G. Regression scripts

- `test-voice-v2-whole-call-memory-headless.ts`
- `test-voice-v2-post-call-reconciliation-headless.ts`
- `test-voice-v2-finalize-record-headless.ts`
- Existing Voice V2 headless suites (run before deploy).
