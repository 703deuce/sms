import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { generateAiReplyText } from "@/lib/ai-replies/engine";
import type { CreateAiReplyInput } from "@/lib/ai-replies/service";
import {
  DEFAULT_AI_ADVANCED,
  parseAdvancedConfig,
  parseHandoffConfig,
  parseKnowledgeConfig,
  parseLeadConfig,
  parseTriggerConfig,
  type AiReplyRecord,
} from "@/lib/ai-replies/types";

function draftToRecord(workspaceId: string, body: CreateAiReplyInput): AiReplyRecord {
  return {
    id: "draft",
    workspaceId,
    name: body.name,
    description: body.description || null,
    replyType: body.replyType || "conversational",
    phoneNumberId: body.phoneNumberId || null,
    phoneNumberE164: null,
    status: "draft",
    tone: body.tone || "professional",
    responseLength: body.responseLength || "medium",
    systemPrompt: body.systemPrompt,
    trigger: parseTriggerConfig(body.trigger),
    knowledge: parseKnowledgeConfig(body.knowledge),
    lead: parseLeadConfig(body.lead),
    handoff: parseHandoffConfig(body.handoff),
    advanced: { ...DEFAULT_AI_ADVANCED, ...parseAdvancedConfig(body.advanced) },
    messagesSent: 0,
    contactsEngaged: 0,
    conversions: 0,
    handoffs: 0,
    lastTriggeredAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      draft?: CreateAiReplyInput;
      aiReplyId?: string;
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    let ai: AiReplyRecord | null = null;
    if (body.aiReplyId) {
      const { getAiReply } = await import("@/lib/ai-replies/service");
      ai = await getAiReply(auth.workspaceId, body.aiReplyId);
    } else if (body.draft) {
      ai = draftToRecord(auth.workspaceId, body.draft);
    }
    if (!ai) return NextResponse.json({ error: "AI reply config required" }, { status: 400 });

    const reply = await generateAiReplyText(ai, body.message, body.history || []);
    return NextResponse.json({
      data: {
        reply,
        debug: {
          knowledgeUsed: ai.knowledge.textSnippets?.slice(0, 2) || [],
        },
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
