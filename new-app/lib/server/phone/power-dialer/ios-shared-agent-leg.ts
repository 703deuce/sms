import { getPrisma } from "@/lib/server/db";

export type SharedIosAgentLeg = {
  agentCallControlId: string;
  anchorHumanCallId?: string;
};

export function readSharedIosAgentLeg(
  parallelStateJson: unknown,
): SharedIosAgentLeg | null {
  if (!parallelStateJson || typeof parallelStateJson !== "object") return null;
  const row = parallelStateJson as Record<string, unknown>;
  const id = row.sharedIosAgentCallControlId;
  if (typeof id !== "string" || !id.trim()) return null;
  return {
    agentCallControlId: id.trim(),
    anchorHumanCallId:
      typeof row.sharedIosAgentHumanCallId === "string"
        ? row.sharedIosAgentHumanCallId
        : undefined,
  };
}

export async function persistSharedIosAgentLeg(input: {
  sessionId: string;
  workspaceId: string;
  agentCallControlId: string;
  anchorHumanCallId: string;
}) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    select: { parallelStateJson: true },
  });
  if (!session) return;
  const prev =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  await prisma.powerDialerSession.update({
    where: { id: input.sessionId },
    data: {
      parallelStateJson: {
        ...prev,
        sharedIosAgentCallControlId: input.agentCallControlId,
        sharedIosAgentHumanCallId: input.anchorHumanCallId,
      },
    },
  });
}

export async function loadSharedIosAgentLegForAttempt(
  workspaceId: string,
  powerDialerAttemptId: string,
): Promise<SharedIosAgentLeg | null> {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: powerDialerAttemptId, workspaceId },
    select: { sessionId: true, session: { select: { parallelStateJson: true } } },
  });
  if (!attempt?.session) return null;
  return readSharedIosAgentLeg(attempt.session.parallelStateJson);
}
