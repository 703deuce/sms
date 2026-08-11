import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadRealtorProductConfig,
  onboardingStepsForConfig,
  saveRealtorProductConfig,
  STEP_LABELS,
} from "@/lib/realtor/workspace-config";
import { deployRealEstateFrontDesk } from "@/lib/voice/real-estate/bootstrap";
import { compileRealtorAgents, validateRealtorProductConfig } from "@/lib/voice/real-estate/compile";
import { NextResponse } from "next/server";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeBodyConfig(
  current: Awaited<ReturnType<typeof loadRealtorProductConfig>>,
  body: Record<string, unknown>,
) {
  return {
    ...current,
    ...(body as typeof current),
    identity: { ...current.identity, ...asRecord(body.identity) },
    voice: { ...current.voice, ...asRecord(body.voice) },
    knowledge: { ...current.knowledge, ...asRecord(body.knowledge) },
    notifications: { ...current.notifications, ...asRecord(body.notifications) },
    business: { ...current.business, ...asRecord(body.business) },
    phone: { ...current.phone, ...asRecord(body.phone) },
    frontDesk: { ...current.frontDesk, ...(body.frontDesk as object) },
    speedToLead: { ...current.speedToLead, ...(body.speedToLead as object) },
  };
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const config = await loadRealtorProductConfig(auth.workspaceId);
    return NextResponse.json({
      config,
      steps: onboardingStepsForConfig(config),
      stepLabels: STEP_LABELS,
      compiled: compileRealtorAgents(config),
      validation: validateRealtorProductConfig(config),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await req.json()) as { config?: Record<string, unknown>; action?: string };

    if (body.action === "go_live") {
      const current = await loadRealtorProductConfig(auth.workspaceId);
      const merged = mergeBodyConfig(current, body.config || {});
      const validation = validateRealtorProductConfig(merged);
      if (!validation.ok) {
        return NextResponse.json({ error: "Configuration invalid", validation }, { status: 400 });
      }
      const deploy = await deployRealEstateFrontDesk({
        workspaceId: auth.workspaceId,
        productConfig: merged,
        phoneE164: merged.phone.outboundNumberE164,
        agentName: merged.business.teamName
          ? `${merged.business.teamName} Front Desk`
          : undefined,
        amyMode: merged.amyMode,
        useRecommendedFollowUp: merged.speedToLead.useRecommendedFollowUp,
      });
      const next = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        enabled: true,
        onboardingComplete: true,
        live: true,
        status: "active",
        currentStep: "go_live",
        compiledVersion: deploy.compiled?.compiledVersion ?? merged.compiledVersion,
        deployedAgentId: deploy.agent?.agentId || merged.deployedAgentId,
        deployedOutboundAgentId: deploy.speedToLead?.outboundAgentId || merged.deployedOutboundAgentId,
        frontDeskTemplateAgentId: deploy.agent?.templateAgentId || merged.frontDeskTemplateAgentId,
        outboundTemplateAgentId:
          deploy.speedToLead?.outboundTemplateAgentId || merged.outboundTemplateAgentId,
        frontDeskPublishedVersionId:
          deploy.agent?.publishedVersionId || merged.frontDeskPublishedVersionId,
        outboundPublishedVersionId:
          deploy.speedToLead?.publishedVersionId || merged.outboundPublishedVersionId,
        followUpAutomationId: deploy.speedToLead?.followUpAutomationId || merged.followUpAutomationId,
        deployedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      });
      const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
      await bootstrapRealtorVerification();
      return NextResponse.json({ config: next, deploy, compiled: deploy.compiled });
    }

    if (body.action === "save_draft") {
      const current = await loadRealtorProductConfig(auth.workspaceId);
      const merged = mergeBodyConfig(current, body.config || {});
      const saved = await saveRealtorProductConfig(auth.workspaceId, {
        ...merged,
        status: "draft",
        draftSavedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        config: saved,
        steps: onboardingStepsForConfig(saved),
        validation: validateRealtorProductConfig(saved),
      });
    }

    const current = await loadRealtorProductConfig(auth.workspaceId);
    const merged = mergeBodyConfig(current, body.config || {});
    const saved = await saveRealtorProductConfig(auth.workspaceId, {
      ...merged,
      enabled: true,
      compiledVersion: compileRealtorAgents(merged).compiledVersion,
    });
    return NextResponse.json({
      config: saved,
      steps: onboardingStepsForConfig(saved),
      validation: validateRealtorProductConfig(saved),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
