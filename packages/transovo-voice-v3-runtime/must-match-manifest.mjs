/**
 * Files that must remain byte-identical between monolith authority and new-app runtime mirror.
 * Keep in sync with new-app/scripts/verify-golden-runtime-parity.ts MUST_MATCH.
 */
export const MUST_MATCH_RELATIVE_PATHS = [
  "calendar/book-dispatch.ts",
  "calendar/find-dispatch.ts",
  "calendar/cancel-dispatch.ts",
  "tools/execute-voice-tool.ts",
  "tools/handle-delegated-voice-tools.ts",
  "tools/concurrency-policy.ts",
  "tools/registry.ts",
  "tools/book-appointment-tool.ts",
  "tools/find-availability-tool.ts",
  "tools/set-scheduling-preference-tool.ts",
  "tools/cancel-appointment-tool.ts",
  "tools/reschedule-appointment-tool.ts",
  "tools/transfer-call-tool.ts",
  "tools/request-callback-tool.ts",
  "tools/send-booking-link-tool.ts",
  "tools/update-intake-tool.ts",
  "tools/astra-tool-contracts.ts",
  "delegation/conversation-freshness.ts",
  "delegation/live-response-coordinator.ts",
  "operations/run-authoritative-operation.ts",
  "operations/registry.ts",
  "agent/after-state-change.ts",
  "recovery/push-recovery-to-live.ts",
];
