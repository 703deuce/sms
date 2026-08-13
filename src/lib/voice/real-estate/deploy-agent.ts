import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { assignNumberToAgent } from "@/lib/telephony/provisioning";
import { ensureAgentPrimaryWorkflow } from "@/lib/agents/compile-workflow";
import { parseVoiceAgentConfig, DEFAULT_VOICE_CONFIG } from "@/lib/voice/types";
import { publishVoiceAgentVersion } from "./publish";
import {
  FRONTDESK_REALTIME_PROFILE,
  isFrontDeskProfile,
} from "@/lib/voice/frontdesk/agent-config";
import type { RealtorProductConfig } from "@/lib/realtor/types";
import {
  compileFrontDeskFromProductConfig,
  compileRealtorAgents,
} from "./compile";
import {
  resolveFrontDeskTemplateAgent,
  REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME,
} from "./agent-templates";

export type EnsureRealEstateFrontDeskAgentInput = {
  workspaceId?: string;
  phoneE164?: string;
  agentName?: string;
  assignPhone?: boolean;
  productConfig?: RealtorProductConfig;
  publish?: boolean;
};

export type EnsureRealEstateFrontDeskAgentResult = {
  ok: boolean;
  agentId: string;
  agentName: string;
  phoneE164: string | null;
  created: boolean;
  upgraded: boolean;
  templateAgentId?: string;
  templateAgentName?: string;
  primaryFlowId?: string;
  configVersion?: number;
  publishedVersionId?: string;
};

function resolvePhoneE164(input?: string): string {
  const phone = input?.trim();
  if (!phone) {
    throw new Error(
      "Inbound phone number (E.164) is required — select a number on the Front Desk Phone tab before publishing.",
    );
  }
  return phone;
}

