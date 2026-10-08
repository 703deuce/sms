import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  listArEligiblePlatformSenders,
  type ArPlatformSenderCandidate,
} from "./ar-platform-sender-pool";
export type ArPlatformSenderAllocateResult =
  | {
      ok: true;
      phoneNumberId: string;
      e164: string;
      provider: string;
      reusedExistingAppointmentSender: boolean;
    }
  | { ok: false; reason: string; pendingSendReason: string };

export async function findArPlatformSendersOccupiedByOtherWorkspaces(
  consumerE164: string,
  workspaceId: string,
): Promise<Set<string>> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(consumerE164);
  const rows = await prisma.arSmsConsumerPlatformSenderAssignment.findMany({
    where: { consumerE164: consumer, NOT: { workspaceId } },
    select: { platformPhoneNumberId: true },
  });
  return new Set(rows.map((r) => r.platformPhoneNumberId));
}

export async function resolveArWorkspaceIdFromConsumerPlatformSender(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<string | null> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const row = await prisma.arSmsConsumerPlatformSenderAssignment.findUnique({
    where: {
      consumerE164_platformPhoneNumberId: {
        consumerE164: consumer,
        platformPhoneNumberId: input.platformPhoneNumberId,
      },
    },
    select: { workspaceId: true },
  });
  return row?.workspaceId ?? null;
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

/** Persist durable assignment when reusing a sender discovered from legacy reply sessions. */
export async function ensureArConsumerPlatformSenderAssignment(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  provider: string;
}): Promise<void> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const provider = input.provider.trim() || "telnyx";
  try {
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
      update: { lastUsedAt: new Date() },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
    const existingPair = await prisma.arSmsConsumerPlatformSenderAssignment.findUnique({
      where: {
        consumerE164_platformPhoneNumberId: {
          consumerE164: consumer,
          platformPhoneNumberId: input.platformPhoneNumberId,
        },
      },
    });
    if (existingPair?.workspaceId !== input.workspaceId) {
      throw new Error("ar_consumer_platform_sender_pair_owned_by_other_workspace");
    }
  }
}

async function senderSelectionFromAssignment(
  assignment: { platformPhoneNumberId: string; provider: string },
  senders: ArPlatformSenderCandidate[],
): Promise<ArPlatformSenderAllocateResult | null> {
  const candidate = senders.find((s) => s.phoneNumberId === assignment.platformPhoneNumberId);
  if (!candidate) {
    return null;
  }
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

/**
 * Allocate or reuse platform sender for (workspace, customer) before first outbound reminder.
 * DB unique constraints enforce (customer, sender) → one workspace under concurrency.
 */
export async function allocateArPlatformSenderForReminder(input: {
  workspaceId: string;
  consumerE164: string;
}): Promise<ArPlatformSenderAllocateResult> {
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const senders = await listArEligiblePlatformSenders();
  if (!senders.length) {
    return {
      ok: false,
      reason: "ar_no_eligible_platform_sender",
      pendingSendReason:
        "Canonical Telnyx platform sender (866) is not configured or authorized for Appointment Reminders",
    };
  }

  const prisma = getPrisma();
  const existingForWorkspace = await prisma.arSmsConsumerPlatformSenderAssignment.findUnique({
    where: {
      consumerE164_workspaceId: { consumerE164: consumer, workspaceId: input.workspaceId },
    },
  });
  if (existingForWorkspace) {
    const fromAssignment = await senderSelectionFromAssignment(existingForWorkspace, senders);
    if (fromAssignment) {
      await touchArConsumerPlatformSenderAssignment({
        workspaceId: input.workspaceId,
        consumerE164: consumer,
      });
      return fromAssignment;
    }
  }

  const occupiedByOthers = await findArPlatformSendersOccupiedByOtherWorkspaces(
    consumer,
    input.workspaceId,
  );

  for (const candidate of senders) {
    if (occupiedByOthers.has(candidate.phoneNumberId)) continue;
    const auth = await isPhoneAuthorizedForOutboundSms(candidate.phoneNumberId);
    if (!auth.allowed) continue;

    try {
      const created = await prisma.$transaction(async (tx) => {
        const pairOwner = await tx.arSmsConsumerPlatformSenderAssignment.findUnique({
          where: {
            consumerE164_platformPhoneNumberId: {
              consumerE164: consumer,
              platformPhoneNumberId: candidate.phoneNumberId,
            },
          },
        });
        if (pairOwner && pairOwner.workspaceId !== input.workspaceId) {
          return null;
        }

        const wsOwner = await tx.arSmsConsumerPlatformSenderAssignment.findUnique({
          where: {
            consumerE164_workspaceId: { consumerE164: consumer, workspaceId: input.workspaceId },
          },
        });
        if (wsOwner) {
          if (wsOwner.platformPhoneNumberId !== candidate.phoneNumberId) {
            return null;
          }
          return wsOwner;
        }

        return tx.arSmsConsumerPlatformSenderAssignment.create({
          data: {
            consumerE164: consumer,
            workspaceId: input.workspaceId,
            platformPhoneNumberId: candidate.phoneNumberId,
            provider: candidate.provider,
          },
        });
      });

      if (!created) continue;

      return {
        ok: true,
        phoneNumberId: candidate.phoneNumberId,
        e164: candidate.e164,
        provider: candidate.provider,
        reusedExistingAppointmentSender: Boolean(existingForWorkspace),
      };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  return {
    ok: false,
    reason: "ar_sender_pool_exhausted",
    pendingSendReason:
      "This customer already has appointment reminder assignments on all platform senders for other businesses. Add another platform sender or retry later.",
  };
}
