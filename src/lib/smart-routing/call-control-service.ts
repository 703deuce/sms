import "server-only";

import { getPrisma } from "@/lib/db";
import { holdCall, unholdCall, speakOnCall, hangupCall, gatherUsingSpeak } from "./telnyx-provider";
import { resolveWorkspaceHoldAudio } from "./hold-audio-resolver";
import { startWhisperTransfer } from "./whisper-service";

export type CallControlState =
  | "normal"
  | "transfer_menu"
  | "transfer_destination_entry"
  | "transfer_consultation"
  | "conference_menu";

export async function getOrCreateCallControlSession(input: {
  workspaceId: string;
  callSessionId: string;
  employeeCallControlId: string;
  customerCallControlId?: string | null;
}) {
  const prisma = getPrisma();
  const existing = await prisma.smartRoutingCallControlSession.findFirst({
    where: { callSessionId: input.callSessionId },
  });
  if (existing) return existing;
  return prisma.smartRoutingCallControlSession.create({
    data: {
      workspaceId: input.workspaceId,
      callSessionId: input.callSessionId,
      employeeCallControlId: input.employeeCallControlId,
      customerCallControlId: input.customerCallControlId ?? null,
      controlState: "normal",
      transferPathJson: [],
    },
  });
}

export async function markEmployeeOnBusinessCall(
  workspaceId: string,
  destinationId: string | null,
  employeePhoneE164?: string | null,
) {
  const prisma = getPrisma();
  if (destinationId) {
    await prisma.smartRoutingDestination.updateMany({
      where: { id: destinationId, workspaceId },
      data: { onBusinessCall: true },
    });
    return;
  }
  if (employeePhoneE164) {
    await prisma.smartRoutingDestination.updateMany({
      where: { workspaceId, phoneNumber: employeePhoneE164 },
      data: { onBusinessCall: true },
    });
  }
}

export async function clearEmployeeOnBusinessCall(
  workspaceId: string,
  destinationId: string | null,
  employeePhoneE164?: string | null,
) {
  const prisma = getPrisma();
  if (destinationId) {
    await prisma.smartRoutingDestination.updateMany({
      where: { id: destinationId, workspaceId },
      data: { onBusinessCall: false },
    });
    return;
  }
  if (employeePhoneE164) {
    await prisma.smartRoutingDestination.updateMany({
      where: { workspaceId, phoneNumber: employeePhoneE164 },
      data: { onBusinessCall: false },
    });
  }
}

export async function beginTransferFromDtmf(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  employeeCallControlId: string;
  customerCallControlId: string;
  nodeId?: string;
}) {
  const holdAudio = await resolveWorkspaceHoldAudio(input.workspaceId);
  await holdCall(input.customerCallControlId, input.sessionId);
  await speakOnCall(
    input.customerCallControlId,
    "Please hold while we connect your call.",
    undefined,
    input.sessionId,
  );

  const prisma = getPrisma();
  await prisma.smartRoutingCallControlSession.updateMany({
    where: { callSessionId: input.sessionId },
    data: {
      controlState: "transfer_menu",
      heldParticipant: "customer",
      customerCallControlId: input.customerCallControlId,
    },
  });

  if (holdAudio.mode === "music" && holdAudio.playbackUrl) {
    const { playbackOnCall } = await import("./telnyx-provider");
    await playbackOnCall(input.customerCallControlId, holdAudio.playbackUrl, undefined, input.sessionId);
  }

  const clientState = {
    kind: "smart_routing" as const,
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: input.nodeId ?? "transfer",
    awaiting: "transfer_menu",
  };

  await gatherUsingSpeak({
    callControlId: input.employeeCallControlId,
    text:
      "Transfer call. Press 1 for a person or group. Press 2 to enter a number. Press 3 for voicemail. Press 9 to return to the caller.",
    validDigits: "1239",
    clientState,
    sessionId: input.sessionId,
  });
}

export async function completeTransferCancel(input: {
  sessionId: string;
  workspaceId: string;
  employeeCallControlId: string;
  customerCallControlId: string;
  consultationCallControlId?: string | null;
}) {
  if (input.consultationCallControlId) {
    try {
      await hangupCall(input.consultationCallControlId);
    } catch {
      // ignore
    }
  }
  try {
    const { stopPlaybackOnCall } = await import("./telnyx-provider");
    await stopPlaybackOnCall(input.customerCallControlId, input.sessionId);
  } catch {
    // ignore
  }
  await unholdCall(input.customerCallControlId, input.sessionId);
  const prisma = getPrisma();
  await prisma.smartRoutingCallControlSession.updateMany({
    where: { callSessionId: input.sessionId },
    data: {
      controlState: "normal",
      heldParticipant: null,
      consultationCallControlId: null,
    },
  });
  await speakOnCall(input.customerCallControlId, "Thank you for holding.", undefined, input.sessionId);
}

export async function dialTransferDestination(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  nodeId: string;
  callerControlId: string;
  employeeCallControlId: string;
  destinationPhone: string;
  fromNumber: string;
  whisperLabel?: string;
}) {
  return startWhisperTransfer({
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: input.nodeId,
    callerControlId: input.callerControlId,
    agentPhone: input.destinationPhone,
    fromNumber: input.fromNumber,
    whisperText: input.whisperLabel ?? "Transfer call. Press 1 to accept.",
  });
}
