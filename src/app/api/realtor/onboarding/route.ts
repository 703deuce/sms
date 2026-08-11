import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadRealtorProductConfig,
  onboardingStepsForMode,
  saveRealtorProductConfig,
} from "@/lib/realtor/workspace-config";
import { deployRealEstateFrontDesk } from "@/lib/voice/real-estate/bootstrap";
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
    const deploy = await deployRealEstateFrontDesk({
      workspaceId: auth.workspaceId,
      phoneE164: current.phone.outboundNumberE164,
      agentName: current.business.teamName
        ? `${current.business.teamName} Front Desk`
        : undefined,
      amyMode: current.amyMode,
      useRecommendedFollowUp: current.speedToLead.useRecommendedFollowUp,
    });
    const next = await saveRealtorProductConfig(auth.workspaceId, {
      ...current,
      ...(body.config as typeof current),
      enabled: true,
      onboardingComplete: true,
      live: true,
      currentStep: "go_live",
      deployedAgentId: deploy.agent.agentId,
      deployedOutboundAgentId: deploy.speedToLead?.outboundAgentId || current.deployedOutboundAgentId,
      followUpAutomationId: deploy.speedToLead?.followUpAutomationId || current.followUpAutomationId,
      deployedAt: new Date().toISOString(),
    });
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
    const saved = await saveRealtorProductConfig(auth.workspaceId, merged);
    return NextResponse.json({ config: saved, steps: onboardingStepsForMode(saved.amyMode) });
  } catch (err) {
    return jsonError(err, 500);
  }
}
