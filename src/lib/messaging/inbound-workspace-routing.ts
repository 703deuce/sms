/**
 * Deterministic inbound SMS workspace resolution when multiple tenants share an E.164.
 */
import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  INBOUND_OUTBOUND_PAIRING_WINDOW_MS,
  pickWorkspaceFromKeywordMatches,
  pickWorkspaceFromOutboundPairing,
  resolvePhoneCandidateWithoutLookup,
  type InboundPhoneCandidate,
  type InboundWorkspaceRouteResult,
} from "@/lib/messaging/inbound-workspace-routing-policy";

export {
  INBOUND_OUTBOUND_PAIRING_WINDOW_MS,
  isMirrorOrArchivedPhoneRow,
  pickWorkspaceFromKeywordMatches,
  pickWorkspaceFromMirrorDisambiguation,
  pickWorkspaceFromOutboundPairing,
  resolvePhoneCandidateWithoutLookup,
  type InboundPhoneCandidate,
  type InboundWorkspaceRouteReason,
  type InboundWorkspaceRouteResult,
} from "@/lib/messaging/inbound-workspace-routing-policy";

type MessagingRegistrationRow = Awaited<
  ReturnType<ReturnType<typeof getPrisma>["messagingRegistration"]["findUnique"]>
>;

function normalizeInboundE164(raw: string): string {
  try {
    return normalizeE164(raw);
  } catch {
    return raw.trim();
  }
}

