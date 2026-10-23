import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/server/db";
import { getMembershipForUser, isPowerDialerAdminRole } from "./campaign-access";
import { auditComplianceDecision } from "./compliance-gates";

const COOKIE_NAME = "pd_impersonation_session";

function roleRank(role: string): number {
  if (role === "OWNER" || role === "ADMINISTRATOR") return 3;
  if (role === "MANAGER") return 2;
  return 1;
}

export function canImpersonate(actorRole: string, targetRole: string): boolean {
  if (actorRole === targetRole) return false;
  return roleRank(actorRole) > roleRank(targetRole);
}

export async function startImpersonation(input: {
  workspaceId: string;
  actorUserId: string;
  targetUserId: string;
}) {
  const actorMem = await getMembershipForUser(input.workspaceId, input.actorUserId);
  const targetMem = await getMembershipForUser(input.workspaceId, input.targetUserId);
  if (!actorMem || !targetMem) throw new Error("Not authorized for this workspace");
  if (!isPowerDialerAdminRole(actorMem.role) && actorMem.role !== "MANAGER") {
    throw new Error("Only managers and admins may impersonate");
  }
  if (!canImpersonate(actorMem.role, targetMem.role)) {
    throw new Error("Cannot impersonate a user with equal or higher role");
  }

  const prisma = getPrisma();
  await prisma.powerDialerImpersonationSession.updateMany({
    where: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      endedAt: null,
    },
    data: { endedAt: new Date(), endReason: "replaced" },
  });

  const session = await prisma.powerDialerImpersonationSession.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    },
  });

  await auditComplianceDecision({
    workspaceId: input.workspaceId,
    action: "impersonation_started",
    actorUserId: input.actorUserId,
    detail: { sessionId: session.id, targetUserId: input.targetUserId },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return session;
}

export async function stopImpersonation(input: {
  workspaceId: string;
  actorUserId: string;
  reason?: string;
}) {
  const prisma = getPrisma();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  const session = sessionId
    ? await prisma.powerDialerImpersonationSession.findFirst({
        where: {
          id: sessionId,
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          endedAt: null,
        },
      })
    : await prisma.powerDialerImpersonationSession.findFirst({
        where: {
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          endedAt: null,
        },
        orderBy: { startedAt: "desc" },
      });

  if (!session) return null;
  await prisma.powerDialerImpersonationSession.update({
    where: { id: session.id },
    data: { endedAt: new Date(), endReason: input.reason || "stopped" },
  });
  cookieStore.delete(COOKIE_NAME);
  await auditComplianceDecision({
    workspaceId: input.workspaceId,
    action: "impersonation_stopped",
    actorUserId: input.actorUserId,
    detail: { sessionId: session.id, targetUserId: session.targetUserId },
  });
  return session;
}

export async function getActiveImpersonation(input: {
  workspaceId: string;
  actorUserId: string;
}) {
  const prisma = getPrisma();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return prisma.powerDialerImpersonationSession.findFirst({
    where: {
      id: sessionId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      endedAt: null,
    },
  });
}

export type ActorContext = {
  actorUserId: string;
  effectiveUserId: string;
  impersonationSessionId: string | null;
};

export async function resolveActorContext(
  workspaceId: string,
  realUserId: string,
): Promise<ActorContext> {
  const active = await getActiveImpersonation({ workspaceId, actorUserId: realUserId });
  if (!active) {
    return { actorUserId: realUserId, effectiveUserId: realUserId, impersonationSessionId: null };
  }
  return {
    actorUserId: realUserId,
    effectiveUserId: active.targetUserId,
    impersonationSessionId: active.id,
  };
}

export async function logImpersonatedPowerDialerAction(input: {
  workspaceId: string;
  actorUserId: string;
  impersonationSessionId: string | null;
  impersonatedUserId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}) {
  if (!input.impersonationSessionId) return;
  await auditComplianceDecision({
    workspaceId: input.workspaceId,
    action: input.action,
    actorUserId: input.actorUserId,
    detail: {
      impersonationSessionId: input.impersonationSessionId,
      impersonatedUserId: input.impersonatedUserId,
      ...input.detail,
    },
  });
}
