import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadRealtorProductConfig,
  onboardingStepsForMode,
  saveRealtorProductConfig,
} from "@/lib/realtor/workspace-config";
import { deployRealEstateFrontDesk } from "@/lib/voice/real-estate/bootstrap";
import { compileRealtorAgents, validateRealtorProductConfig } from "@/lib/voice/real-estate/compile";
import { NextResponse } from "next/server";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const config = await loadRealtorProductConfig(auth.workspaceId);
    return NextResponse.json({ config, steps: onboardingStepsForMode(config.amyMode) });
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
    const merged = {
      ...current,
      ...(body.config as typeof current),
    };
    const validation = validateRealtorProductConfig(merged);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Configuration invalid", validation },
        { status: 400 },
      );
    }
    const deploy = await deployRealEstateFrontDesk({
      workspaceId: auth.workspaceId,
      phoneE164: merged.phone.outboundNumberE164,
      agentName: merged.business.teamName
        ? `${merged.business.teamName} Front Desk`
        : undefined,
      amyMode: merged.amyMode,
      useRecommendedFollowUp: merged.speedToLead.useRecommendedFollowUp,
      productConfig: merged,
    });
    const next = await saveRealtorProductConfig(auth.workspaceId, {
      ...merged,
      enabled: true,
      onboardingComplete: true,
      live: true,
      status: "active",
      compiledVersion: deploy.compiled?.compiledVersion ?? merged.compiledVersion,
      currentStep: "go_live",
      deployedAgentId: deploy.agent?.agentId || merged.deployedAgentId,
      deployedOutboundAgentId: deploy.speedToLead?.outboundAgentId || merged.deployedOutboundAgentId,
      frontDeskTemplateAgentId: deploy.agent?.templateAgentId || merged.frontDeskTemplateAgentId,
      outboundTemplateAgentId:
        deploy.speedToLead?.outboundTemplateAgentId || merged.outboundTemplateAgentId,
      followUpAutomationId: deploy.speedToLead?.followUpAutomationId || merged.followUpAutomationId,
      deployedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    });
    const { bootstrapRealtorVerification } = await import("@/lib/realtor/boot-verification");
    await bootstrapRealtorVerification();
    return NextResponse.json({ config: next, deploy });
  }

    const current = await loadRealtorProductConfig(auth.workspaceId);
    const merged = {
      ...current,
      ...(body.config || {}),
      enabled: true,
      business: { ...current.business, ...asRecord(body.config?.business) },
      phone: { ...current.phone, ...asRecord(body.config?.phone) },
      frontDesk: { ...current.frontDesk, ...(body.config?.frontDesk as object) },
      speedToLead: { ...current.speedToLead, ...(body.config?.speedToLead as object) },
    };
    const saved = await saveRealtorProductConfig(auth.workspaceId, {
      ...merged,
      enabled: true,
      compiledVersion: compileRealtorAgents(merged).compiledVersion,
    });
    return NextResponse.json({
      config: saved,
      steps: onboardingStepsForMode(saved.amyMode),
      validation: validateRealtorProductConfig(saved),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
