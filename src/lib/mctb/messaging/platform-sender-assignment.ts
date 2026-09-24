import "server-only";

import { getPrisma } from "@/lib/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import {
  loadPlatformMctbReplyContexts,
  resolvePlatformInboundReplyFromContexts,
  resolvePlatformMctbInboundReply,
  type PlatformInboundReplyResolution,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

/** Safety net when explicit lifecycle release did not run (not the 14-day evidence window). */
export const MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS = 72 * 60 * 60 * 1000;

export type MctbPlatformSenderReleaseReason =
  | "RESOLVED"
  | "STAFF_CLOSED"
  | "HANDOFF_COMPLETE"
  | "OPT_OUT"
  | "SUPPRESSED"
  | "IDLE_TIMEOUT"
  | "ADMIN_RELEASE"
  | "SUPERSEDED";

export type PlatformSenderClaimStatus = "CLAIMED" | "REUSED" | "COLLISION" | "NOT_PLATFORM";

export type PlatformSenderClaimResult =
  | {
      status: "CLAIMED" | "REUSED";
      assignmentId: string;
      platformPhoneNumberId: string;
    }
  | {
      status: "COLLISION";
      ownerWorkspaceId: string;
      assignmentId: string;
    }
  | { status: "NOT_PLATFORM" };

export type PlatformInboundResolutionSource =
  | "ACTIVE_ASSIGNMENT"
  | "LEGACY_EVIDENCE"
  | "LEGACY_LAZY_ASSIGNMENT";

function logAssignmentDecision(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "mctb-platform-sender-assignment",
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  );
}

function assignmentExpiryFromNow(): Date {
  return new Date(Date.now() + MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS);
}

async function assertEligiblePlatformPhoneNumberId(platformPhoneNumberId: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: platformPhoneNumberId },
    select: { settingsJson: true },
  });
  return Boolean(row && isPlatformMctbSenderPhoneRecord(row));
}

async function releaseExpiredActiveAssignments(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  now: Date;
}) {
  const prisma = getPrisma();
  const released = await prisma.mctbPlatformSenderAssignment.updateMany({
    where: {
      consumerE164: input.consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      state: "ACTIVE",
      expiresAt: { lt: input.now },
    },
    data: {
      state: "RELEASED",
      releasedAt: input.now,
      releaseReason: "IDLE_TIMEOUT",
    },
  });
  if (released.count > 0) {
    logAssignmentDecision({
      decision: "EXPIRED",
      consumerE164: input.consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      count: released.count,
    });
  }
}

export async function findActivePlatformSenderAssignment(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<{
  id: string;
  workspaceId: string;
  conversationId: string | null;
} | null> {
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);
  const prisma = getPrisma();
  const now = new Date();
  await releaseExpiredActiveAssignments({
    consumerE164,
    platformPhoneNumberId: input.platformPhoneNumberId,
    now,
  });
  const row = await prisma.mctbPlatformSenderAssignment.findFirst({
    where: {
      consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      state: "ACTIVE",
    },
    select: { id: true, workspaceId: true, conversationId: true },
  });
  return row;
}

export async function claimPlatformSenderAssignment(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  conversationId?: string | null;
  missedCallEventId?: string | null;
}): Promise<PlatformSenderClaimResult> {
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);
  const platformPhoneNumberId = input.platformPhoneNumberId.trim();
  if (!platformPhoneNumberId) {
    return { status: "NOT_PLATFORM" };
  }
  if (!(await assertEligiblePlatformPhoneNumberId(platformPhoneNumberId))) {
    return { status: "NOT_PLATFORM" };
  }

  const prisma = getPrisma();
  const now = new Date();
  const expiresAt = assignmentExpiryFromNow();

  const result = await prisma.$transaction(async (tx) => {
    await tx.mctbPlatformSenderAssignment.updateMany({
      where: {
        consumerE164,
        platformPhoneNumberId,
        state: "ACTIVE",
        expiresAt: { lt: now },
      },
      data: {
        state: "RELEASED",
        releasedAt: now,
        releaseReason: "IDLE_TIMEOUT",
      },
    });

    const active = await tx.mctbPlatformSenderAssignment.findFirst({
      where: { consumerE164, platformPhoneNumberId, state: "ACTIVE" },
    });

    if (active) {
      if (active.workspaceId === input.workspaceId) {
        const updated = await tx.mctbPlatformSenderAssignment.update({
          where: { id: active.id },
          data: {
            lastUsedAt: now,
            expiresAt,
            ...(input.conversationId ? { conversationId: input.conversationId } : {}),
            ...(input.missedCallEventId ? { missedCallEventId: input.missedCallEventId } : {}),
          },
        });
        return {
          status: "REUSED" as const,
          assignmentId: updated.id,
          platformPhoneNumberId,
        };
      }
      return {
        status: "COLLISION" as const,
        ownerWorkspaceId: active.workspaceId,
        assignmentId: active.id,
      };
    }

    try {
      const created = await tx.mctbPlatformSenderAssignment.create({
        data: {
          workspaceId: input.workspaceId,
          consumerE164,
          platformPhoneNumberId,
          conversationId: input.conversationId ?? null,
          missedCallEventId: input.missedCallEventId ?? null,
          state: "ACTIVE",
          lastUsedAt: now,
          expiresAt,
        },
      });
      return {
        status: "CLAIMED" as const,
        assignmentId: created.id,
        platformPhoneNumberId,
      };
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code !== "P2002") {
        throw err;
      }
      const winner = await tx.mctbPlatformSenderAssignment.findFirst({
        where: { consumerE164, platformPhoneNumberId, state: "ACTIVE" },
      });
      if (!winner) {
        throw err;
      }
      if (winner.workspaceId === input.workspaceId) {
        return {
          status: "REUSED" as const,
          assignmentId: winner.id,
          platformPhoneNumberId,
        };
      }
      return {
        status: "COLLISION" as const,
        ownerWorkspaceId: winner.workspaceId,
        assignmentId: winner.id,
      };
    }
  });

  logAssignmentDecision({
    decision: result.status,
    workspaceId: input.workspaceId,
    consumerE164,
    platformPhoneNumberId,
    assignmentId:
      result.status === "COLLISION" || result.status === "CLAIMED" || result.status === "REUSED"
        ? result.assignmentId
        : undefined,
    ownerWorkspaceId: result.status === "COLLISION" ? result.ownerWorkspaceId : undefined,
  });

  return result;
}

