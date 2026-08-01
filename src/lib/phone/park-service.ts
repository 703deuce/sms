import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "./human-call-service";

function nextSlotCode() {
  return String(Math.floor(100 + Math.random() * 900));
}

export async function parkCall(input: {
  workspaceId: string;
  humanCallId: string;
  userId: string;
  timeoutSeconds?: number;
  fallbackTarget?: string | null;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Call not found or missing control id");

  let slotCode = nextSlotCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.callParkSlot.findUnique({
      where: { workspaceId_slotCode: { workspaceId: input.workspaceId, slotCode } },
    });
    if (!existing || existing.status === "available" || existing.status === "retrieved") break;
    slotCode = nextSlotCode();
  }

  const timeoutAt = new Date(Date.now() + (input.timeoutSeconds || 180) * 1000);
  const slot = await prisma.callParkSlot.upsert({
    where: { workspaceId_slotCode: { workspaceId: input.workspaceId, slotCode } },
    create: {
      workspaceId: input.workspaceId,
      slotCode,
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId,
      parkedByUserId: input.userId,
      status: "parked",
      parkedAt: new Date(),
      timeoutAt,
      fallbackTarget: input.fallbackTarget || null,
    },
    update: {
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId,
      parkedByUserId: input.userId,
      status: "parked",
      parkedAt: new Date(),
      timeoutAt,
      fallbackTarget: input.fallbackTarget || null,
    },
  });

  if (isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/hold`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  await prisma.humanCall.update({
    where: { id: call.id },
    data: { onHold: true, parkSlotId: slot.id, status: "parked" },
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "phone_park_timeout",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: { slotId: slot.id, workspaceId: input.workspaceId },
    idempotencyKey: `park-timeout-${slot.id}`,
    runAfter: timeoutAt,
  });

  return slot;
}

export async function retrieveParkedCall(input: {
  workspaceId: string;
  slotCode: string;
  userId: string;
}) {
  const prisma = getPrisma();
  const slot = await prisma.callParkSlot.findUnique({
    where: {
      workspaceId_slotCode: { workspaceId: input.workspaceId, slotCode: input.slotCode },
    },
  });
  if (!slot || slot.status !== "parked") throw new Error("Parked call not found");

  if (slot.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${slot.telnyxCallControlId}/actions/unhold`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  await prisma.callParkSlot.update({
    where: { id: slot.id },
    data: { status: "retrieved" },
  });

  if (slot.humanCallId) {
    await prisma.humanCall.update({
      where: { id: slot.humanCallId },
      data: {
        onHold: false,
        parkSlotId: null,
        status: "in_progress",
        agentUserId: input.userId,
      },
    });
  }

  return slot;
}

export async function listParkedCalls(workspaceId: string) {
  return getPrisma().callParkSlot.findMany({
    where: { workspaceId, status: "parked" },
    orderBy: { parkedAt: "desc" },
  });
}
