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
      "Call Handling uses a demo placeholder number. Choose a real number from your workspace inventory.",
    );
  }
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id, workspaceId, status: "Active" },
    select: { id: true },
  });
  if (!phone) {
    throw new Error("Selected phone number was not found in this workspace. Re-select it in Call Handling.");
  }
  return phone.id;
}
