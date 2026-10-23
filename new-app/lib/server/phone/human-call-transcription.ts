import "server-only";
import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

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

function buildFollowUpSuggestion(transcript: string): string {
  const t = transcript.toLowerCase();
  if (t.includes("call back") || t.includes("callback")) return "Schedule a callback at the time they mentioned.";
  if (t.includes("not interested")) return "Mark not interested; remove from active queue if policy allows.";
  if (t.includes("send") && t.includes("email")) return "Send requested information and log a follow-up task.";
  return "Review transcript and set next disposition or callback.";
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

  const summary = transcript.length > 400 ? `${transcript.slice(0, 400)}…` : transcript;
  const followUp = buildFollowUpSuggestion(transcript);
  await prisma.humanCall.update({
    where: { id: humanCallId },
    data: {
      transcriptText: transcript,
      aiSummary: `Suggested follow-up: ${followUp}\n\nSummary: ${summary}`,
    },
  });
  return { ok: true };
}
