import { getPrisma } from "@/lib/db";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadRealtorProductConfig,
  saveRealtorProductConfig,
} from "@/lib/realtor/workspace-config";
import { deployRealEstateFrontDesk } from "@/lib/voice/real-estate/bootstrap";
import { compileRealtorAgents, validateRealtorProductConfig } from "@/lib/voice/real-estate/compile";
import { NextResponse } from "next/server";

function resolveFrontDeskPhoneE164(config: {
  phone: { inboundNumberE164?: string; outboundNumberE164?: string };
}): string | undefined {
  return config.phone.inboundNumberE164?.trim() || config.phone.outboundNumberE164?.trim() || undefined;
}

function mergeConfig(
  current: Awaited<ReturnType<typeof loadRealtorProductConfig>>,
  body: Record<string, unknown>,
) {
  return {
    ...current,
    ...(body as typeof current),
    business: { ...current.business, ...(body.business as object) },
    phone: { ...current.phone, ...(body.phone as object) },
    frontDesk: { ...current.frontDesk, ...(body.frontDesk as object) },
    speedToLead: { ...current.speedToLead, ...(body.speedToLead as object) },
    identity: { ...current.identity, ...(body.identity as object) },
    voice: { ...current.voice, ...(body.voice as object) },
    knowledge: { ...current.knowledge, ...(body.knowledge as object) },
    notifications: { ...current.notifications, ...(body.notifications as object) },
    instructions: { ...current.instructions, ...(body.instructions as object) },
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const config = await loadRealtorProductConfig(auth.workspaceId);
    const compiled = compileRealtorAgents(config, { status: config.status });
    const prisma = getPrisma();
    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { e164: "asc" },
      select: { id: true, e164: true, friendlyName: true, status: true },
    });
    const url = new URL(req.url);
    const target = url.searchParams.get("target");
    return NextResponse.json({
      config,
      compiled,
      validation: validateRealtorProductConfig(config),
      phoneNumbers,
      workflow:
        target === "speed_to_lead"
          ? compiled.speedToLead?.workflowDefinition
          : compiled.frontDesk?.workflowDefinition,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await req.json()) as {
      action?: string;
      config?: Record<string, unknown>;
    };
    const current = await loadRealtorProductConfig(auth.workspaceId);
    const merged = body.config ? mergeConfig(current, body.config) : current;

    if (body.action === "save_draft") {
      const saved = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        status: "draft",
        draftSavedAt: new Date().toISOString(),
        compiledVersion: compileRealtorAgents(merged).compiledVersion,
      });
      return NextResponse.json({ config: saved, validation: validateRealtorProductConfig(saved) });
    }

    if (body.action === "set_testing") {
      const saved = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        status: "testing",
      });
      return NextResponse.json({ config: saved });
    }

    if (body.action === "pause") {
      const saved = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        status: "paused",
        live: false,
      });
      return NextResponse.json({ config: saved });
    }

    if (body.action === "publish" || body.action === "go_live") {
      const validation = validateRealtorProductConfig(merged);
      if (!validation.ok) {
        return NextResponse.json({ error: "Configuration invalid", validation }, { status: 400 });
      }
      const deploy = await deployRealEstateFrontDesk({
        workspaceId: auth.workspaceId,
        productConfig: merged,
        phoneE164: resolveFrontDeskPhoneE164(merged),
        agentName: merged.business.teamName
          ? `${merged.business.teamName} Front Desk`
          : undefined,
        amyMode: merged.amyMode,
        useRecommendedFollowUp: merged.speedToLead.useRecommendedFollowUp,
      });
      const saved = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        status: "active",
        live: body.action === "go_live" ? true : merged.live,
        onboardingComplete: body.action === "go_live" ? true : merged.onboardingComplete,
        compiledVersion: deploy.compiled?.compiledVersion ?? merged.compiledVersion,
        deployedAgentId: deploy.agent?.agentId || merged.deployedAgentId,
        deployedOutboundAgentId: deploy.speedToLead?.outboundAgentId || merged.deployedOutboundAgentId,
        frontDeskPublishedVersionId:
          deploy.agent?.publishedVersionId || merged.frontDeskPublishedVersionId,
        outboundPublishedVersionId:
          deploy.speedToLead?.publishedVersionId || merged.outboundPublishedVersionId,
        followUpAutomationId: deploy.speedToLead?.followUpAutomationId || merged.followUpAutomationId,
        publishedAt: new Date().toISOString(),
        deployedAt: new Date().toISOString(),
      });
      return NextResponse.json({ config: saved, deploy, compiled: deploy.compiled });
    }

    const saved = await saveRealtorProductConfig(auth.workspaceId, merged);
    return NextResponse.json({ config: saved, validation: validateRealtorProductConfig(saved) });
  } catch (err) {
    return jsonError(err, 500);
  }
}
