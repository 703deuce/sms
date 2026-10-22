import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import { isDemoFixturePhoneId } from "@/lib/server/receptionist/phone-fixture-ids";

export { isDemoFixturePhoneId };

export async function resolveWorkspaceOwnedPhoneNumberId(
  workspaceId: string,
  connection: AgentConfig["connection"],
): Promise<string | null> {
  if (connection.kind !== "owned") return null;
  const id = connection.id?.trim();
  if (!id) return null;
  if (isDemoFixturePhoneId(id)) {
    throw new Error(
      "The receptionist draft uses a demo placeholder number. On Agent settings, use Connect number and pick a line from your workspace.",
    );
  }
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id, workspaceId, status: "Active" },
    select: { id: true },
  });
  if (!phone) {
    throw new Error("Selected phone number was not found in this workspace. Re-select it on Agent settings (Connect number).");
  }
  return phone.id;
}
