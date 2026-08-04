import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  LATENCY_PROFILES,
  ORDINARY_TURN_LATENCY_BANDS,
  applyLatencyProfileToConfig,
  getLatencyProfile,
  isLatencyProfileId,
  rollbackLatencyProfileConfig,
  type LatencyProfileId,
} from "@/lib/voice/latency-profiles";

type Ctx = { params: Promise<{ id: string }> };

function profileSummary(cfg: ReturnType<typeof parseVoiceAgentConfig>) {
  const active = cfg.voiceTiming?.activeProfile || "legacy_cascade";
  const def = getLatencyProfile(active);
  return {
    agentId: undefined as string | undefined,
    name: undefined as string | undefined,
    status: undefined as string | undefined,
    activeProfile: active,
    versionLabel: def.versionLabel,
    hasRollbackSnapshot: Boolean(cfg.voiceTiming?.rollbackSnapshot),
    transcription: cfg.transcription,
    endpointingMs: cfg.voiceLanguage?.endpointingMs,
    endpointingMsMapsTo:
      "interruption_settings.start_speaking_plan.wait_seconds only (not a separate Telnyx endpointing API)",
    bargeIn: cfg.voiceLanguage?.bargeIn,
    voiceId: cfg.voiceLanguage?.voiceId,
    modelId: cfg.model?.modelId,
    greeting: cfg.callHandling?.greeting,
    startSpeakingPlan: def.fields.startSpeakingPlan,
    telnyxFieldPlan: def.fields.telnyxFieldPlan || {},
    skipDynamicVariablesWebhook: Boolean(
      def.fields.skipDynamicVariablesWebhook,
    ),
    ordinaryTurnPrimaryGoalMs: ORDINARY_TURN_LATENCY_BANDS.primaryGoalMs,
    note: "Do not claim sub-500ms until real telephone measurements confirm it.",
  };
}

/**
 * Opt-in latency profile A/B/C for a single agent.
 * Does NOT auto-migrate other agents.
 *
 * POST { action: "apply", profileId: "legacy_cascade" | "flux_eager_low_latency" | "native_audio_ultravox" }
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
    const summary = profileSummary(cfg);
    return NextResponse.json({
      data: {
        ...summary,
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        availableProfiles: Object.values(LATENCY_PROFILES).map((p) => ({
          id: p.id,
          versionLabel: p.versionLabel,
          label: p.label,
          description: p.description,
        })),
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
        const { resolveLatencyProfileAlias } = await import(
          "@/lib/voice/latency-profiles"
        );
        const aliased = resolveLatencyProfileAlias(body.profileId);
        if (!aliased) {
          return NextResponse.json(
            {
              error:
                "profileId must be legacy_cascade, flux_b_fast, flux_b_balanced, flux_b_patient, flux_eager_low_latency, or native_audio_ultravox (aliases: A, B, B_FAST, B_BALANCED, B_PATIENT, C)",
            },
            { status: 400 },
          );
        }
        body.profileId = aliased;
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
    const summary = profileSummary(cfg);

    return NextResponse.json({
      data: {
        ...summary,
        agentId: id,
        name: refreshed?.name,
        status: refreshed?.status,
        action,
        telnyxAssistantId: refreshed?.telnyxAssistantId,
        deploy,
        telnyxSyncError:
          deploy && typeof deploy === "object" && "telnyxSyncError" in deploy
            ? (deploy as { telnyxSyncError?: string | null }).telnyxSyncError
            : null,
        ok: !(
          deploy &&
          typeof deploy === "object" &&
          (deploy as { telnyxSyncError?: string | null }).telnyxSyncError
        ),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
