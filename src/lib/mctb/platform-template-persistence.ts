import { getPrisma } from "@/lib/db";
import { migrateLegacyPlatformRecoveryTemplateId } from "@/lib/mctb/first-text-templates/registry";
import type { MctbFirstTextTemplateId } from "@/lib/mctb/first-text-templates/types";
import { listMctbPlatformRecoveryOpenerChoices } from "@/lib/mctb/platform-recovery-template-choices";
import {
  defaultMctbFirstTextTemplateConfig,
  readMctbFirstTextTemplateConfig,
  writeMctbFirstTextTemplateConfig,
} from "@/lib/mctb/first-text-templates/persistence";

export async function readMctbPlatformRecoveryTemplateId(
  workspaceId: string,
): Promise<MctbFirstTextTemplateId> {
  const config = await readMctbFirstTextTemplateConfig(workspaceId);
  return config.templateId;
}

export async function writeMctbPlatformRecoveryTemplateId(
  workspaceId: string,
  templateId: MctbFirstTextTemplateId,
): Promise<void> {
  const allowed = new Set(listMctbPlatformRecoveryOpenerChoices().map((c) => c.id));
  const normalized = migrateLegacyPlatformRecoveryTemplateId(templateId);
  if (!allowed.has(normalized)) {
    throw new Error("Template is not an approved platform recovery opener.");
  }
  const existing = await readMctbFirstTextTemplateConfig(workspaceId);
  await writeMctbFirstTextTemplateConfig(workspaceId, {
    ...existing,
    templateId: normalized,
  });
}

/** @deprecated legacy import sites — prefer readMctbFirstTextTemplateConfig */
export async function readMctbPlatformRecoveryTemplateIdLegacyRaw(
  workspaceId: string,
): Promise<string> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>).mctb
      : null;
  const raw =
    mctb && typeof mctb === "object"
      ? String((mctb as Record<string, unknown>).platformRecoveryTemplateId || "")
      : "";
  return raw || "simple";
}

export async function writeMctbPlatformRecoveryTemplateIdOnly(
  workspaceId: string,
  templateId: MctbFirstTextTemplateId,
): Promise<void> {
  const next = defaultMctbFirstTextTemplateConfig(templateId);
  const existing = await readMctbFirstTextTemplateConfig(workspaceId);
  await writeMctbFirstTextTemplateConfig(workspaceId, {
    ...next,
    ...existing,
    templateId,
  });
}
