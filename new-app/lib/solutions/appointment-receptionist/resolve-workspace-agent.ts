import "server-only";

import { getPrisma } from "@/lib/server/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/from-published-agent";
import type { CanonicalVoiceV3WorkspaceAgent } from "@/lib/voice-v3/canonical-workspace-agent";

/**
 * Workspace receptionist for UI/setup load — prefers canonical cert agent, then
 * newest appointment-receptionist VoiceAgent. Does not affect call-handling ownership.
 */
export async function resolveWorkspaceAppointmentReceptionistAgent(
  workspaceId: string,
): Promise<CanonicalVoiceV3WorkspaceAgent | null> {
  const { resolveCanonicalVoiceV3WorkspaceAgent } = await import(
    "@/lib/voice-v3/canonical-workspace-agent"
  );
  const canonical = await resolveCanonicalVoiceV3WorkspaceAgent(workspaceId);
  if (canonical) return canonical;

  const prisma = getPrisma();
  const candidates = await prisma.voiceAgent.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      name: true,
      displayName: true,
      status: true,
      publishedVersionId: true,
      phoneNumberId: true,
      draftConfig: true,
      updatedAt: true,
    },
  });

  type Row = (typeof candidates)[number];
  const receptionistRows: Row[] = [];
  for (const row of candidates) {
    const config = parseVoiceAgentConfig(row.draftConfig);
    if (isAppointmentReceptionistAgent(config)) receptionistRows.push(row);
  }
  if (!receptionistRows.length) return null;

  receptionistRows.sort((a, b) => {
    const score = (r: Row) =>
      (r.status === "ACTIVE" ? 100 : 0) + (r.publishedVersionId ? 10 : 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const row = receptionistRows[0];
  let primaryPhoneE164: string | null = null;
  if (row.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: row.phoneNumberId, workspaceId },
      select: { e164: true },
    });
    primaryPhoneE164 = pn?.e164 ?? null;
  }

  return {
    agentId: row.id,
    agentName: row.displayName || row.name,
    status: row.status,
    published: Boolean(row.publishedVersionId),
    primaryPhoneNumberId: row.phoneNumberId,
    primaryPhoneE164,
  };
}
