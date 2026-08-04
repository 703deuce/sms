import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  applyLatencyProfileToConfig,
  isLatencyProfileId,
  rollbackLatencyProfileConfig,
  type LatencyProfileId,
} from "@/lib/voice/latency-profiles";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Opt-in latency profile A/B for a single agent.
 * Does NOT auto-migrate other agents.
 *
 * POST { action: "apply", profileId: "flux_eager_low_latency" | "legacy_cascade" }
 * POST { action: "rollback" }
 * GET  → current profile + rollback availability
 */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true, name: true, draftConfig: true, status: true },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    return NextResponse.json({
      data: {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        activeProfile: cfg.voiceTiming?.activeProfile || "legacy_cascade",
        hasRollbackSnapshot: Boolean(cfg.voiceTiming?.rollbackSnapshot),
        transcription: cfg.transcription,
        endpointingMs: cfg.voiceLanguage?.endpointingMs,
        bargeIn: cfg.voiceLanguage?.bargeIn,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      profileId?: string;
      publish?: boolean;
    };
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const prev = parseVoiceAgentConfig(agent.draftConfig);
    let next = prev;
    const action = String(body.action || "").toLowerCase();

    if (action === "apply") {
      if (!isLatencyProfileId(body.profileId)) {
        return NextResponse.json(
          {
            error:
              "profileId must be legacy_cascade or flux_eager_low_latency",
          },
          { status: 400 },
        );
      }
      next = applyLatencyProfileToConfig(prev, body.profileId as LatencyProfileId);
    } else if (action === "rollback") {
      next = rollbackLatencyProfileConfig(prev);
    } else {
      return NextResponse.json(
        { error: "action must be apply or rollback" },
        { status: 400 },
      );
    }

    const { updateVoiceAgentDraft, publishVoiceAgent, buildVoiceAgentForTest } =
      await import("@/lib/voice/agent-service");

    await updateVoiceAgentDraft(auth.workspaceId!, id, { draftConfig: next });

    let deploy: unknown = null;
    if (body.publish !== false) {
      try {
        if (agent.phoneNumberId || String(agent.status).toUpperCase() === "ACTIVE") {
          deploy = await publishVoiceAgent(
            auth.workspaceId!,
            id,
            auth.session.userId,
          );
        } else {
          deploy = await buildVoiceAgentForTest(auth.workspaceId!, id);
        }
      } catch (err) {
        deploy = {
          error: err instanceof Error ? err.message : "deploy failed",
        };
      }
    }

    const refreshed = await prisma.voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        draftConfig: true,
        telnyxAssistantId: true,
      },
    });
    const cfg = parseVoiceAgentConfig(refreshed?.draftConfig);

    return NextResponse.json({
      data: {
        agentId: id,
        action,
        activeProfile: cfg.voiceTiming?.activeProfile,
        hasRollbackSnapshot: Boolean(cfg.voiceTiming?.rollbackSnapshot),
        transcription: cfg.transcription,
        endpointingMs: cfg.voiceLanguage?.endpointingMs,
        bargeIn: cfg.voiceLanguage?.bargeIn,
        telnyxAssistantId: refreshed?.telnyxAssistantId,
        deploy,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
