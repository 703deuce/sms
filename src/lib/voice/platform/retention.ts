/**
 * Retention / deletion for AI conversations, transcripts, and memory configs.
 */

import { getPrisma } from "@/lib/db";
import * as ai from "@/lib/voice/telnyx/ai-client";

export async function runVoiceAiRetention(workspaceId?: string) {
  const prisma = getPrisma();
  const memories = await prisma.voiceMemoryConfig.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      retentionDays: { not: null },
    },
    take: 200,
  });

  let conversationsDeleted = 0;
  let messagesDeleted = 0;
  let transcriptsDeleted = 0;

  for (const mem of memories) {
    const days = mem.retentionDays ?? 30;
    if (days <= 0) continue;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const convs = await prisma.voiceAiConversation.findMany({
      where: {
        workspaceId: mem.workspaceId,
        ...(mem.agentId ? { agentId: mem.agentId } : {}),
        createdAt: { lt: cutoff },
      },
      take: 100,
    });
    for (const c of convs) {
      if (c.telnyxConversationId && ai.isTelnyxAiConfigured()) {
        await ai.deleteConversation(c.telnyxConversationId).catch(() => undefined);
      }
      const msgCount = await prisma.voiceAiConversationMessage.deleteMany({
        where: { conversationId: c.id },
      });
      messagesDeleted += msgCount.count;
      await prisma.voiceAiConversation.delete({ where: { id: c.id } });
      conversationsDeleted += 1;
    }

    if (mem.agentId) {
      const calls = await prisma.voiceCall.findMany({
        where: {
          workspaceId: mem.workspaceId,
          agentId: mem.agentId,
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        take: 100,
      });
      for (const call of calls) {
        const transcripts = await prisma.voiceTranscript.findMany({
          where: { callId: call.id },
          select: { id: true },
        });
        for (const tr of transcripts) {
          await prisma.voiceTranscriptSegment.deleteMany({ where: { transcriptId: tr.id } });
        }
        const t = await prisma.voiceTranscript.deleteMany({ where: { callId: call.id } });
        transcriptsDeleted += t.count;
      }
    }
  }

  return { conversationsDeleted, messagesDeleted, transcriptsDeleted };
}
