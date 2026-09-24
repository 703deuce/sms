import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { QualificationDefinition } from "./types";
import {
  OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
  getOutboundQualificationFromConfig,
  isOutboundLeadQualificationStackProfile,
} from "./agent-config";
import { normalizeRealtimeNativeVoice } from "./realtime-native-voices";

const DEFAULT_FIXTURE_PATH = path.join(
  process.cwd(),
  "scripts/fixtures/blue-ridge-realty-qualification.json",
);

export type EnsureOutboundRealtimeCloneResult = {
  agentId: string;
  agentName: string;
  sourceAgentId: string;
  created: boolean;
  callerIdE164: string | null;
  realtimeModel: string;
  realtimeVoice: string;
};

export type EnsureOutboundRealtimeCloneInput = {
  workspaceId?: string;
  sourceAgentId?: string;
  sourceAgentName?: string;
  cloneAgentName?: string;
  realtimeModel?: string;
  realtimeVoice?: string;
  /** When true, also set clone.phoneNumberId (default: share outbound caller ID via join only). */
  assignPrimaryPhone?: boolean;
  phoneE164?: string;
};

function fixtureFallbackAllowed(): boolean {
  return (
    process.env.ALLOW_OUTBOUND_FIXTURE_FALLBACK === "1" ||
    process.env.NODE_ENV === "development"
  );
}

function loadFixtureQualification(): QualificationDefinition | null {
  if (!fixtureFallbackAllowed() || !fs.existsSync(DEFAULT_FIXTURE_PATH)) return null;
  return JSON.parse(fs.readFileSync(DEFAULT_FIXTURE_PATH, "utf8")) as QualificationDefinition;
}

function resolveRealtimeModel(input?: string): string {
  return (
    input?.trim() ||
    process.env.VOICE_REALTIME_MODEL?.trim() ||
    process.env.REALTIME_MODEL?.trim() ||
    "gpt-realtime-2.1-mini"
  );
}

function resolveRealtimeVoice(input?: string): string {
  const raw = input?.trim() || process.env.VOICE_REALTIME_VOICE?.trim() || "marin";
  return normalizeRealtimeNativeVoice(raw, "realtimeVoice");
}

async function resolveSourceOutboundPhone(input: {
  workspaceId: string;
  sourceAgentId: string;
}): Promise<{ id: string; e164: string } | null> {
  const prisma = getPrisma();

  const join = await prisma.voiceAgentPhoneNumber.findFirst({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.sourceAgentId,
      outboundEnabled: true,
    },
    orderBy: { isDefault: "desc" },
    select: { phoneNumberId: true },
  });

  const phoneNumberId =
    join?.phoneNumberId ||
    (
      await prisma.voiceAgent.findFirst({
        where: { id: input.sourceAgentId, workspaceId: input.workspaceId },
        select: { phoneNumberId: true },
      })
    )?.phoneNumberId;

  if (!phoneNumberId) return null;

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true },
  });
  if (!phone?.e164) return null;
  return { id: phone.id, e164: phone.e164 };
}

/**
 * Idempotently create or refresh the OpenAI Realtime outbound qualification clone.
 * Copies qualification config from the stack agent; never mutates the source agent.
 */
