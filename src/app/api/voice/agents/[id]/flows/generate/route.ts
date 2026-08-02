import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { applyFlowToAgentDraft } from "@/lib/voice/flow/apply";
import { generateVoiceFlowFromNaturalLanguage } from "@/lib/voice/flow/generate-from-nl";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as {
      prompt?: string;
      apply?: boolean;
    };
    const prompt = String(body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const generated = await generateVoiceFlowFromNaturalLanguage(prompt);
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    const nextConfig = { ...cfg, flows: generated.bundle };

    await getPrisma().voiceAgent.update({
      where: { id: agentId },
      data: { draftConfig: nextConfig as object },
    });

    let applied = null;
    if (body.apply) {
      applied = await applyFlowToAgentDraft({
        workspaceId: auth.workspaceId,
        agentId,
        agentType: agent.agentType,
        draftConfig: nextConfig,
        strict: false,
      });
    }

    return NextResponse.json({
      data: generated.bundle,
      templateId: generated.templateId,
      mode: generated.mode,
      provider: generated.provider,
      model: generated.model,
      summary: generated.summary,
      issues: generated.issues,
      applied: applied
        ? {
            enabledBuiltinTools: applied.compiled.enabledBuiltinTools,
            routingMode: applied.compiled.routingMode,
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
