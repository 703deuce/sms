import "server-only";

import type { VoiceV2CallContext } from "../intake/types";
import type {
  VoiceV2PublishedAfterHoursHandlingConfig,
  VoiceV2TransferSessionState,
} from "../after-hours-handling-types";
import { buildWarmTransferBriefing } from "./warm-briefing";
import type { VoiceV2TransferProvider } from "./transfer-provider";

export type ExecuteTransferInput = {
  ctx: VoiceV2CallContext;
  config: VoiceV2PublishedAfterHoursHandlingConfig;
  provider: VoiceV2TransferProvider;
  callControlId: string;
  planId?: string;
  invocationId: string;
  callerRequested?: boolean;
};

export type ExecuteTransferResult =
  | {
      ok: true;
      status: "TRANSFERRED";
      speak: string;
      transfer: VoiceV2TransferSessionState;
    }
  | {
      ok: false;
      status: "TRANSFER_FAILED";
      speak: string;
      transfer: VoiceV2TransferSessionState;
      lastResult: string;
    };

function resolvePlan(config: VoiceV2PublishedAfterHoursHandlingConfig, planId?: string) {
  const id = planId || config.defaultTransferPlanId;
  return config.transferPlans.find((p) => p.id === id && p.enabled) || config.transferPlans[0];
}

function destinationForStep(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  destinationId: string,
) {
  return config.transferDestinations.find((d) => d.id === destinationId && d.enabled);
}

export async function executeVoiceV2TransferPlan(
  input: ExecuteTransferInput,
): Promise<ExecuteTransferResult> {
  if (!input.config.transferEnabled) {
    return {
      ok: false,
      status: "TRANSFER_FAILED",
      speak: "Transfer is not available on this line.",
      transfer: {
        status: "FAILED",
        transferGeneration: (input.ctx.afterHours?.transfer?.transferGeneration ?? 0) + 1,
        lastResult: "CONFIGURATION_ERROR",
        updatedAt: new Date().toISOString(),
      },
      lastResult: "CONFIGURATION_ERROR",
    };
  }
  if (input.callerRequested && !input.config.allowCallerRequestedTransfer) {
    return {
      ok: false,
      status: "TRANSFER_FAILED",
      speak: "I cannot connect you to a person right now, but I can help or take a message.",
      transfer: {
        status: "FAILED",
        transferGeneration: (input.ctx.afterHours?.transfer?.transferGeneration ?? 0) + 1,
        lastResult: "CONFIGURATION_ERROR",
        updatedAt: new Date().toISOString(),
      },
      lastResult: "CONFIGURATION_ERROR",
    };
  }

  const plan = resolvePlan(input.config, input.planId);
  if (!plan?.steps.length) {
    return {
      ok: false,
      status: "TRANSFER_FAILED",
      speak: "Transfer is not configured.",
      transfer: {
        status: "FAILED",
        transferGeneration: (input.ctx.afterHours?.transfer?.transferGeneration ?? 0) + 1,
        lastResult: "CONFIGURATION_ERROR",
        updatedAt: new Date().toISOString(),
      },
      lastResult: "CONFIGURATION_ERROR",
    };
  }

  const generation = (input.ctx.afterHours?.transfer?.transferGeneration ?? 0) + 1;
  const existingInvocation = input.ctx.afterHours?.transfer?.invocationId;
  if (existingInvocation === input.invocationId && input.ctx.afterHours?.transfer?.status === "SUCCEEDED") {
    return {
      ok: true,
      status: "TRANSFERRED",
      speak: "You are already being connected.",
      transfer: input.ctx.afterHours!.transfer!,
    };
  }

  for (const step of [...plan.steps].sort((a, b) => a.order - b.order)) {
    const dest = destinationForStep(input.config, step.destinationId);
    if (!dest) continue;

    const briefing =
      step.transferMode === "WARM"
        ? buildWarmTransferBriefing(input.ctx, dest.label)
        : undefined;

    const res = await input.provider.initiateTransfer({
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callControlId: input.callControlId,
      destinationE164: dest.phoneE164,
      mode: step.transferMode,
      briefingText: briefing,
      transferGeneration: generation,
      stepOrder: step.order,
      invocationId: input.invocationId,
    });

    const transfer: VoiceV2TransferSessionState = {
      status: res.result === "SUCCESS" ? "SUCCEEDED" : "FAILED",
      transferGeneration: generation,
      planId: plan.id,
      currentStepOrder: step.order,
      currentDestinationId: dest.id,
      lastResult: res.result,
      invocationId: input.invocationId,
      updatedAt: new Date().toISOString(),
    };

    if (res.result === "SUCCESS") {
      return {
        ok: true,
        status: "TRANSFERRED",
        speak: "Connecting you now.",
        transfer,
      };
    }

    if (plan.routing === "SINGLE") {
      return {
        ok: false,
        status: "TRANSFER_FAILED",
        speak: "I could not reach anyone. I can take a message or arrange a callback.",
        transfer,
        lastResult: res.result,
      };
    }
  }

  return {
    ok: false,
    status: "TRANSFER_FAILED",
    speak: "I could not reach anyone on the transfer list.",
    transfer: {
      status: "FAILED",
      transferGeneration: generation,
      planId: plan.id,
      lastResult: "NO_ANSWER",
      invocationId: input.invocationId,
      updatedAt: new Date().toISOString(),
    },
    lastResult: "NO_ANSWER",
  };
}

export function rejectArbitraryTransferDestination(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  phone: string,
): boolean {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return true;
  return !config.transferDestinations.some(
    (d) => d.phoneE164.replace(/\D/g, "") === normalized,
  );
}