async function syncFrontDeskTransferDestination(
  workspaceId: string,
  agentId: string,
  transferNumber?: string,
): Promise<void> {
  const destination = transferNumber?.trim();
  if (!destination) return;
  const prisma = getPrisma();
  const name = "Front Desk Transfer";
  const existing = await prisma.voiceTransferDestination.findFirst({
    where: { workspaceId, agentId, name },
  });
  const data = {
    kind: "phone",
    destination,
    enabled: true,
  };
  if (existing) {
    await prisma.voiceTransferDestination.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.voiceTransferDestination.create({
    data: { workspaceId, agentId, name, ...data },
  });
}

function resolveAgentName(input?: string, compiledName?: string): string {
  return (
    input?.trim() ||
    compiledName ||
    process.env.RE_FRONTDESK_AGENT_NAME?.trim() ||
    REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME
  ).trim();
}

export function buildRealEstateDraftConfig(
  existing = DEFAULT_VOICE_CONFIG,
  input: {
    agentName: string;
    compiled: ReturnType<typeof compileFrontDeskFromProductConfig>;
  },
) {
  const { compiled } = input;
  const business = compiled.business;
  return {
    ...existing,
    identity: {
      ...(existing.identity || {}),
      displayName: input.agentName,
      businessLocation: business.businessName,
    },
    dynamicVariables: {
      ...(existing.dynamicVariables || {}),
      business_name: business.businessName,
      agent_name: compiled.identity.agentName,
      service_areas: business.serviceAreas,
      property_types: business.propertyTypes,
      knowledge_notes: business.knowledgeNotes,
      authority_boundaries: business.authorityBoundaries,
      custom_instructions: compiled.instructions?.custom || "",
    },
    advanced: {
      ...(existing.advanced || {}),
      livekitProfile: FRONTDESK_REALTIME_PROFILE,
      realEstateFrontDesk: true,
      vertical: "real_estate",
      templateKey: compiled.templateKey,
      templateVersion: compiled.templateVersion,
      configVersion: compiled.configVersion,
      realEstateCompiled: compiled,
      realtimeModel: compiled.voice.model,
      realtimeVoice: compiled.voice.voice,
    },
    messaging: {
      ...(existing.messaging || {}),
      smsConfirmations: existing.messaging?.smsConfirmations !== false,
    },
  };
}

/**
 * Idempotently create or upgrade the inbound Real Estate Front Desk voice agent.
 * Compiles structured customer configuration — never a giant custom prompt.
 */
export async function ensureRealEstateFrontDeskAgent(
  input: EnsureRealEstateFrontDeskAgentInput = {},
): Promise<EnsureRealEstateFrontDeskAgentResult> {
  const prisma = getPrisma();
  const workspaceId = input.workspaceId?.trim() || process.env.WORKSPACE_ID?.trim() || "ws_1";
  const phoneE164 = resolvePhoneE164(input.phoneE164);
  const assignPhone = input.assignPhone !== false;

  const productConfig = input.productConfig;
  if (!productConfig) {
    throw new Error("productConfig is required — deploy via compile layer, not hardcoded defaults.");
  }

  const compiledBundle = compileRealtorAgents(productConfig, {
    status: input.publish ? "active" : productConfig.status,
  });
  if (!compiledBundle.frontDesk) {
    throw new Error("Front Desk template not enabled for this amyMode.");
  }
  const compiled = compiledBundle.frontDesk;
  const agentName = resolveAgentName(input.agentName, compiled.identity.agentName);

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: phoneE164 },
    select: { id: true, e164: true },
  });
  if (!phone && assignPhone) {
    throw new Error(`Phone number ${phoneE164} not found in workspace ${workspaceId}`);
  }

  const template = await resolveFrontDeskTemplateAgent(workspaceId);

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, name: true, draftConfig: true, primaryFlowId: true },
  });

  const existingRe = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    const advanced = cfg.advanced as Record<string, unknown> | undefined;
    return isFrontDeskProfile(advanced) && advanced?.realEstateFrontDesk === true;
  });

  let agentId = existingRe?.id;
  let existingCfg = existingRe ? parseVoiceAgentConfig(existingRe.draftConfig) : undefined;
  let created = false;
  let templateAgentId = template?.agentId;
  let templateAgentName = template?.agentName;
  let existingFlowId = existingRe?.primaryFlowId || null;

  if (!existingCfg && template) {
    existingCfg = template.draftConfig;
  }

  if (!agentId) {
    const frontdeskFallback = agents.find((row: (typeof agents)[number]) => {
      const cfg = parseVoiceAgentConfig(row.draftConfig);
      return isFrontDeskProfile(cfg.advanced as Record<string, unknown>);
    });
    agentId = frontdeskFallback?.id;
    if (!existingCfg && frontdeskFallback) {
      existingCfg = parseVoiceAgentConfig(frontdeskFallback.draftConfig);
      templateAgentId = templateAgentId || frontdeskFallback.id;
      templateAgentName = templateAgentName || frontdeskFallback.name;
      existingFlowId = frontdeskFallback.primaryFlowId || null;
    }
  }

  const draftConfig = buildRealEstateDraftConfig(existingCfg || DEFAULT_VOICE_CONFIG, {
    agentName,
    compiled,
  });

  if (agentId) {
    await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        name: agentName,
        displayName: agentName,
        status: "ACTIVE",
        agentType: "appointment_booking",
        purpose: "appointment_receptionist",
        draftConfig: draftConfig as object,
      },
    });
  } else {
    const createdRow = await prisma.voiceAgent.create({
      data: {
        id: createId(),
        workspaceId,
        name: agentName,
        displayName: agentName,
        purpose: "appointment_receptionist",
        agentType: "appointment_booking",
        status: "ACTIVE",
        draftConfig: draftConfig as object,
      },
      select: { id: true },
    });
    agentId = createdRow.id;
    created = true;
  }

  await syncFrontDeskTransferDestination(
    workspaceId,
    agentId,
    productConfig.phone.transferNumber,
  );

  if (assignPhone && phone) {
    const { shouldSkipInboundPhoneReassignment } = await import("@/lib/voice/phone-reassignment-guard");
    const phoneGuard = await shouldSkipInboundPhoneReassignment({
      workspaceId,
      phoneE164: phone.e164,
      requestingAgentId: agentId,
    });
    if (phoneGuard.skip) {
      console.warn(
        `[re-frontdesk] skipping phone assignment on ${phone.e164} — ` +
          `${phoneGuard.reason} (${phoneGuard.ownerAgentName || phoneGuard.ownerAgentId})`,
      );
    } else {
      await assignNumberToAgent({
        workspaceId,
        phoneNumberId: phone.id,
        agentId,
        exclusive: true,
      });
    }
  }

  const workflow = await ensureAgentPrimaryWorkflow({
    // Automation/workflow UI bundle — not the LiveKit voice turn executor.
    // Voice runtime uses AgentSession + compiled policy (intents/fields) + tools.
    workspaceId,
    agentId,
    agentName,
    existingFlowId,
    outcomeSlug: "appointment-booking",
    phoneNumberId: phone?.id || null,
    phoneNumberE164: phone?.e164 || phoneE164,
    includeBookingBranches: compiled.booking.enabled,
    includeSmsConfirmation: compiled.booking.enabled,
    purpose: agentName,
    activate: input.publish === true,
  });

  let publishedVersionId: string | undefined;

  if (input.publish) {
    const published = await publishVoiceAgentVersion({
      workspaceId,
      agentId,
      config: draftConfig,
      changeLog: `Published real_estate_front_desk v${compiled.configVersion}`,
    });
    publishedVersionId = published.versionId;
  }

  return {
    ok: true,
    agentId,
    agentName,
    phoneE164: phone?.e164 || phoneE164,
    created,
    upgraded: !created,
    templateAgentId,
    templateAgentName,
    primaryFlowId: workflow.flowId,
    configVersion: compiled.configVersion,
    publishedVersionId,
  };
}
