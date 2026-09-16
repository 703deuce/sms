import type { VoiceV2RecoveryTranscriptTurn } from "./types";

export function parseVoiceTranscriptFullText(fullText: string): VoiceV2RecoveryTranscriptTurn[] {
  const turns: VoiceV2RecoveryTranscriptTurn[] = [];
  for (const line of fullText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(caller|agent|customer|assistant|ai|user|business):\s*(.+)$/i);
    if (m) {
      const speaker = m[1].toLowerCase();
      const role =
        speaker === "caller" || speaker === "customer" || speaker === "user"
          ? "caller"
          : speaker === "agent" || speaker === "assistant" || speaker === "ai" || speaker === "business"
            ? "agent"
            : "system";
      turns.push({ role, text: m[2].trim() });
      continue;
    }
    turns.push({ role: "system", text: trimmed });
  }
  return turns;
}

export async function loadVoiceTranscriptTurnsForCall(input: {
  workspaceId: string;
  callId: string;
}): Promise<VoiceV2RecoveryTranscriptTurn[]> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const transcript = await prisma.voiceTranscript.findFirst({
    where: { workspaceId: input.workspaceId, callId: input.callId },
    select: { fullText: true },
  });
  if (!transcript?.fullText?.trim()) return [];
  return parseVoiceTranscriptFullText(transcript.fullText);
}
