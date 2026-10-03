import "server-only";

import { getPrisma } from "@/lib/db";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";

/**
 * MCTB V1 uses BUSINESS workspaces only. Upgrade legacy PERSONAL rows in-place
 * when the customer enters MCTB bootstrap (no separate Personal product).
 */
export async function ensureBusinessWorkspaceForMctb(workspaceId: string): Promise<void> {
  if (!isMctbV1Primary()) return;
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true, name: true },
  });
  if (!ws || ws.type !== "PERSONAL") return;
  const name =
    ws.name.trim() && ws.name.trim().toLowerCase() !== "personal"
      ? ws.name.trim()
      : "Business";
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { type: "BUSINESS", name },
  });
}
