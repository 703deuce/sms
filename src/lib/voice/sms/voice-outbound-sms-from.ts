/**
 * Outbound SMS sender for voice agents (booking links, resources).
 *
 * Inbound voice may be toll-free (866/800) or a forwarded DID; SMS must use a
 * separate A2P-approved sender when the voice line cannot text (typical: 571 local).
 * Runtime owns this — never expose From numbers to the model.
 */

import { getPrisma } from "@/lib/db";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  HP_CERTIFIED_SMS_E164,
  normalizePhoneE164,
  pickPreferredSmsSendingNumber,
} from "@/lib/messaging/preferred-sending-number";
import {
  effectiveOutboundSmsMode,
  isLikelySmsCapableInboundLine,
  parseVoiceOutboundSmsSettings,
  pickExplicitSmsNumber,
} from "./voice-outbound-sms-config";

/** Production voice SMS sender — 5714073615 (A2P-certified). */
export const VOICE_OUTBOUND_SMS_E164 = HP_CERTIFIED_SMS_E164;

export { HP_CERTIFIED_SMS_E164 };

export function resolveVoiceOutboundSmsFromE164(): string {
  const env = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  return normalizePhoneE164(env) || VOICE_OUTBOUND_SMS_E164;
}

type ActiveNumberRow = {
  id: string;
  e164: string;
  status: string | null;
  type: string | null;
  a2pStatus: string | null;
  provider: string | null;
  settingsJson: unknown;
};

async function loadWorkspaceActiveNumbers(workspaceId: string): Promise<ActiveNumberRow[]> {
  const prisma = getPrisma();
  return prisma.phoneNumber.findMany({
    where: { workspaceId, status: "Active" },
    select: {
      id: true,
      e164: true,
      status: true,
      type: true,
      a2pStatus: true,
      provider: true,
      settingsJson: true,
    },
  });
}

async function loadAgentConfig(
  workspaceId: string,
  agentId?: string | null,
): Promise<VoiceAgentConfig | null> {
  if (!agentId) return null;
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { draftConfig: true, publishedVersion: { select: { config: true } } },
  });
  if (!agent) return null;
  const raw = agent.publishedVersion?.config ?? agent.draftConfig;
  return parseVoiceAgentConfig(raw);
}

/**
 * Resolve the trusted outbound SMS sender for a voice session.
 * Never uses toll-free voice DIDs unless they are explicitly configured and SMS-capable.
 */
export async function resolveVoiceOutboundSmsFrom(input: {
  workspaceId: string;
  calledE164?: string | null;
  agentId?: string | null;
  config?: VoiceAgentConfig | null;
}): Promise<string> {
  const config =
    input.config ?? (await loadAgentConfig(input.workspaceId, input.agentId));
  const settings = parseVoiceOutboundSmsSettings(config);
  const mode = effectiveOutboundSmsMode(settings);
  const numbers = await loadWorkspaceActiveNumbers(input.workspaceId);
  const called = normalizePhoneE164(input.calledE164);

  if (mode === "explicit_number") {
    const explicit = pickExplicitSmsNumber(numbers, settings);
    if (explicit?.e164) return explicit.e164;
    if (settings.e164) {
      const owned = numbers.find((n) => normalizePhoneE164(n.e164) === settings.e164);
      if (owned?.e164) return owned.e164;
    }
  }

  if (mode === "same_as_voice_line") {
    const line = called || settings.voiceInboundE164;
    if (line && isLikelySmsCapableInboundLine(line)) {
      const owned = numbers.find((n) => normalizePhoneE164(n.e164) === line);
      if (owned?.e164) return owned.e164;
    }
  }

  const envConfigured = resolveVoiceOutboundSmsFromE164();
  const envOwned = numbers.find((n) => normalizePhoneE164(n.e164) === envConfigured);
  if (envOwned?.e164) return envOwned.e164;

  const preferred = pickPreferredSmsSendingNumber(numbers);
  if (preferred?.e164) return preferred.e164;

  return envConfigured;
}

/** For logging / support — does not send SMS. */
export async function explainVoiceOutboundSmsFrom(input: {
  workspaceId: string;
  calledE164?: string | null;
  agentId?: string | null;
}): Promise<{
  fromE164: string;
  mode: string;
  voiceInboundE164: string | null;
  note: string;
}> {
  const config = await loadAgentConfig(input.workspaceId, input.agentId);
  const settings = parseVoiceOutboundSmsSettings(config);
  const fromE164 = await resolveVoiceOutboundSmsFrom(input);
  const mode = effectiveOutboundSmsMode(settings);
  const called = normalizePhoneE164(input.calledE164);
  const note =
    called && normalizePhoneE164(fromE164) !== called
      ? "SMS sender differs from voice DID (expected for toll-free voice + local texting)."
      : "SMS sender matches voice DID.";
  return {
    fromE164,
    mode,
    voiceInboundE164: settings.voiceInboundE164 || called || null,
    note,
  };
}
