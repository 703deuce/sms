import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { createAppointmentWorkflow, listAppointmentWorkflows } from "@/lib/appointment-workflows/service";
import { getPrebuiltTemplate } from "@/lib/appointment-workflows/templates";

export type NoShowRecoveryConfig = {
  enabled?: boolean;
  graceMinutes?: number;
  autoInstallWorkflow?: boolean;
  lastScanAt?: string;
  lastMarked?: number;
};

export async function getNoShowRecoveryConfig(workspaceId: string): Promise<NoShowRecoveryConfig> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { noShowRecovery?: NoShowRecoveryConfig }).noShowRecovery || {
    enabled: true,
    graceMinutes: 30,
    autoInstallWorkflow: true,
  };
}

export async function saveNoShowRecoveryConfig(workspaceId: string, config: NoShowRecoveryConfig) {
  await saveAppointmentPlatformConfig(workspaceId, { noShowRecovery: config } as object);
  return config;
}

export async function getNoShowRecoveryStats(workspaceId: string) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 30 * 86400000);
  const [noShows, workflowInstalled] = await Promise.all([
    prisma.voiceAppointment.count({
      where: { workspaceId, status: "no_show", startsAt: { gte: since } },
    }),
    listAppointmentWorkflows(workspaceId).then((wfs) =>
      wfs.some((w) => w.templateId === "no_show_recovery" && w.active),
    ),
  ]);
  return { noShowsLast30Days: noShows, recoveredBookings: 0, workflowInstalled };
}

export async function ensureNoShowRecoveryWorkflow(workspaceId: string) {
  const existing = await listAppointmentWorkflows(workspaceId);
  const installed = existing.find((w) => w.templateId === "no_show_recovery");
  if (installed) return installed;

  const template = getPrebuiltTemplate("no_show_recovery");
  if (!template) throw new Error("No-show recovery workflow template missing");

  return createAppointmentWorkflow(workspaceId, {
    name: template.name,
    sourceType: "template",
    templateId: template.id,
    active: true,
    trigger: template.trigger,
    channels: template.defaultChannels,
    conditions: template.defaultConditions,
    steps: template.defaultSteps,
  });
}

export async function runNoShowRecoveryScan(workspaceId: string) {
  const config = await getNoShowRecoveryConfig(workspaceId);
  const { scanAppointmentNoShows } = await import("@/lib/appointments/workflow-scanners");
  const result = await scanAppointmentNoShows(config.graceMinutes ?? 30);
  await saveNoShowRecoveryConfig(workspaceId, {
    ...config,
    lastScanAt: new Date().toISOString(),
    lastMarked: result.marked,
  });
  return result;
}
