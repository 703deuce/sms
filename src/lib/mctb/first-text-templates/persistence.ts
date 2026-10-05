import { getPrisma } from "@/lib/db";
import {
  defaultMctbFirstTextTemplateConfig,
  readMctbFirstTextTemplateConfigFromMctbFields,
} from "./config-defaults";
import type { MctbFirstTextTemplateConfig } from "./types";

export {
  defaultMctbFirstTextTemplateConfig,
  parseMctbFirstTextTemplateConfig,
  readMctbFirstTextTemplateConfigFromMctbFields,
} from "./config-defaults";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function readMctbFirstTextTemplateConfig(
  workspaceId: string,
): Promise<MctbFirstTextTemplateConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb = asRecord(asRecord(ws?.customFieldsConfig).mctb);
  return readMctbFirstTextTemplateConfigFromMctbFields(mctb);
}

export async function writeMctbFirstTextTemplateConfig(
  workspaceId: string,
  config: MctbFirstTextTemplateConfig,
): Promise<void> {
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
        mctb: {
          ...mctb,
          firstTextTemplate: config,
          platformRecoveryTemplateId: config.templateId,
        },
      },
    },
  });
}
