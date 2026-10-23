import "server-only";
import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";
import {
  buildConversationIntelligence,
  serializeIntelligenceForStorage,
} from "@/lib/server/phone/power-dialer/call-intelligence";

async function transcribeWithDeepgram(recordingUrl: string): Promise<string | null> {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: recordingUrl }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const text = json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
  return text || null;
}

export async function maybeTranscribePowerDialerCall(workspaceId: string, humanCallId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: humanCallId, workspaceId } });
  if (!call || call.source !== "power_dialer" || !call.recordingUrl) return { skipped: true };
  if (call.transcriptText) return { skipped: true, reason: "already_transcribed" };

  const settings = await getPowerDialerSettings(workspaceId);
  if (settings.recordingEnabled === false) return { skipped: true, reason: "recording_disabled" };

  const transcript = await transcribeWithDeepgram(call.recordingUrl);
  if (!transcript) return { skipped: true, reason: "deepgram_unavailable" };

  const intel = buildConversationIntelligence(transcript);
  await prisma.humanCall.update({
    where: { id: humanCallId },
    data: {
      transcriptText: transcript,
      aiSummary: serializeIntelligenceForStorage(intel),
    },
  });
  return { ok: true };
}
