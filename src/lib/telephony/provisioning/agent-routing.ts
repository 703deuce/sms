import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import { getLiveKitSipClient } from "./livekit/client";
import type { AgentRoutingResolution } from "./types";

function safeNormalizeE164(phone: string | undefined | null): string | null {
  if (!phone?.trim()) return null;
  try {
    return normalizeE164(phone.trim());
  } catch {
    return null;
  }
}

/** Resolve called DID when SIP attrs are not populated yet (single-DID or trunk lookup). */
export async function resolveFallbackInboundCalledNumber(input: {
  trunkId?: string | null;
  ruleId?: string | null;
}): Promise<string | null> {
  const fromEnv = safeNormalizeE164(
    process.env.DEFAULT_INBOUND_E164 ||
      process.env.AMY_INBOUND_E164 ||
      process.env.PHONE_E164,
  );
  if (fromEnv) return fromEnv;

  if (input.trunkId?.trim()) {
    try {
      const trunks = await getLiveKitSipClient().listSipInboundTrunk({
        trunkIds: [input.trunkId.trim()],
      });
      const numbers = trunks.flatMap((t) => t.numbers || []).filter(Boolean);
      if (numbers.length === 1) {
        return safeNormalizeE164(numbers[0]!) || numbers[0]!;
      }
      if (numbers.length > 1) {
        const preferred =
          numbers.find((n) => n.replace(/\D/g, "").endsWith("8663464256")) || numbers[0];
        return safeNormalizeE164(preferred!) || preferred!;
      }
    } catch {
      // fall through to database lookup
    }
  }

  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { status: "ACTIVE" },
    select: { e164: true, settingsJson: true },
    take: 100,
  });
  const livekitPhones = phones.filter((p: { e164: string; settingsJson: unknown }) => {
    const settings =
      p.settingsJson && typeof p.settingsJson === "object"
        ? (p.settingsJson as {
            telephony?: { routingMode?: string };
            provisioning?: { routingMode?: string };
          })
        : {};
    const telephony = settings.telephony || settings.provisioning;
    return telephony?.routingMode === "livekit_sip";
  });
  if (livekitPhones.length === 1) {
    return livekitPhones[0]!.e164;
  }

  return null;
}

/**
 * Authoritative Transovo lookup: called number → workspace → active agent.
 * LiveKit dispatch stays generic; tenant/agent resolution happens here.
 */
export async function resolveAgentByCalledNumber(
  toE164: string,
): Promise<AgentRoutingResolution | null> {
  const e164 = normalizeE164(toE164);
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: { id: true, workspaceId: true, e164: true, status: true },
  });
  if (!phone) return null;

  const agent = await resolveInboundAiAgent(phone.workspaceId, phone.id);
  if (!agent) return null;

  return {
    workspaceId: phone.workspaceId,
    agentId: agent.id,
    phoneNumberId: phone.id,
    e164: phone.e164,
    agentStatus: agent.status,
    agentName: agent.name,
  };
}

export async function resolveAgentRoutingForCall(input: {
  toE164?: string | null;
  workspaceId?: string | null;
  agentId?: string | null;
}): Promise<AgentRoutingResolution | null> {
  // Called DID is authoritative — DB phone assignment wins over stale dispatch/room metadata.
  if (input.toE164?.trim()) {
    const byPhone = await resolveAgentByCalledNumber(input.toE164);
    if (byPhone) return byPhone;
  }

  if (input.workspaceId && input.agentId) {
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        status: true,
        phoneNumberId: true,
      },
    });
    if (!agent) return null;
    let e164 = input.toE164 || "";
    if (!e164 && agent.phoneNumberId) {
      const pn = await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId },
        select: { e164: true },
      });
      e164 = pn?.e164 || "";
    }
    return {
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId || "",
      e164,
      agentStatus: agent.status,
      agentName: agent.name,
    };
  }

  return null;
}
