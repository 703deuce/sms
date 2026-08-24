import "server-only";

import { getPrisma } from "@/lib/db";
import { holdCall, unholdCall, speakOnCall, hangupCall, gatherUsingSpeak } from "./telnyx-provider";
import { resolveWorkspaceHoldAudio } from "./hold-audio-resolver";
import { startWhisperTransfer } from "./whisper-service";
import { isDestinationAvailable } from "./destination-availability";

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

function normalizeDtmfKey(key: string | null | undefined): string {
  return String(key ?? "*2")
    .trim()
    .replace(/\s/g, "")
    .replace(/star/gi, "*")
    .toLowerCase();
}

export async function handleConnectedCallDtmf(input: {
  callControlId: string;
  digit: string;
}) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallControlSession.findFirst({
    where: {
      OR: [
        { employeeCallControlId: input.callControlId },
        { customerCallControlId: input.callControlId },
      ],
    },
  });
  if (!row || row.controlState !== "normal") return { handled: false as const };

  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: row.workspaceId },
    select: { transferDtmfKey: true, conferenceDtmfKey: true },
  });
  const transferKey = normalizeDtmfKey(settings?.transferDtmfKey);
  const conferenceKey = normalizeDtmfKey(settings?.conferenceDtmfKey);

  const meta = (row.metadata as { dtmfBuffer?: string } | null) ?? {};
  const buffer = `${meta.dtmfBuffer ?? ""}${input.digit}`.slice(-4);

  await prisma.smartRoutingCallControlSession.update({
    where: { id: row.id },
    data: { metadata: { ...meta, dtmfBuffer: buffer } },
  });

  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: row.callSessionId },
    select: { flowId: true, callControlId: true, calledNumber: true },
  });
  if (!session?.callControlId) return { handled: false as const };

  const employeeId = row.employeeCallControlId;
  const customerId = row.customerCallControlId ?? session.callControlId;

  if (buffer.endsWith(transferKey)) {
    await prisma.smartRoutingCallControlSession.update({
      where: { id: row.id },
      data: { metadata: { ...meta, dtmfBuffer: "" } },
    });
    await beginTransferFromDtmf({
      sessionId: row.callSessionId,
      workspaceId: row.workspaceId,
      flowId: session.flowId,
      employeeCallControlId: employeeId,
      customerCallControlId: customerId,
    });
    return { handled: true as const, action: "transfer_menu" };
  }

  if (buffer.endsWith(conferenceKey)) {
    await prisma.smartRoutingCallControlSession.update({
      where: { id: row.id },
      data: { controlState: "conference_menu", metadata: { ...meta, dtmfBuffer: "" } },
    });
    await gatherUsingSpeak({
      callControlId: employeeId,
      text: "Conference. Press 1 to add another caller. Press 9 to cancel.",
      validDigits: "19",
      clientState: {
        kind: "smart_routing",
        sessionId: row.callSessionId,
        workspaceId: row.workspaceId,
        flowId: session.flowId,
        awaiting: "conference_menu",
      },
      sessionId: row.callSessionId,
    });
    return { handled: true as const, action: "conference_menu" };
  }

  return { handled: false as const };
}

