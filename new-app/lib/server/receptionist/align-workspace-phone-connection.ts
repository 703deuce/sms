import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import { isDemoFixturePhoneId } from "@/lib/server/receptionist/phone-fixture-ids";
import { resolveWorkspaceOwnedPhoneNumberId } from "@/lib/server/receptionist/validate-phone-connection";

async function workspaceActiveOwnedPhoneId(workspaceId: string): Promise<string | null> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { activeFromNumberId: true },
  });
  const candidate = workspace?.activeFromNumberId?.trim();
  if (!candidate) return null;
  try {
    return await resolveWorkspaceOwnedPhoneNumberId(workspaceId, {
      kind: "owned",
      id: candidate,
    });
  } catch {
    return null;
  }
}

async function connectionResolvesInWorkspace(
  workspaceId: string,
  connection: AgentConfig["connection"],
): Promise<boolean> {
  if (connection.kind !== "owned") return false;
  const id = connection.id?.trim();
  if (!id || isDemoFixturePhoneId(id)) return false;
  try {
    await resolveWorkspaceOwnedPhoneNumberId(workspaceId, connection);
    return true;
  } catch {
    return false;
  }
}

/**
 * Phone → Call Forwarding uses workspace.activeFromNumberId; receptionist draft may still
 * point at demo fixture ids (n1) after a fresh DB. Align draft connection for UI + publish.
 */
export async function alignEditorConnectionFromWorkspace(
  workspaceId: string,
  editor: AgentConfig,
): Promise<AgentConfig> {
  if (await connectionResolvesInWorkspace(workspaceId, editor.connection)) {
    return editor;
  }

  const phoneNumberId = await workspaceActiveOwnedPhoneId(workspaceId);
  if (!phoneNumberId) return editor;

  return {
    ...editor,
    connection: { kind: "owned", id: phoneNumberId },
  };
}
