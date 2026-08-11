import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { livekitProfileFromConfig } from "@/lib/voice/frontdesk/agent-config";
import type { RoomMetadata } from "./metadata";

export type ExplicitDispatchMetadata = RoomMetadata & {
  livekitProfile?: string;
  publishedVersionId?: string;
  dispatchSource?: "phone_provision" | "sip_metadata" | "job_metadata" | "did_lookup";
};

export function buildExplicitDispatchMetadata(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  livekitProfile?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
  dispatchSource: ExplicitDispatchMetadata["dispatchSource"];
}): ExplicitDispatchMetadata {
  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId || undefined,
    livekitProfile: input.livekitProfile || undefined,
    fromE164: input.fromE164 || undefined,
    toE164: input.toE164 || undefined,
    dispatchSource: input.dispatchSource,
  };
}

export async function loadExplicitDispatchForDid(
  toE164: string | undefined | null,
): Promise<ExplicitDispatchMetadata | null> {
  if (!toE164?.trim()) return null;
  const prisma = getPrisma();
  const digits = toE164.replace(/\D/g, "");
  const phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [
        { e164: toE164.trim() },
        ...(digits ? [{ e164: { endsWith: digits.slice(-10) } }] : []),
      ],
    },
    select: { e164: true, workspaceId: true, settingsJson: true },
  });
  if (!phone) return null;

  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object"
      ? (phone.settingsJson as Record<string, unknown>)
      : {};
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? (settings.telephony as Record<string, unknown>)
      : {};
  const stored = telephony.explicitDispatch;
  if (stored && typeof stored === "object") {
    const row = stored as Record<string, unknown>;
    if (row.workspaceId && row.agentId) {
      return {
        workspaceId: String(row.workspaceId),
        agentId: String(row.agentId),
        publishedVersionId: row.publishedVersionId
          ? String(row.publishedVersionId)
          : undefined,
        livekitProfile: row.livekitProfile ? String(row.livekitProfile) : undefined,
        toE164: phone.e164,
        dispatchSource: "phone_provision",
      };
    }
  }

  const assignment = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      status: "ACTIVE",
    },
    select: { id: true, publishedVersionId: true, draftConfig: true },
  });
  if (!assignment) return null;

  const config = parseVoiceAgentConfig(assignment.draftConfig);
  return buildExplicitDispatchMetadata({
    workspaceId: phone.workspaceId,
    agentId: assignment.id,
    publishedVersionId: assignment.publishedVersionId,
    livekitProfile: livekitProfileFromConfig(config.advanced as Record<string, unknown>),
    toE164: phone.e164,
    dispatchSource: "did_lookup",
  });
}

export function mergeExplicitDispatchMetadata(
  ...sources: Array<ExplicitDispatchMetadata | RoomMetadata | null | undefined>
): ExplicitDispatchMetadata | null {
  const merged: ExplicitDispatchMetadata = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.workspaceId) merged.workspaceId = source.workspaceId;
    if (source.agentId) merged.agentId = source.agentId;
    if (source.fromE164) merged.fromE164 = source.fromE164;
    if (source.toE164) merged.toE164 = source.toE164;
    if (source.callId) merged.callId = source.callId;
    if ("publishedVersionId" in source && source.publishedVersionId) {
      merged.publishedVersionId = source.publishedVersionId;
    }
    if ("livekitProfile" in source && source.livekitProfile) {
      merged.livekitProfile = source.livekitProfile;
    }
    if ("dispatchSource" in source && source.dispatchSource) {
      merged.dispatchSource = source.dispatchSource;
    }
  }
  if (!merged.workspaceId && !merged.agentId && !merged.toE164) return null;
  return merged;
}

export function explicitDispatchPatchForPhoneSettings(
  metadata: ExplicitDispatchMetadata,
): Record<string, unknown> {
  return {
    explicitDispatch: {
      workspaceId: metadata.workspaceId,
      agentId: metadata.agentId,
      publishedVersionId: metadata.publishedVersionId,
      livekitProfile: metadata.livekitProfile,
      updatedAt: new Date().toISOString(),
    },
  };
}
