import "server-only";

import { getPrisma } from "@/lib/db";
import { shouldStartCallRecording } from "@/lib/voice/inbound";
import { startCallRecording } from "@/lib/voice/telnyx/assistant-sync";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";

export async function maybeStartVoiceV3TelnyxRecording(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  direction?: "INBOUND" | "OUTBOUND";
}): Promise<void> {
  try {
    const cfg = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
    const telephony = (cfg as { telephony?: { callRecording?: string } }).telephony;
    const callRecording =
      telephony?.callRecording ??
      (cfg as { callHandling?: { callRecording?: string } }).callHandling?.callRecording ??
      "all";

    const direction = input.direction ?? "INBOUND";
    if (!shouldStartCallRecording(callRecording, direction)) return;

    const prisma = getPrisma();
    const pending = await prisma.voiceRecording.findFirst({
      where: { callId: input.callId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (!pending) {
      await prisma.voiceRecording.create({
        data: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          provider: "telnyx",
          status: "recording",
          channels: 2,
          format: "mp3",
        },
      });
    }

    await startCallRecording(input.telnyxCallControlId);
    console.log("VOICE_RECORDING_STARTED", {
      callId: input.callId,
      workspaceId: input.workspaceId,
    });
  } catch (err) {
    console.warn("VOICE_RECORDING_START_FAILED", {
      callId: input.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
