import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import { alignEditorConnectionFromWorkspace } from "@/lib/server/receptionist/align-workspace-phone-connection";
import { resolveWorkspaceOwnedPhoneNumberId } from "@/lib/server/receptionist/validate-phone-connection";

/**
 * When the user switches Numbers (LiveKit ingress) but the saved draft still points at an
 * older DID, publish must not re-bind the agent to the stale connection.
 */
export async function newestActiveLiveKitPhoneId(workspaceId: string): Promise<string | null> {
  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: "Active" },
    select: { id: true, settingsJson: true },
  });

  let best: { id: string; ts: number } | null = null;
  for (const phone of phones) {
    const prov = readTelephonyProvision(phone.settingsJson);
    if (prov.routingMode !== "livekit_sip" || prov.state !== "active") continue;
    const ts = prov.lastProvisionedAt ? Date.parse(prov.lastProvisionedAt) : 0;
    if (!best || ts > best.ts) best = { id: phone.id, ts };
  }
  return best?.id ?? null;
}

export async function alignEditorConnectionForPublish(
  workspaceId: string,
  editor: AgentConfig,
): Promise<AgentConfig> {
  let aligned = await alignEditorConnectionFromWorkspace(workspaceId, editor);
  const ingressPhoneId = await newestActiveLiveKitPhoneId(workspaceId);
  if (!ingressPhoneId) return aligned;

  const currentId =
    aligned.connection.kind === "owned" ? aligned.connection.id?.trim() : "";
  if (currentId === ingressPhoneId) return aligned;

  try {
    await resolveWorkspaceOwnedPhoneNumberId(workspaceId, {
      kind: "owned",
      id: ingressPhoneId,
    });
  } catch {
    return aligned;
  }

  return {
    ...aligned,
    connection: { kind: "owned", id: ingressPhoneId },
  };
}
