import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { applyFlowToAgentDraft } from "@/lib/voice/flow/apply";
import { defaultFlowBundleForAgentType, VOICE_FLOW_TEMPLATES } from "@/lib/voice/flow/templates";
import { parseVoiceFlowBundle } from "@/lib/voice/flow/types";
import { validateVoiceFlowBundle } from "@/lib/voice/flow/validation";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
      select: { id: true, agentType: true, draftConfig: true },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    const flows =
      cfg.flows &&
      ((cfg.flows as { routing?: unknown }).routing ||
        (cfg.flows as { conversation?: unknown }).conversation)
        ? parseVoiceFlowBundle(cfg.flows)
        : defaultFlowBundleForAgentType(agent.agentType);
    const issues = validateVoiceFlowBundle(flows);
    return NextResponse.json({
      data: flows,
      issues,
      templates: VOICE_FLOW_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        agentLevel: t.agentLevel,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as {
      flows?: unknown;
      apply?: boolean;
      templateId?: string;
    };

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let bundle = body.flows
      ? parseVoiceFlowBundle(body.flows)
      : defaultFlowBundleForAgentType(agent.agentType);

    if (body.templateId) {
      const { getVoiceFlowTemplate } = await import("@/lib/voice/flow/templates");
      const t = getVoiceFlowTemplate(body.templateId);
      if (t) bundle = structuredClone(t.bundle);
    }

    const issues = validateVoiceFlowBundle(bundle);
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    const nextConfig = { ...cfg, flows: bundle };

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
      data: bundle,
      issues,
      applied: applied
        ? {
            enabledBuiltinTools: applied.compiled.enabledBuiltinTools,
            routingMode: applied.compiled.routingMode,
            humanFirstSeconds: applied.compiled.humanFirstSeconds,
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
