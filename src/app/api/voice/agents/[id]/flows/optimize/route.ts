import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { applyFlowToAgentDraft } from "@/lib/voice/flow/apply";
import { optimizeVoiceFlowFromCallResults } from "@/lib/voice/flow/auto-optimize";
import { defaultFlowBundleForAgentType } from "@/lib/voice/flow/templates";
import { parseVoiceFlowBundle } from "@/lib/voice/flow/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      apply?: boolean;
      lookbackDays?: number;
      compile?: boolean;
    };

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    const current =
      cfg.flows &&
      ((cfg.flows as { routing?: unknown }).routing ||
        (cfg.flows as { conversation?: unknown }).conversation)
        ? parseVoiceFlowBundle(cfg.flows)
        : defaultFlowBundleForAgentType(agent.agentType);

    const result = await optimizeVoiceFlowFromCallResults({
      workspaceId: auth.workspaceId,
      agentId,
      currentBundle: current,
      lookbackDays: body.lookbackDays,
      apply: body.apply !== false,
    });

    if (body.apply !== false && result.appliedCount > 0) {
      const nextConfig = { ...cfg, flows: result.bundle };
      await getPrisma().voiceAgent.update({
        where: { id: agentId },
        data: { draftConfig: nextConfig as object },
      });
      if (body.compile) {
        await applyFlowToAgentDraft({
          workspaceId: auth.workspaceId,
          agentId,
          agentType: agent.agentType,
          draftConfig: nextConfig,
          strict: false,
        });
      }
    }

    return NextResponse.json({
      data: result.bundle,
      suggestions: result.suggestions,
      appliedCount: result.appliedCount,
      stats: result.stats,
      mode: result.mode,
      provider: result.provider,
      model: result.model,
      issues: result.issues,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
