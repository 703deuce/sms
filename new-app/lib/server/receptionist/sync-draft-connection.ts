import "server-only";

import {
  loadDraftFromAgent,
  saveDraftEnvelope,
} from "@/lib/server/receptionist/agent-store";
import { syncReceptionistPhoneAssignment } from "@/lib/server/receptionist/phone-assignment";
import { getPrisma } from "@/lib/server/db";

/**
 * After Numbers switches carrier ingress to a DID, align receptionist draft + DB
 * assignments with that phone (single default inbound number per agent).
 */
export async function syncReceptionistDraftConnectionOnNumberSwitch(
  workspaceId: string,
  agentId: string,
  phoneNumberId: string,
): Promise<void> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) return;

  const envelope = loadDraftFromAgent(agent);
  const editor = {
    ...envelope.editor,
    connection: { kind: "owned" as const, id: phoneNumberId },
  };

  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: {
      phoneNumberId,
      agentId: { not: agentId },
    },
  });

  await saveDraftEnvelope(agentId, workspaceId, { ...envelope, editor });
  await syncReceptionistPhoneAssignment(workspaceId, agentId, editor);
}