export async function handleTransferMenuDigit(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  employeeCallControlId: string;
  digit: string;
}) {
  const prisma = getPrisma();
  const control = await prisma.smartRoutingCallControlSession.findFirst({
    where: { callSessionId: input.sessionId },
  });
  if (!control?.customerCallControlId) return { handled: false as const };

  const digit = input.digit.charAt(0);
  if (digit === "9") {
    await completeTransferCancel({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      employeeCallControlId: input.employeeCallControlId,
      customerCallControlId: control.customerCallControlId,
      consultationCallControlId: control.consultationCallControlId,
    });
    return { handled: true as const, action: "cancel" };
  }

  if (digit === "1") {
    type DestPick = {
      id: string;
      label: string;
      active: boolean;
      availabilityStatus: string | null;
      unavailableUntil: Date | null;
      onBusinessCall: boolean;
    };
    const destinations = (await prisma.smartRoutingDestination.findMany({
      where: {
        workspaceId: input.workspaceId,
        active: true,
        allowTransferTo: true,
        phoneNumber: { not: null },
      },
      orderBy: { label: "asc" },
      take: 9,
      select: {
        id: true,
        label: true,
        active: true,
        availabilityStatus: true,
        unavailableUntil: true,
        onBusinessCall: true,
      },
    })) as DestPick[];
    const list = destinations.filter((d) => isDestinationAvailable(d));
    if (!list.length) {
      await speakOnCall(input.employeeCallControlId, "No destinations available.", undefined, input.sessionId);
      return { handled: true as const, action: "no_destinations" };
    }
    const parts = list.map((d, i) => `Press ${i + 1} for ${d.label}.`).join(" ");
    await prisma.smartRoutingCallControlSession.updateMany({
      where: { callSessionId: input.sessionId },
      data: {
        controlState: "transfer_destination_entry",
        metadata: { transferDestinations: list.map((d) => d.id) },
      },
    });
    await gatherUsingSpeak({
      callControlId: input.employeeCallControlId,
      text: parts,
      validDigits: list.map((_, i) => String(i + 1)).join(""),
      clientState: {
        kind: "smart_routing",
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        awaiting: "transfer_pick_destination",
      },
      sessionId: input.sessionId,
    });
    return { handled: true as const, action: "pick_destination" };
  }

  if (digit === "2") {
    await prisma.smartRoutingCallControlSession.updateMany({
      where: { callSessionId: input.sessionId },
      data: { controlState: "transfer_destination_entry" },
    });
    await gatherUsingSpeak({
      callControlId: input.employeeCallControlId,
      text: "Enter the 10 digit number followed by pound.",
      validDigits: "0123456789",
      maxDigits: 10,
      finishOnKey: "#",
      clientState: {
        kind: "smart_routing",
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        awaiting: "transfer_manual_entry",
      },
      sessionId: input.sessionId,
    });
    return { handled: true as const, action: "manual_entry" };
  }

  if (digit === "3") {
    await transferCustomerToVoicemail({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      flowId: input.flowId,
      employeeCallControlId: input.employeeCallControlId,
      customerCallControlId: control.customerCallControlId,
    });
    return { handled: true as const, action: "voicemail" };
  }

  return { handled: false as const };
}

export async function handleTransferDestinationPick(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  employeeCallControlId: string;
  digit: string;
}) {
  const prisma = getPrisma();
  const control = await prisma.smartRoutingCallControlSession.findFirst({
    where: { callSessionId: input.sessionId },
  });
  const meta = (control?.metadata as { transferDestinations?: string[] } | null) ?? {};
  const ids = meta.transferDestinations ?? [];
  const idx = Number(input.digit.charAt(0)) - 1;
  const destId = ids[idx];
  if (!destId || !control?.customerCallControlId) return { handled: false as const };

  const { resolveDestinationForRouting } = await import("./destination-resolver");
  const dest = await resolveDestinationForRouting(input.workspaceId, destId);
  if (!dest) {
    await speakOnCall(input.employeeCallControlId, "That destination is unavailable.", undefined, input.sessionId);
    return { handled: true as const };
  }

  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: input.sessionId },
    select: { calledNumber: true },
  });

  await dialTransferDestination({
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: "dtmf_transfer",
    callerControlId: control.customerCallControlId,
    employeeCallControlId: input.employeeCallControlId,
    destinationPhone: dest.phone,
    fromNumber: session?.calledNumber ?? "",
    whisperLabel: dest.label ? `Transfer to ${dest.label}. Press 1 to accept.` : undefined,
  });
  return { handled: true as const };
}

