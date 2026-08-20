import { getPrisma } from "@/lib/db";
import { updatePortStatus } from "../port-service";
import { handleTelnyxPortOutWebhook } from "../telnyx-port-out-service";
import { handleTwilioPortOutWebhook } from "../twilio-port-out-service";
import type { ApplyNormalizedPortEventResult, NormalizedPortEvent } from "./types";
import {
  buildTelnyxPortOutWebhookPayload,
  buildTwilioPortOutWebhookPayload,
} from "./webhook-adapters";

export function isPortSimulationEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.PORT_SIMULATION_ENABLED === "1";
  }
  return process.env.PORT_SIMULATION_ENABLED !== "0";
}

async function recordProviderEvent(event: NormalizedPortEvent): Promise<{
  duplicate: boolean;
}> {
  const prisma = getPrisma();
  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { providerEventId: event.providerEventId },
  });
  if (existing?.status === "processed") {
    return { duplicate: true };
  }

  await prisma.providerWebhookEvent.upsert({
    where: { providerEventId: event.providerEventId },
    create: {
      provider: event.provider,
      eventType: event.direction,
      providerEventId: event.providerEventId,
      payload: event as object,
      status: "received",
    },
    update: {
      payload: event as object,
      eventType: event.direction,
    },
  });

  return { duplicate: false };
}

async function markProviderEventProcessed(providerEventId: string) {
  await getPrisma().providerWebhookEvent.update({
    where: { providerEventId },
    data: { status: "processed", processedAt: new Date(), errorMessage: null },
  });
}

export async function applyNormalizedPortEvent(input: {
  event: NormalizedPortEvent;
  workspaceId?: string;
  portInRequestId?: string;
  portOutRequestId?: string;
  byUserId?: string;
  skipIdempotency?: boolean;
}): Promise<ApplyNormalizedPortEventResult> {
  const { event } = input;
  if (!isPortSimulationEnabled()) {
    throw new Error("Port simulation is disabled. Set PORT_SIMULATION_ENABLED=1 to run harness events.");
  }

  if (!input.skipIdempotency) {
    const recorded = await recordProviderEvent(event);
    if (recorded.duplicate || event.duplicate) {
      return {
        handled: true,
        direction: event.direction,
        provider: event.provider,
        duplicate: true,
        status: event.portOutStatus || event.portInStatus,
      };
    }
  }

  if (event.direction === "port_out") {
    const payload =
      event.provider === "telnyx"
        ? buildTelnyxPortOutWebhookPayload(event)
        : buildTwilioPortOutWebhookPayload(event);
    const result =
      event.provider === "telnyx"
        ? await handleTelnyxPortOutWebhook(payload)
        : await handleTwilioPortOutWebhook(payload);

    if (!input.skipIdempotency) {
      await markProviderEventProcessed(event.providerEventId);
    }

    return {
      handled: Boolean(result.handled),
      direction: event.direction,
      provider: event.provider,
      portOutId: "portOutId" in result ? result.portOutId : undefined,
      status: "status" in result ? String(result.status) : event.portOutStatus,
      reason: "reason" in result ? String(result.reason) : undefined,
    };
  }

  if (!input.workspaceId || !input.portInRequestId || !input.byUserId || !event.portInStatus) {
    return {
      handled: false,
      direction: event.direction,
      provider: event.provider,
      reason: "port_in_requires_workspace_context",
    };
  }

  const updated = await updatePortStatus({
    workspaceId: input.workspaceId,
    id: input.portInRequestId,
    status: event.portInStatus,
    byUserId: input.byUserId,
    note: event.note || `Simulation: ${event.portInStatus}`,
    providerPortId: event.providerEventId,
  });

  if (!input.skipIdempotency) {
    await markProviderEventProcessed(event.providerEventId);
  }

  return {
    handled: true,
    direction: event.direction,
    provider: event.provider,
    portInId: updated.id,
    status: updated.status,
  };
}
