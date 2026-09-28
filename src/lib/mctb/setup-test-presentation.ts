import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";

export type SetupTestPipelineStep = { id: string; label: string; done: boolean };

/** Authoritative labels for setup-test runtime checkpoints (POST/GET /api/mctb/setup-test). */
export function buildSetupTestPipelineSteps(
  status: MctbSetupTestStatus | null | undefined,
): SetupTestPipelineStep[] {
  if (!status?.started) return [];
  const c = status.checks;
  const press1 = status.consentMode === "press_1";
  return [
    { id: "did", label: "Call reached MCTB number", done: c.transovoDidReceived },
    { id: "ws", label: "Workspace resolved", done: c.workspaceResolved },
    { id: "mode", label: "Consent mode loaded", done: c.consentModeLoaded },
    { id: "greeting", label: "Voicemail / greeting played (if applicable)", done: c.greetingPlayed },
    ...(press1 ? [{ id: "p1", label: "Press 1 received", done: c.press1Received }] : []),
    { id: "consent", label: "Consent recorded", done: c.consentRecorded },
    { id: "event", label: "Missed call event created", done: c.missedCallEventCreated },
    { id: "queue", label: "Recovery SMS queued", done: c.smsQueued },
    { id: "provider", label: "SMS accepted by provider", done: c.smsProviderAccepted },
  ];
}
