import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "./telnyx/assistant-sync";

export async function initiateTransfer(input: {
  workspaceId: string;
  callId: string;
  destination: string;
  transferType: string;
  summary?: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Call not active for transfer");

  const transfer = await prisma.voiceTransfer.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      transferType: input.transferType,
      destination: input.destination,
      status: "requested",
      summary: input.summary,
    },
  });

  if (!isTelnyxVoiceConfigured() || call.telnyxCallControlId.startsWith("mock_")) {
    await prisma.voiceTransfer.update({
      where: { id: transfer.id },
      data: { status: "completed", answered: true, completedAt: new Date() },
    });
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: { transferred: true, status: "TRANSFERRED" },
    });
    return { mode: "mock", transferId: transfer.id };
  }

  const isWarm = input.transferType === "warm_transfer";
  await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/transfer`, {
    method: "POST",
    body: {
      to: input.destination,
      timeout_secs: 30,
      answering_machine_detection: "detect",
      ...(isWarm ? { sip_headers: [{ name: "X-Transfer-Summary", value: input.summary || "" }] } : {}),
    },
  });

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: { transferred: true },
  });

  return { mode: "telnyx", transferId: transfer.id };
}

export async function handleTransferAmdResult(
  callId: string,
  workspaceId: string,
  amdResult: string,
) {
  const prisma = getPrisma();
  const transfer = await prisma.voiceTransfer.findFirst({
    where: { callId, workspaceId },
    orderBy: { createdAt: "desc" },
  });
  if (!transfer) return;

  if (amdResult === "machine" || amdResult === "machine_end_beep") {
    await prisma.voiceTransfer.update({
      where: { id: transfer.id },
      data: {
        status: "voicemail",
        voicemailDetected: true,
        completedAt: new Date(),
      },
    });
    // Return caller to AI — mark call in progress again
    await prisma.voiceCall.update({
      where: { id: callId },
      data: { status: "IN_PROGRESS", transferred: false },
    });
  }
}
