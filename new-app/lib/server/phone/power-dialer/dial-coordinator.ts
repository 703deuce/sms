import { getPrisma } from "@/lib/server/db";
import { readSessionAgentMedia } from "./session-agent-media";
import { readSharedIosAgentLeg } from "./ios-shared-agent-leg";

/** Authoritative session dialing state — always from Postgres (no process-local cache). */
export async function loadDialCoordinatorState(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: {
      id: true,
      status: true,
      parallelStateJson: true,
      currentAttemptId: true,
    },
  });
  if (!session) return null;

  const parallelState =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};

  const liveAttempts = await prisma.powerDialerAttempt.count({
    where: {
      sessionId,
      workspaceId,
      status: { in: ["pending", "dialing", "ringing", "answered"] },
    },
  });

  const agentMedia = readSessionAgentMedia(session.parallelStateJson);
  const sharedAgent = readSharedIosAgentLeg(session.parallelStateJson);

  return {
    sessionId: session.id,
    sessionStatus: session.status,
    agentMediaReady: agentMedia.agentMediaReady,
    sharedAgentCallControlId: sharedAgent?.agentCallControlId ?? null,
    winnerAttemptId:
      typeof parallelState.winnerAttemptId === "string" ? parallelState.winnerAttemptId : null,
    liveAttemptCount: liveAttempts,
    currentAttemptId: session.currentAttemptId,
  };
}
