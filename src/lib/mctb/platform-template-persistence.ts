import { getPrisma } from "@/lib/db";
import type { MctbPlatformTemplateId } from "@/lib/mctb/platform-message-templates";
import { listMctbPlatformRecoveryOpenerChoices } from "@/lib/mctb/platform-recovery-template-choices";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function readMctbPlatformRecoveryTemplateId(
  workspaceId: string,
): Promise<MctbPlatformTemplateId> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb = asRecord(asRecord(ws?.customFieldsConfig).mctb);
  const raw = String(mctb.platformRecoveryTemplateId || "recovery_opener");
  const allowed = new Set(listMctbPlatformRecoveryOpenerChoices().map((c) => c.id));
  if (allowed.has(raw as MctbPlatformTemplateId)) {
    return raw as MctbPlatformTemplateId;
  }
  return "recovery_opener";
}

export async function writeMctbPlatformRecoveryTemplateId(
  workspaceId: string,
  templateId: MctbPlatformTemplateId,
): Promise<void> {
  const allowed = new Set(listMctbPlatformRecoveryOpenerChoices().map((c) => c.id));
  if (!allowed.has(templateId)) {
    throw new Error("Template is not an approved platform recovery opener.");
  }
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const cfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: { ...mctb, platformRecoveryTemplateId: templateId },
      },
    },
  });
}
