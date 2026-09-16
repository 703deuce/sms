import type { VoiceV2TransferProvider, VoiceV2TransferProviderRequest } from "./transfer-provider";

type MockBehavior = {
  results: Array<import("../after-hours-handling-types").VoiceV2TransferAttemptResult>;
};

const behaviors = new Map<string, MockBehavior>();

export function setMockTransferBehavior(invocationId: string, results: MockBehavior["results"]) {
  behaviors.set(invocationId, { results });
}

export function clearMockTransferBehaviors() {
  behaviors.clear();
}

const WARM_FAILURES = new Set([
  "NO_ANSWER",
  "BUSY",
  "DECLINED",
  "TIMEOUT",
  "BRIDGE_FAILED",
  "PROVIDER_ERROR",
  "CALLER_DISCONNECTED",
]);

export class MockVoiceV2TransferProvider implements VoiceV2TransferProvider {
  private attemptByInvocation = new Map<string, number>();

  async initiateTransfer(req: VoiceV2TransferProviderRequest) {
    const behavior = behaviors.get(req.invocationId);
    const idx = this.attemptByInvocation.get(req.invocationId) ?? 0;
    this.attemptByInvocation.set(req.invocationId, idx + 1);
    const result = behavior?.results[idx] ?? "SUCCESS";

    if (req.mode === "WARM") {
      if (WARM_FAILURES.has(result)) {
        return { result, providerReference: `mock:warm-fail:${req.invocationId}:${idx}` };
      }

      const { startVoiceV2WarmTransfer, driveMockVoiceV2WarmTransfer } = await import(
        "./warm-transfer-runtime"
      );
      const mockConsult = `mock_consult_${req.invocationId}_${idx}`;
      const warm = await startVoiceV2WarmTransfer({
        workspaceId: req.workspaceId,
        agentId: req.agentId,
        sessionKey: req.sessionKey,
        invocationId: req.invocationId,
        planId: req.planId,
        transferGeneration: req.transferGeneration,
        stepOrder: req.stepOrder,
        destinationId: req.destinationId,
        destinationE164: req.destinationE164,
        callerCallControlId: req.callControlId,
        briefingText: req.briefingText || "Press 1 to accept.",
        timeoutSeconds: req.timeoutSeconds,
        mockConsultControlId: mockConsult,
      });

      if (result === "SUCCESS") {
        await driveMockVoiceV2WarmTransfer(warm.sessionId, "consult_answered");
        await driveMockVoiceV2WarmTransfer(warm.sessionId, "press_1");
        return { result: "SUCCESS" as const, providerReference: warm.sessionId };
      }

      return { result: "INITIATING" as const, providerReference: warm.sessionId };
    }

    return { result, providerReference: `mock:${req.invocationId}:${idx}` };
  }

  async acceptWarmTransfer(input: {
    callControlId: string;
    transferGeneration: number;
    stepOrder: number;
    dtmf: string;
  }) {
    if (input.dtmf !== "1") return "DECLINED";
    return "SUCCESS";
  }
}
