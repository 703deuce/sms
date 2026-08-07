/**
 * Pull Telnyx AI conversation messages into VoiceTranscript when live
 * transcription webhooks did not reach the Call Control handler (TeXML-direct).
 */

import { getPrisma } from "@/lib/db";
import * as ai from "@/lib/voice/telnyx/ai-client";

function speakerFromRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("user") || r.includes("caller") || r === "human") return "caller";
  if (r.includes("assistant") || r.includes("agent") || r.includes("ai")) return "agent";
  return role || "unknown";
}

export async function syncTranscriptFromTelnyxConversation(input: {
  workspaceId: string;
  callId: string;
  telnyxConversationId: string;
}): Promise<{ synced: boolean; segmentCount: number }> {
  const prisma = getPrisma();

  const existing = await prisma.voiceTranscript.findFirst({
    where: { workspaceId: input.workspaceId, callId: input.callId },
    select: { id: true, fullText: true },
  });
  if (existing?.fullText && existing.fullText.trim().length > 20) {
    return { synced: false, segmentCount: 0 };
  }

  let msgs: Record<string, unknown>[] = [];
  try {
    const remote = await ai.listConversationMessages(input.telnyxConversationId);
    const root = remote && typeof remote === "object" ? (remote as Record<string, unknown>) : null;
    const dataField = root?.data;
    msgs = (
      Array.isArray(dataField)
        ? dataField
        : Array.isArray((dataField as { messages?: unknown } | null)?.messages)
          ? (dataField as { messages: unknown[] }).messages
          : Array.isArray(root?.messages)
            ? root!.messages
            : Array.isArray(remote)
              ? remote
              : []
    ) as Record<string, unknown>[];
  } catch {
    return { synced: false, segmentCount: 0 };
  }

  const lines: string[] = [];
  let segmentCount = 0;

  for (const m of msgs) {
    const text = String(m.content || m.text || m.message || "").trim();
    if (!text) continue;
    const role = String(m.role || m.sender || "unknown");
    const speaker = speakerFromRole(role);
    lines.push(`${speaker}: ${text}`);
    segmentCount += 1;
  }

  if (!lines.length) return { synced: false, segmentCount: 0 };

  const fullText = lines.join("\n");
  let transcript = existing;
  if (!transcript) {
    transcript = await prisma.voiceTranscript.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        fullText,
        source: "telnyx_conversation_sync",
      },
      select: { id: true, fullText: true },
    });
  } else {
    transcript = await prisma.voiceTranscript.update({
      where: { id: transcript.id },
      data: { fullText, source: "telnyx_conversation_sync" },
      select: { id: true, fullText: true },
    });
  }

  let seq = 0;
  for (const m of msgs) {
    const text = String(m.content || m.text || m.message || "").trim();
    if (!text) continue;
    const role = String(m.role || m.sender || "unknown");
    const speaker = speakerFromRole(role);
    const telnyxMessageId = String(m.id || `${seq}`);
    const dup = await prisma.voiceTranscriptSegment.findFirst({
      where: { transcriptId: transcript!.id, text },
    });
    if (dup) {
      seq += 1;
      continue;
    }
    await prisma.voiceTranscriptSegment.create({
      data: {
        transcriptId: transcript!.id,
        speaker,
        text,
        startMs: seq * 1000,
        endMs: seq * 1000 + 500,
        metadata: { telnyxMessageId, role } as object,
      },
    });
    seq += 1;
  }

  return { synced: true, segmentCount };
}