async function loadOutboundPairingWorkspaceIds(input: {
  workspaceIds: string[];
  toE164: string;
  fromE164: string;
  since: Date;
}): Promise<Array<{ workspaceId: string; createdAt: Date }>> {
  const prisma = getPrisma();
  const hits: Array<{ workspaceId: string; createdAt: Date }> = [];

  const messages = await prisma.message.findMany({
    where: {
      workspaceId: { in: input.workspaceIds },
      from: input.toE164,
      to: input.fromE164,
      createdAt: { gte: input.since },
      status: { notIn: ["failed", "canceled", "cancelled"] },
    },
    orderBy: { createdAt: "desc" },
    select: { workspaceId: true, createdAt: true },
    take: 50,
  });
  for (const row of messages) {
    if (row.workspaceId) hits.push({ workspaceId: row.workspaceId, createdAt: row.createdAt });
  }

  const convMessages = await prisma.conversationMessage.findMany({
    where: {
      direction: { in: ["out", "outbound"] },
      createdAt: { gte: input.since },
      conversation: {
        workspaceId: { in: input.workspaceIds },
        contact: { phone: input.fromE164 },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      conversation: { select: { workspaceId: true } },
    },
    take: 50,
  });
  for (const row of convMessages) {
    hits.push({
      workspaceId: row.conversation.workspaceId,
      createdAt: row.createdAt,
    });
  }

  return hits;
}

async function loadKeywordWorkspaceMatch(input: {
  workspaceIds: string[];
  toE164: string;
  body: string;
}): Promise<string | null> {
  const word = (input.body || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
  if (!word) return null;

  const prisma = getPrisma();
  const keywords = await prisma.keyword.findMany({
    where: {
      workspaceId: { in: input.workspaceIds },
      status: "Active",
      keyword: { equals: word, mode: "insensitive" },
      OR: [{ phoneNumber: input.toE164 }, { phoneNumber: "*" }],
    },
    select: { workspaceId: true },
  });
  return pickWorkspaceFromKeywordMatches(keywords);
}

async function loadUniqueRegistrationWorkspace(input: {
  workspaceIds: string[];
  toE164: string;
}): Promise<string | null> {
  const prisma = getPrisma();
  const regs = await prisma.messagingRegistration.findMany({
    where: {
      workspaceId: { in: input.workspaceIds },
      phoneAttached: true,
      OR: [{ phoneE164: input.toE164 }],
    },
    select: { workspaceId: true },
  });
  const ids = [...new Set(regs.map((r: { workspaceId: string }) => r.workspaceId))];
  return ids.length === 1 ? (ids[0] as string) : null;
}

export async function resolveInboundWorkspaceFromPhoneCandidates(input: {
  toE164: string;
  fromE164?: string;
  body?: string;
  candidates: InboundPhoneCandidate[];
}): Promise<InboundWorkspaceRouteResult> {
  const toE164 = normalizeInboundE164(input.toE164);
  const fromE164 = input.fromE164 ? normalizeInboundE164(input.fromE164) : "";
  const active = input.candidates.filter(
    (row) => String(row.status || "Active").toLowerCase() !== "released",
  );
  const workspaceIds = [...new Set(active.map((row) => row.workspaceId))];

  let outboundWorkspaceId: string | null = null;
  if (fromE164 && workspaceIds.length > 1) {
    const since = new Date(Date.now() - INBOUND_OUTBOUND_PAIRING_WINDOW_MS);
    const pairingHits = await loadOutboundPairingWorkspaceIds({
      workspaceIds,
      toE164,
      fromE164,
      since,
    });
    outboundWorkspaceId = pickWorkspaceFromOutboundPairing(pairingHits);
  }

  let keywordWorkspaceId: string | null = null;
  if (input.body?.trim() && workspaceIds.length > 1) {
    keywordWorkspaceId = await loadKeywordWorkspaceMatch({
      workspaceIds,
      toE164,
      body: input.body,
    });
  }

  let registrationWorkspaceId: string | null = null;
  if (workspaceIds.length > 1) {
    registrationWorkspaceId = await loadUniqueRegistrationWorkspace({
      workspaceIds,
      toE164,
    });
  }

  return resolvePhoneCandidateWithoutLookup({
    toE164,
    candidates: input.candidates,
    outboundWorkspaceId,
    keywordWorkspaceId,
    registrationWorkspaceId,
  });
}

export async function resolveInboundWorkspaceRouting(input: {
  toRaw: string;
  fromE164?: string;
  body?: string;
  accountOrProfileId?: string;
}): Promise<InboundWorkspaceRouteResult & { registration?: MessagingRegistrationRow | null }> {
  const prisma = getPrisma();
  const toE164 = normalizeInboundE164(input.toRaw);
  const variants = [...new Set([input.toRaw.trim(), toE164].filter(Boolean))];

  const candidates = await prisma.phoneNumber.findMany({
    where: {
      OR: variants.flatMap((value) => [{ e164: value }]),
      status: "Active",
    },
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      settingsJson: true,
      status: true,
    },
  });

  if (candidates.length) {
    const routed = await resolveInboundWorkspaceFromPhoneCandidates({
      toE164,
      fromE164: input.fromE164,
      body: input.body,
      candidates,
    });
    if (routed.ok) {
      const registration = await prisma.messagingRegistration.findUnique({
        where: { workspaceId: routed.workspaceId },
      });
      return { ...routed, registration };
    }
    if (candidates.length > 1) {
      return routed;
    }
  }

  const reg =
    (await prisma.messagingRegistration.findFirst({
      where: {
        OR: variants.flatMap((value) => [{ phoneE164: value }]),
        phoneAttached: true,
      },
    })) ||
    (input.accountOrProfileId
      ? await prisma.messagingRegistration.findFirst({
          where: {
            OR: [
              { subaccountSid: input.accountOrProfileId },
              { messagingProfileId: input.accountOrProfileId },
              { messagingServiceSid: input.accountOrProfileId },
            ],
          },
        })
      : null);

  if (reg?.phoneE164) {
    return {
      ok: true,
      workspaceId: reg.workspaceId,
      phoneE164: reg.phoneE164,
      phoneNumberId: reg.phoneNumberId || "",
      reason: "registration_fallback",
      registration: reg,
    };
  }

  return { ok: false, reason: "no_match", detail: "no_phone_or_registration" };
}
