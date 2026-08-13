import { getPrisma } from "@/lib/db";

/** Most relevant voice agent for sidebar deep-links (active → testing → draft). */
export async function loadPrimaryVoiceAgentId(workspaceId: string): Promise<string | null> {
  const prisma = getPrisma();
  const rows = await prisma.voiceAgent.findMany({
    where: {
      workspaceId,
      status: { not: "ARCHIVED" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, updatedAt: true },
    take: 20,
  });
  if (!rows.length) return null;

  const rank = (status: string) => {
    if (status === "ACTIVE") return 0;
    if (status === "TESTING") return 1;
    if (status === "DRAFT") return 2;
    if (status === "PAUSED") return 3;
    return 4;
  };

  const best = [...rows].sort((a, b) => {
    const dr = rank(a.status) - rank(b.status);
    if (dr !== 0) return dr;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];

  return best?.id ?? null;
}

/** Agent id from `/voice/agents/[id]/…` (not `new`). */
export function voiceAgentIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/voice\/agents\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === "new") return null;
  return id;
}

/** Receptionist wizard step slugs under `/voice/agents/[id]/…`. */
export function receptionistStepFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/voice\/agents\/[^/]+\/([^/]+)/);
  return match?.[1] ?? null;
}
