import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";

export type SetupTestPipelineStep = { id: string; label: string; done: boolean };

/** Authoritative labels for setup-test runtime checkpoints (POST/GET /api/mctb/setup-test). */
export function buildSetupTestPipelineSteps(
  status: MctbSetupTestStatus | null | undefined,
): SetupTestPipelineStep[] {
  if (!status?.started) return [];
  const c = status.checks;
  const press1 = status.consentMode === "press_1";
  const forceDone = Boolean(status.verified);
  return [
    { id: "did", label: "Call reached MCTB number", done: forceDone || c.transovoDidReceived },
    { id: "ws", label: "Workspace resolved", done: forceDone || c.workspaceResolved },
    { id: "mode", label: "Consent mode loaded", done: forceDone || c.consentModeLoaded },
    {
      id: "greeting",
      label: "Voicemail / greeting played (if applicable)",
      done: forceDone || c.greetingPlayed,
    },
    ...(press1
      ? [{ id: "p1", label: "Press 1 received", done: forceDone || c.press1Received }]
      : []),
    { id: "consent", label: "Consent recorded", done: forceDone || c.consentRecorded },
    { id: "event", label: "Missed call event created", done: forceDone || c.missedCallEventCreated },
    { id: "queue", label: "Recovery SMS queued", done: forceDone || c.smsQueued },
    { id: "provider", label: "SMS accepted by provider", done: forceDone || c.smsProviderAccepted },
  ];
}
