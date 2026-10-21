import "server-only";

import { getPrisma } from "@/lib/server/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/mctb/messaging/phone-number-class";
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

/** Active MCTB platform sender rows for a consumer (all senders). Matches inbound dispatch semantics. */
export async function findActivePlatformSenderIdsForConsumer(
  consumerE164: string,
): Promise<Set<string>> {
  const consumer = normalizeMctbCallerE164(consumerE164);
  const prisma = getPrisma();
  const now = new Date();
  const distinctSenders = await prisma.mctbPlatformSenderAssignment.findMany({
    where: { consumerE164: consumer, state: "ACTIVE" },
    select: { platformPhoneNumberId: true },
    distinct: ["platformPhoneNumberId"],
  });
  const occupied = new Set<string>();
  for (const row of distinctSenders) {
    await releaseExpiredActiveAssignments({
      consumerE164: consumer,
      platformPhoneNumberId: row.platformPhoneNumberId,
      now,
    });
    const active = await prisma.mctbPlatformSenderAssignment.findFirst({
      where: {
        consumerE164: consumer,
        platformPhoneNumberId: row.platformPhoneNumberId,
        state: "ACTIVE",
      },
      select: { id: true },
    });
    if (active) occupied.add(row.platformPhoneNumberId);
  }
  return occupied;
}

export async function findActivePlatformSenderAssignments(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  workspaceId?: string;
}): Promise<
  Array<{
    id: string;
    workspaceId: string;
    conversationId: string | null;
    lastUsedAt: Date;
  }>
> {
  const consumerE164 = normalizeMctbCallerE164(input.consumerE164);
  const prisma = getPrisma();
  const now = new Date();
  await releaseExpiredActiveAssignments({
    consumerE164,
    platformPhoneNumberId: input.platformPhoneNumberId,
    now,
  });
  return prisma.mctbPlatformSenderAssignment.findMany({
    where: {
      consumerE164,
      platformPhoneNumberId: input.platformPhoneNumberId,
      state: "ACTIVE",
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    select: { id: true, workspaceId: true, conversationId: true, lastUsedAt: true },
    orderBy: { lastUsedAt: "desc" },
  });
}

/** Single active row when unambiguous (one workspace or workspace scoped). */
export async function findActivePlatformSenderAssignment(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  workspaceId?: string;
}): Promise<{
  id: string;
  workspaceId: string;
  conversationId: string | null;
} | null> {
  const rows = await findActivePlatformSenderAssignments(input);
  if (rows.length === 1) {
    const row = rows[0]!;
    return { id: row.id, workspaceId: row.workspaceId, conversationId: row.conversationId };
  }
  if (input.workspaceId && rows.length > 0) {
    const row = rows[0]!;
    return { id: row.id, workspaceId: row.workspaceId, conversationId: row.conversationId };
  }
  return null;
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
      where: {
        workspaceId: input.workspaceId,
        consumerE164,
        platformPhoneNumberId,
        state: "ACTIVE",
      },
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
        where: {
          workspaceId: input.workspaceId,
          consumerE164,
          platformPhoneNumberId,
          state: "ACTIVE",
        },
      });
      if (!winner) {
        throw err;
      }
      return {
        status: "REUSED" as const,
        assignmentId: winner.id,
        platformPhoneNumberId,
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
  const activeRows = await findActivePlatformSenderAssignments({
    consumerE164,
    platformPhoneNumberId: input.platformSender.phoneNumberId,
  });

  if (activeRows.length === 1) {
    const active = activeRows[0]!;
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

  if (activeRows.length > 1) {
    logAssignmentDecision({
      decision: "INBOUND_AMBIGUOUS_ASSIGNMENTS",
      consumerE164,
      platformPhoneNumberId: input.platformSender.phoneNumberId,
      workspaceIds: activeRows.map((r) => r.workspaceId),
    });
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
