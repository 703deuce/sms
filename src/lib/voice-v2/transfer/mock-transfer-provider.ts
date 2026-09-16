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

export class MockVoiceV2TransferProvider implements VoiceV2TransferProvider {
  private attemptByInvocation = new Map<string, number>();

  async initiateTransfer(req: VoiceV2TransferProviderRequest) {
    const behavior = behaviors.get(req.invocationId);
    const idx = this.attemptByInvocation.get(req.invocationId) ?? 0;
    this.attemptByInvocation.set(req.invocationId, idx + 1);
    const result = behavior?.results[idx] ?? "SUCCESS";
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