export async function touchPlatformSenderAssignment(input: {
  assignmentId?: string;
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  conversationId?: string | null;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const expiresAt = assignmentExpiryFromNow();
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);

  if (input.assignmentId) {
    await prisma.mctbPlatformSenderAssignment.updateMany({
      where: {
        id: input.assignmentId,
        workspaceId: input.workspaceId,
        state: "ACTIVE",
      },
      data: {
        lastUsedAt: now,
        expiresAt,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      },
    });
    return;
  }

  await prisma.mctbPlatformSenderAssignment.updateMany({
    where: {
      workspaceId: input.workspaceId,
      consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      state: "ACTIVE",
    },
    data: {
      lastUsedAt: now,
      expiresAt,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    },
  });
}

export async function releasePlatformSenderAssignment(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  workspaceId?: string;
  releaseReason: MctbPlatformSenderReleaseReason;
  conversationId?: string | null;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);
  const where: {
    consumerE164: string;
    platformPhoneNumberId: string;
    state: "ACTIVE";
    workspaceId?: string;
    conversationId?: string;
  } = {
    consumerE164,
    platformPhoneNumberId: input.platformPhoneNumberId,
    state: "ACTIVE",
  };
  if (input.workspaceId) where.workspaceId = input.workspaceId;
  if (input.conversationId) where.conversationId = input.conversationId;

  const released = await prisma.mctbPlatformSenderAssignment.updateMany({
    where,
    data: {
      state: "RELEASED",
      releasedAt: now,
      releaseReason: input.releaseReason,
    },
  });

  if (released.count > 0) {
    logAssignmentDecision({
      decision: "RELEASED",
      releaseReason: input.releaseReason,
      consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      workspaceId: input.workspaceId,
      count: released.count,
    });
  }
}

export async function releasePlatformSenderAssignmentForConsumer(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
  releaseReason: MctbPlatformSenderReleaseReason;
}) {
  await releasePlatformSenderAssignment({
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.platformSender.phoneNumberId,
    releaseReason: input.releaseReason,
  });
}

async function tryLazyAssignmentFromLegacyResolution(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
  resolution: PlatformInboundReplyResolution;
}): Promise<boolean> {
  if (input.resolution.status !== "RESOLVED") return false;
  const claim = await claimPlatformSenderAssignment({
    workspaceId: input.resolution.workspaceId,
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.platformSender.phoneNumberId,
    conversationId: input.resolution.conversationId,
  });
  if (claim.status === "COLLISION") {
    logAssignmentDecision({
      decision: "LEGACY_LAZY_SKIPPED",
      reason: "collision_on_materialize",
      workspaceId: input.resolution.workspaceId,
    });
    return false;
  }
  if (claim.status === "NOT_PLATFORM") return false;
  logAssignmentDecision({
    decision: "LEGACY_LAZY_ASSIGNMENT",
    assignmentId: claim.assignmentId,
    workspaceId: input.resolution.workspaceId,
  });
  return true;
}

export async function resolvePlatformMctbInboundReplyWithAssignment(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
}): Promise<
  PlatformInboundReplyResolution & {
    resolutionSource?: PlatformInboundResolutionSource;
  }
> {
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);
  const active = await findActivePlatformSenderAssignment({
    consumerE164,
    platformPhoneNumberId: input.platformSender.phoneNumberId,
  });

  if (active) {
    logAssignmentDecision({
      decision: "INBOUND_RESOLVED",
      resolutionSource: "ACTIVE_ASSIGNMENT",
      assignmentId: active.id,
      workspaceId: active.workspaceId,
    });
    return {
      status: "RESOLVED",
      workspaceId: active.workspaceId,
      conversationId: active.conversationId,
      reason: "platform_reply_resolved",
      resolutionSource: "ACTIVE_ASSIGNMENT",
    };
  }

  const legacy = await resolvePlatformMctbInboundReply({
    platformSender: input.platformSender,
    consumerE164,
  });

  if (legacy.status === "RESOLVED") {
    const materialized = await tryLazyAssignmentFromLegacyResolution({
      platformSender: input.platformSender,
      consumerE164,
      resolution: legacy,
    });
    return {
      ...legacy,
      resolutionSource: materialized ? "LEGACY_LAZY_ASSIGNMENT" : "LEGACY_EVIDENCE",
    };
  }

  return legacy;
}

/** Gate PLATFORM outbound — call before provider send. */
export async function requirePlatformSenderAssignmentForOutbound(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  conversationId?: string | null;
  missedCallEventId?: string | null;
}): Promise<PlatformSenderClaimResult> {
  return claimPlatformSenderAssignment(input);
}

export {
  loadPlatformMctbReplyContexts,
  resolvePlatformInboundReplyFromContexts,
};
