import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { assertRepAuthorized } from "./session-runtime";

export type SessionPresetConfig = {
  campaignId?: string;
  dialingMode?: "power" | "preview";
  callerIdPhoneNumberId?: string | null;
  phoneFieldPriority?: string[];
};

export async function listSessionPresets(workspaceId: string) {
  const userId = await resolveInternalUserId();
  await assertRepAuthorized(workspaceId);
  const prisma = getPrisma();
  const rows = await prisma.powerDialerSessionPreset.findMany({
    where: {
      workspaceId,
      OR: [{ scope: "workspace" }, { ownerUserId: userId }],
    },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    ownerUserId: r.ownerUserId,
    config: r.configJson as SessionPresetConfig,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function saveSessionPreset(
  workspaceId: string,
  input: { id?: string; name: string; scope: "user" | "workspace"; config: SessionPresetConfig },
) {
  const userId = await resolveInternalUserId();
  await assertRepAuthorized(workspaceId);
  const prisma = getPrisma();
  const name = input.name.trim();
  if (!name) throw new Error("Preset name is required");
  if (input.scope === "workspace") {
    const membership = await prisma.membership.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    if (!membership || !["OWNER", "ADMINISTRATOR", "MANAGER"].includes(membership.role)) {
      throw new Error("Only managers can save workspace presets");
    }
  }
  const data = {
    workspaceId,
    name,
    scope: input.scope,
    ownerUserId: input.scope === "user" ? userId : null,
    configJson: input.config as import("@prisma/client").Prisma.InputJsonValue,
  };
  if (input.id) {
    const existing = await prisma.powerDialerSessionPreset.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Preset not found");
    if (existing.scope === "user" && existing.ownerUserId !== userId) {
      throw new Error("Not allowed to edit this preset");
    }
    return prisma.powerDialerSessionPreset.update({ where: { id: input.id }, data });
  }
  return prisma.powerDialerSessionPreset.create({ data });
}

export async function deleteSessionPreset(workspaceId: string, presetId: string) {
  const userId = await resolveInternalUserId();
  await assertRepAuthorized(workspaceId);
  const prisma = getPrisma();
  const row = await prisma.powerDialerSessionPreset.findFirst({
    where: { id: presetId, workspaceId },
  });
  if (!row) throw new Error("Preset not found");
  if (row.scope === "user" && row.ownerUserId !== userId) {
    throw new Error("Not allowed to delete this preset");
  }
  if (row.scope === "workspace") {
    const membership = await prisma.membership.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    if (!membership || !["OWNER", "ADMINISTRATOR", "MANAGER"].includes(membership.role)) {
      throw new Error("Only managers can delete workspace presets");
    }
  }
  await prisma.powerDialerSessionPreset.delete({ where: { id: presetId } });
}
