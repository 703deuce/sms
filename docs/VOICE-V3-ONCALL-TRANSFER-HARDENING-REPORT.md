# Voice V3 — On-call scheduling + transfer hardening — implementation report

## A. Audit

See `docs/VOICE-V3-ONCALL-TRANSFER-HARDENING-AUDIT.md`.

**detectVoicemailOnTransfer:** persisted in wizard → compiled on `VoiceV3AgentConfig`; now included in warm-transfer `instructions` via `buildWarmTransferHandoffInstructions` when enabled (native `voicemail_detected` guidance). Not used for Telnyx AMD in LiveKit V3 path.

**LiveKit 1.8.2:** `WarmTransferTask` supports `hold_audio`, `ringing_timeout`, `instructions`, `connect_to_caller`, `decline_transfer`, `voicemail_detected`. Executor uses `instructions=` (not deprecated `extra_instructions` only).

## B. Files changed (high level)

| Area | Files |
|------|--------|
| Schedule engine | `destination-availability-types.ts`, `evaluate-destination-eligibility.ts` |
| Authorization | `authorize-transfer.ts` |
| Compiler | `compile-transfer-config.ts` |
| Handoff / Amy | `build-handoff-summary.ts`, `amy-transfer-instructions.ts` |
| Wizard UI | `transfer-destination-availability-controls.tsx`, `emergency-transfer-editor.tsx`, `transfer-wizard-state.ts` |
| Types | `appointment-receptionist/types.ts`, `transfer/types.ts` |
| Python executor | `voice-runtime-python/.../transfer_executor.py` |
| Notifications | `format-transfer-notification.ts`, `notify-transfer-outcome.ts`, `record-voice-v3-transfer-outcome-for-python.ts` |
| Tests | `scripts/test-voice-v3-transfer-destination-eligibility.ts`, `scripts/test-voice-v3-transfer-system.ts`, `voice-runtime-python/tests/test_warm_transfer_task_contract.py` |

## C. Data model

Per **transfer destination** (wizard + compiled):

```ts
availability?: {
  mode: "ALWAYS" | "SCHEDULED";
  timezone: string; // IANA
  temporarilyUnavailable?: boolean;
  weekly: Partial<Record<day, {
    enabled: boolean;
    allDay?: boolean;
    windows: { start: "HH:mm"; end: "HH:mm" }[];
  }>>;
}
```

**Backward compatibility:** missing `availability` → `ALWAYS` (same as pre-feature destinations).

**Boundaries:** start inclusive, end exclusive. Overnight when `end <= start` (e.g. `17:00` → `07:00` spans into next calendar day).

## D–F. Runtime

- **Eligibility:** `evaluateTransferDestinationEligibility` at authorize time (deterministic, no LLM).
- **Waterfall:** skipped destinations recorded in `skipped_targets` with `SKIPPED_*` outcomes — not dialed.
- **Empty eligible set:** `NO_ELIGIBLE_DESTINATIONS` → immediate fallback path (`transfer_no_eligible_destinations`).
- **Warm transfer:** unchanged architecture; native `WarmTransferTask` + waterfall loop in Python.
- **Hold:** native LiveKit `hold_audio` default (no custom hold room).
- **Outcomes:** `TIMEOUT` mapped to `NO_ANSWER` for warm attempts.

## G. Privacy

Warm briefing unchanged: name, phone, service_reason, notes, transfer reason only (`build-handoff-summary.ts`).

## H–I. Persistence & notifications

- Attempts include skips with human labels (`off schedule`, etc.).
- `transfer_no_eligible_destinations` distinct SMS copy vs exhausted waterfall.

## K. Automated tests

```bash
npx tsx scripts/test-voice-v3-transfer-destination-eligibility.ts
npx tsx scripts/test-voice-v3-transfer-system.ts
cd voice-runtime-python && python3 -m pytest tests/test_warm_transfer_task_contract.py -q
```

## L–N. Deployment / PSTN

Not run in this agent session. PSTN pack OC1–OC4, TH1–TH8 requires deploy + `+15717491060` certification per directive.

## Remaining limitations

- Call Detail UI timeline component not fully redesigned in this pass (metadata + notifications carry skip outcomes).
- Route-level max transfer duration UI not added (per-step timeouts unchanged).
- PSTN voicemail/human acceptance certification pending real calls.
