import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import type { InboundHandlingMode, MctbLineInboundConfig } from "./types";
import {
  readInboundHandlingMode,
  readMctbInboundBlock,
} from "./line-config-parse";

export { readInboundHandlingMode, readMctbInboundBlock } from "./line-config-parse";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function patchMctbInboundSettings(
  settingsJson: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const settings = asRecord(settingsJson);
  const inbound = readMctbInboundBlock(settingsJson);
  return {
    ...settings,
    mctbInbound: {
      ...inbound,
      ...patch,
    },
  };
}

export async function resolveCanonicalMctbLinePhoneId(
  workspaceId: string,
  preferredPhoneNumberId?: string | null,
): Promise<string | null> {
  if (preferredPhoneNumberId?.trim()) return preferredPhoneNumberId.trim();
  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId?.trim()) return runtime.phoneNumberId.trim();
  const agent = await getPrisma().voiceAgent.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: { phoneNumberId: true },
  });
  return agent?.phoneNumberId?.trim() || null;
}

export async function loadMctbLineInboundConfig(input: {
  workspaceId: string;
  phoneNumberId?: string | null;
}): Promise<MctbLineInboundConfig | null> {
  const phoneNumberId = await resolveCanonicalMctbLinePhoneId(
    input.workspaceId,
    input.phoneNumberId,
  );
  if (!phoneNumberId) return null;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone?.e164) return null;

  const inbound = readMctbInboundBlock(phone.settingsJson);
  const telephony = asRecord(asRecord(phone.settingsJson).telephony);

  const onboarding = await loadMctbOnboardingState(input.workspaceId);
  const forwardingVerified = Boolean(onboarding.forwardingConnectedAt);

  const businessLineE164 =
    typeof onboarding.businessNumberE164 === "string" && onboarding.businessNumberE164.trim()
      ? onboarding.businessNumberE164.trim()
      : null;

  return {
    phoneNumberId: phone.id,
    ingressE164: phone.e164,
    businessLineE164,
    inboundHandlingMode: readInboundHandlingMode(phone.settingsJson),
    voiceAgentId:
      typeof inbound.voiceAgentId === "string" ? inbound.voiceAgentId : null,
    voiceAgentEnabled: inbound.voiceAgentEnabled === true,
    mctbTexmlAppId:
      typeof inbound.texmlAppId === "string"
        ? inbound.texmlAppId
        : typeof telephony.telnyxTexmlAppId === "string"
          ? telephony.telnyxTexmlAppId
          : null,
    voiceTexmlAppId:
      typeof inbound.voiceTexmlAppId === "string" ? inbound.voiceTexmlAppId : null,
    forwardingVerified,
    configRevision: String(inbound.configRevision || "v1"),
  };
}

export async function persistMctbLineInboundConfig(input: {
  workspaceId: string;
  phoneNumberId: string;
  patch: Partial<{
    inboundHandlingMode: InboundHandlingMode;
    voiceAgentId: string | null;
    voiceAgentEnabled: boolean;
    voiceTexmlAppId: string | null;
    mctbTexmlAppId: string | null;
    configRevision: string;
  }>;
}): Promise<void> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phone) throw new Error("phone_not_found");

  const nextSettings = patchMctbInboundSettings(phone.settingsJson, {
    ...input.patch,
    updatedAt: new Date().toISOString(),
  });

  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: { settingsJson: nextSettings },
  });
}