export async function ensureOutboundRealtimeCloneAgent(
  input: EnsureOutboundRealtimeCloneInput = {},
): Promise<EnsureOutboundRealtimeCloneResult> {
  const { requireExplicitWorkspaceId } = await import("@/lib/workspace/require-explicit-workspace-id");
  const workspaceId = requireExplicitWorkspaceId(input.workspaceId, {
    label: "ensureOutboundRealtimeCloneAgent",
  });
  const sourceAgentId = input.sourceAgentId?.trim() || process.env.SOURCE_AGENT_ID?.trim();
  const sourceAgentName =
    input.sourceAgentName?.trim() ||
    process.env.SOURCE_AGENT_NAME?.trim() ||
    "Outbound Lead Qualification (Demo)";
  const cloneAgentName =
    input.cloneAgentName?.trim() ||
    process.env.CLONE_AGENT_NAME?.trim() ||
    "Outbound Lead Qualification (Realtime Test)";
  const realtimeModel = resolveRealtimeModel(input.realtimeModel);
  const realtimeVoice = resolveRealtimeVoice(input.realtimeVoice);
  const assignPrimaryPhone =
    input.assignPrimaryPhone ?? process.env.ASSIGN_PHONE === "1";
  const phoneE164 = (input.phoneE164 || process.env.PHONE_E164 || "+18663464256").trim();

  const prisma = getPrisma();

  let resolvedSource = sourceAgentId
    ? await prisma.voiceAgent.findFirst({ where: { id: sourceAgentId, workspaceId } })
    : await prisma.voiceAgent.findFirst({
        where: { workspaceId, name: sourceAgentName },
      });

  if (!resolvedSource) {
    const stackByProfile = await prisma.voiceAgent.findMany({
      where: { workspaceId },
      select: { id: true, draftConfig: true, name: true, agentType: true },
    });
    resolvedSource =
      stackByProfile.find(
        (row: (typeof stackByProfile)[number]) =>
          isOutboundLeadQualificationStackProfile(parseVoiceAgentConfig(row.draftConfig)),
      ) ?? null;
  }

  if (!resolvedSource) {
    throw new Error(
      `Source outbound agent not found in ${workspaceId} — expected "${sourceAgentName}" or outbound_lead_qualification profile`,
    );
  }

  const sourceConfig = parseVoiceAgentConfig(resolvedSource.draftConfig);
  const qualification =
    getOutboundQualificationFromConfig(sourceConfig) || loadFixtureQualification();
  if (!qualification) {
    throw new Error(
      "Source agent has no outboundQualification config and fixture fallback is unavailable",
    );
  }

  const draftConfig = {
    ...sourceConfig,
    advanced: {
      ...(sourceConfig.advanced || {}),
      livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
      outboundQualification: qualification,
      realtimeModel,
      realtimeVoice,
    },
    dynamicVariables: {
      ...(sourceConfig.dynamicVariables || {}),
      business_name: qualification.businessName,
    },
  };

  const sourcePhone = await resolveSourceOutboundPhone({
    workspaceId,
    sourceAgentId: resolvedSource.id,
  });

  let phoneNumberId: string | null = null;
  if (assignPrimaryPhone) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: phoneE164 },
      select: { id: true, e164: true },
    });
    if (!phone) {
      throw new Error(`Phone ${phoneE164} not found in ${workspaceId}`);
    }
    phoneNumberId = phone.id;
  }

  let created = false;
  let clone = await prisma.voiceAgent.findFirst({
    where: { workspaceId, name: cloneAgentName },
  });

  if (clone) {
    clone = await prisma.voiceAgent.update({
      where: { id: clone.id },
      data: {
        draftConfig: draftConfig as object,
        outboundAiEnabled: true,
        status: "TESTING",
        directions: ["outbound"],
        ...(phoneNumberId ? { phoneNumberId } : {}),
      },
    });
  } else {
    created = true;
    clone = await prisma.voiceAgent.create({
      data: {
        workspaceId,
        name: cloneAgentName,
        description:
          "OpenAI Realtime clone of outbound lead qualification — same workflow, speech-to-speech pipeline",
        agentType: resolvedSource.agentType || "custom",
        status: "TESTING",
        outboundAiEnabled: true,
        directions: ["outbound"],
        ...(phoneNumberId ? { phoneNumberId } : {}),
        draftConfig: draftConfig as object,
      },
    });
  }

  let outboundPhone: { id: string; e164: string } | null = null;
  if (phoneNumberId) {
    outboundPhone = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId },
      select: { id: true, e164: true },
    });
  } else {
    outboundPhone = sourcePhone;
  }

  if (!outboundPhone) {
    const fallbackPhone = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: phoneE164 },
      select: { id: true, e164: true },
    });
    if (fallbackPhone) outboundPhone = fallbackPhone;
  }

  if (!outboundPhone) {
    throw new Error(
      `No outbound caller ID found for realtime clone in ${workspaceId} — assign a phone to the stack agent or set PHONE_E164`,
    );
  }

  await prisma.voiceAgentPhoneNumber.upsert({
    where: {
      agentId_phoneNumberId: { agentId: clone.id, phoneNumberId: outboundPhone.id },
    },
    create: {
      workspaceId,
      agentId: clone.id,
      phoneNumberId: outboundPhone.id,
      inboundEnabled: false,
      outboundEnabled: true,
      isDefault: true,
    },
    update: {
      inboundEnabled: false,
      outboundEnabled: true,
      isDefault: true,
    },
  });

  return {
    agentId: clone.id,
    agentName: clone.name,
    sourceAgentId: resolvedSource.id,
    created,
    callerIdE164: outboundPhone.e164,
    realtimeModel,
    realtimeVoice,
  };
}
