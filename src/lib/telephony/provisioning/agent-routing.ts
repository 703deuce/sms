import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import { findFrontDeskAgentForWorkspace } from "@/lib/voice/frontdesk/resolve-frontdesk-agent";
import {
  isFrontDeskRuntimeConfig,
  loadFrontDeskRuntimeConfig,
} from "@/lib/voice/frontdesk/pick-frontdesk-agent";
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

function routingModeForPhone(settingsJson: unknown): string {
  const settings =
    settingsJson && typeof settingsJson === "object"
      ? (settingsJson as {
          telephony?: { routingMode?: string };
          provisioning?: { routingMode?: string };
        })
      : {};
  const telephony = settings.telephony || settings.provisioning;
  return String(telephony?.routingMode || "").toLowerCase();
}

function scoreInboundPhoneCandidate(input: {
  status: string;
  settingsJson: unknown;
  updatedAt: Date;
}): number {
  let score = 0;
  if (input.status === "ACTIVE") score += 10;
  if (routingModeForPhone(input.settingsJson) === "livekit_sip") score += 100;
  const caps = readPhoneCapabilities({ settingsJson: input.settingsJson });
  if (caps.aiAfterHoursEnabled) score += 50;
  if (caps.voiceEnabled) score += 5;
  score += (input.updatedAt?.getTime() ?? 0) / 1_000_000_000_000;
  return score;
}

/**
 * Authoritative Transovo lookup: called number → workspace → active agent.
 * LiveKit dispatch stays generic; tenant/agent resolution happens here.
 *
 * When duplicate E164 rows exist (legacy imports), prefer the phone that has an
 * ACTIVE inbound AI assignment and LiveKit SIP routing configured.
 */
export async function resolveAgentByCalledNumber(
  toE164: string,
): Promise<AgentRoutingResolution | null> {
  const e164 = safeNormalizeE164(toE164);
  if (!e164) return null;
  const prisma = getPrisma();

  const phones = await prisma.phoneNumber.findMany({
    where: { e164 },
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      status: true,
      settingsJson: true,
      updatedAt: true,
    },
  });
  if (!phones.length) return null;

  const candidates: Array<{
    phone: (typeof phones)[number];
    routing: AgentRoutingResolution;
    score: number;
  }> = [];

  for (const phone of phones) {
    const agent = await resolveInboundAiAgent(phone.workspaceId, phone.id);
    if (!agent) continue;
    candidates.push({
      phone,
      routing: {
        workspaceId: phone.workspaceId,
        agentId: agent.id,
        phoneNumberId: phone.id,
        e164: phone.e164,
        agentStatus: agent.status,
        agentName: agent.name,
      },
      score: scoreInboundPhoneCandidate(phone),
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.routing;
}

async function applyInboundFrontDeskDefault(
  routing: AgentRoutingResolution,
): Promise<AgentRoutingResolution> {
  const prisma = getPrisma();
  const routedAgent = await prisma.voiceAgent.findFirst({
    where: { id: routing.agentId, workspaceId: routing.workspaceId, status: "ACTIVE" },
    select: { id: true, draftConfig: true },
  });
  if (routedAgent) {
    const runtimeConfig = await loadFrontDeskRuntimeConfig(
      routing.workspaceId,
      routedAgent.id,
      routedAgent.draftConfig,
    );
    if (isFrontDeskRuntimeConfig(runtimeConfig)) {
      return routing;
    }
  }

  const frontdesk = await findFrontDeskAgentForWorkspace(routing.workspaceId, {
    preferPhoneNumberId: routing.phoneNumberId,
  });
  if (!frontdesk || frontdesk.id === routing.agentId) return routing;

  console.log(
    JSON.stringify({
      source: "transovo-agent-routing",
      event: "inbound_frontdesk_default",
      workspaceId: routing.workspaceId,
      previousAgentId: routing.agentId,
      previousAgentName: routing.agentName,
      frontdeskAgentId: frontdesk.id,
      frontdeskAgentName: frontdesk.name,
      toE164: routing.e164 || null,
    }),
  );

  return {
    ...routing,
    agentId: frontdesk.id,
    agentName: frontdesk.name,
    agentStatus: frontdesk.status,
    phoneNumberId: frontdesk.phoneNumberId || routing.phoneNumberId,
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
    if (byPhone) return applyInboundFrontDeskDefault(byPhone);
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
    return applyInboundFrontDeskDefault({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId || "",
      e164,
      agentStatus: agent.status,
      agentName: agent.name,
    });
  }

  return null;
}