export async function handleTransferManualEntry(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  employeeCallControlId: string;
  digits: string;
}) {
  const prisma = getPrisma();
  const control = await prisma.smartRoutingCallControlSession.findFirst({
    where: { callSessionId: input.sessionId },
  });
  if (!control?.customerCallControlId) return { handled: false as const };

  const num = input.digits.replace(/\D/g, "").slice(0, 10);
  if (num.length < 10) {
    await speakOnCall(input.employeeCallControlId, "Invalid number.", undefined, input.sessionId);
    return { handled: true as const };
  }
  const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
  const phone = normalizeE164(`+1${num}`);
  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: input.sessionId },
    select: { calledNumber: true },
  });

  await dialTransferDestination({
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: "dtmf_transfer",
    callerControlId: control.customerCallControlId,
    employeeCallControlId: input.employeeCallControlId,
    destinationPhone: phone,
    fromNumber: session?.calledNumber ?? "",
  });
  return { handled: true as const };
}

export async function transferCustomerToVoicemail(input: {
  sessionId: string;
  workspaceId: string;
  flowId: string;
  employeeCallControlId: string;
  customerCallControlId: string;
}) {
  const prisma = getPrisma();
  try {
    const { hangupCall, stopPlaybackOnCall } = await import("./telnyx-provider");
    await stopPlaybackOnCall(input.customerCallControlId, input.sessionId);
    await hangupCall(input.employeeCallControlId);
  } catch {
    // ignore
  }

  const flowId =
    (
      await prisma.smartRoutingCallSession.findFirst({
        where: { id: input.sessionId },
        select: { flowId: true },
      })
    )?.flowId ?? input.flowId;

  const published = await import("./session-store").then((m) => m.loadPublishedCompiledFlow(flowId));
  const compiled = published?.compiled as import("./types").CompiledFlow | undefined;
  const vmNode = compiled?.nodes
    ? Object.values(compiled.nodes).find((n) => n.type === "VOICEMAIL")
    : null;

  if (vmNode) {
    const { executeNode } = await import("./flow-runtime");
    await executeNode({ sessionId: input.sessionId, nodeId: vmNode.id });
  } else {
    const { speakOnCall, startRecording } = await import("./telnyx-provider");
    await speakOnCall(
      input.customerCallControlId,
      "Please leave a message after the tone.",
      undefined,
      input.sessionId,
    );
    await startRecording(input.customerCallControlId, input.sessionId);
  }

  await prisma.smartRoutingCallControlSession.updateMany({
    where: { callSessionId: input.sessionId },
    data: { controlState: "normal", heldParticipant: null },
  });
}

export async function registerConnectedCallControl(input: {
  workspaceId: string;
  callSessionId: string;
  employeeCallControlId: string;
  customerCallControlId: string;
  destinationId?: string | null;
  employeePhoneE164?: string | null;
}) {
  await getOrCreateCallControlSession({
    workspaceId: input.workspaceId,
    callSessionId: input.callSessionId,
    employeeCallControlId: input.employeeCallControlId,
    customerCallControlId: input.customerCallControlId,
  });
  if (input.destinationId || input.employeePhoneE164) {
    const prisma = getPrisma();
    const row = await prisma.smartRoutingCallControlSession.findFirst({
      where: { callSessionId: input.callSessionId },
    });
    if (row) {
      await prisma.smartRoutingCallControlSession.update({
        where: { id: row.id },
        data: {
          metadata: {
            destinationId: input.destinationId ?? null,
            employeePhoneE164: input.employeePhoneE164 ?? null,
          },
        },
      });
    }
  }
  await markEmployeeOnBusinessCall(
    input.workspaceId,
    input.destinationId ?? null,
    input.employeePhoneE164,
  );
}

export async function teardownConnectedCallControl(callSessionId: string, workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingCallControlSession.findFirst({
    where: { callSessionId },
  });
  if (!row) return;
  const meta = (row.metadata as { destinationId?: string; employeePhoneE164?: string } | null) ?? {};
  await clearEmployeeOnBusinessCall(
    workspaceId,
    meta.destinationId ?? null,
    meta.employeePhoneE164,
  );
  await prisma.smartRoutingCallControlSession.deleteMany({ where: { callSessionId } });
}
