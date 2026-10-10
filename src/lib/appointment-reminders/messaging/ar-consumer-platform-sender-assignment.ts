import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import {
  listArEligiblePlatformSenders,
  resolveCanonicalArOutboundPlatformSender,
  type ArPlatformSenderCandidate,
} from "./ar-platform-sender-pool";

const OUTBOUND_PROOF_OR = [
  { lastOutboundProviderMessageId: { not: null } },
  { lastOutboundMessageId: { not: null } },
] as const;

async function listLegacyConsumerSenderPairs(consumerE164: string) {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(consumerE164);
  const rows = await prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      OR: [...OUTBOUND_PROOF_OR],
    },
    select: {
      workspaceId: true,
      platformPhoneNumberId: true,
      provider: true,
    },
    distinct: ["workspaceId", "platformPhoneNumberId"],
  });
  return rows;
}

/**
 * Materialize historical reply-session (customer, sender) → workspace for inbound hints.
 */
export async function materializeLegacyArSenderAssignmentsForConsumer(
  consumerE164: string,
): Promise<{ materialized: number; conflicts: number }> {
  const consumer = normalizeMctbCallerE164(consumerE164);
  const legacy = await listLegacyConsumerSenderPairs(consumer);
  let materialized = 0;
  let conflicts = 0;
  for (const row of legacy) {
    try {
      await ensureArConsumerPlatformSenderAssignment({
        workspaceId: row.workspaceId,
        consumerE164: consumer,
        platformPhoneNumberId: row.platformPhoneNumberId,
        provider: row.provider || "telnyx",
      });
      materialized += 1;
    } catch {
      conflicts += 1;
    }
  }
  return { materialized, conflicts };
}

export async function resolveArWorkspaceIdFromConsumerPlatformSender(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<string | null> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const row = await prisma.arSmsConsumerPlatformSenderAssignment.findFirst({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
    },
    orderBy: { lastUsedAt: "desc" },
    select: { workspaceId: true },
  });
  if (row?.workspaceId) return row.workspaceId;

  const legacy = await prisma.arSmsReplySession.findFirst({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      OR: [...OUTBOUND_PROOF_OR],
    },
    orderBy: { lastUsedAt: "desc" },
    select: { workspaceId: true },
  });
  return legacy?.workspaceId ?? null;
}

export async function touchArConsumerPlatformSenderAssignment(input: {
  workspaceId: string;
  consumerE164: string;
}): Promise<void> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  await prisma.arSmsConsumerPlatformSenderAssignment.updateMany({
    where: { consumerE164: consumer, workspaceId: input.workspaceId },
    data: { lastUsedAt: new Date() },
  });
}

/** Per-workspace record of which platform sender was used with this customer (not a global lock). */
export async function ensureArConsumerPlatformSenderAssignment(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  provider: string;
}): Promise<void> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const provider = input.provider.trim() || "telnyx";
  await prisma.arSmsConsumerPlatformSenderAssignment.upsert({
    where: {
      consumerE164_workspaceId: { consumerE164: consumer, workspaceId: input.workspaceId },
    },
    create: {
      consumerE164: consumer,
      workspaceId: input.workspaceId,
      platformPhoneNumberId: input.platformPhoneNumberId,
      provider,
    },
    update: {
      platformPhoneNumberId: input.platformPhoneNumberId,
      provider,
      lastUsedAt: new Date(),
    },
  });
}

async function senderSelectionFromAssignment(
  assignment: { platformPhoneNumberId: string; provider: string },
  senders: ArPlatformSenderCandidate[],
): Promise<ArPlatformSenderAllocateResult | null> {
  const candidate = senders.find((s) => s.phoneNumberId === assignment.platformPhoneNumberId);
  if (!candidate) {
    return null;
  }
  const { isPhoneAuthorizedForOutboundSms } = await import("@/lib/mctb/messaging/outbound-sms-route");
  const auth = await isPhoneAuthorizedForOutboundSms(candidate.phoneNumberId);
  if (!auth.allowed) {
    return null;
  }
  return {
    ok: true,
    phoneNumberId: candidate.phoneNumberId,
    e164: candidate.e164,
    provider: String(assignment.provider || candidate.provider || "telnyx"),
    reusedExistingAppointmentSender: true,
  };
}

export type ArPlatformSenderAllocateResult =
  | {
      ok: true;
      phoneNumberId: string;
      e164: string;
      provider: string;
      reusedExistingAppointmentSender: boolean;
    }
  | { ok: false; reason: string; pendingSendReason: string };

/**
 * Resolve outbound platform sender for appointment reminders.
 * Canonical Telnyx is always used when authorized — never withheld because another workspace
 * already texted this customer from the same platform number.
 */
export async function allocateArPlatformSenderForReminder(input: {
  workspaceId: string;
  consumerE164: string;
}): Promise<ArPlatformSenderAllocateResult> {
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const canonical = await resolveCanonicalArOutboundPlatformSender();
  if (!canonical.ok) {
    return canonical;
  }

  const senders = await listArEligiblePlatformSenders();
  const prisma = getPrisma();
  const existingForWorkspace = await prisma.arSmsConsumerPlatformSenderAssignment.findUnique({
    where: {
      consumerE164_workspaceId: { consumerE164: consumer, workspaceId: input.workspaceId },
    },
  });

  if (
    existingForWorkspace &&
    existingForWorkspace.platformPhoneNumberId === canonical.phoneNumberId
  ) {
    const fromAssignment = await senderSelectionFromAssignment(existingForWorkspace, senders);
    if (fromAssignment) {
      await touchArConsumerPlatformSenderAssignment({
        workspaceId: input.workspaceId,
        consumerE164: consumer,
      });
      return fromAssignment;
    }
  }

  await ensureArConsumerPlatformSenderAssignment({
    workspaceId: input.workspaceId,
    consumerE164: consumer,
    platformPhoneNumberId: canonical.phoneNumberId,
    provider: canonical.provider,
  });

  return {
    ok: true,
    phoneNumberId: canonical.phoneNumberId,
    e164: canonical.e164,
    provider: canonical.provider,
    reusedExistingAppointmentSender: Boolean(existingForWorkspace),
  };
}

/** @deprecated Use occupiedPlatformSendersForWorkspace only in tests; outbound no longer blocks on other workspaces. */
export async function findArPlatformSendersOccupiedByOtherWorkspaces(
  _consumerE164: string,
  _workspaceId: string,
): Promise<Set<string>> {
  return new Set();
}
