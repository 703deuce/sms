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
  const config = await getNoShowRecoveryConfig(workspaceId);
  const [noShows, workflowInstalled, recentRows] = await Promise.all([
    prisma.voiceAppointment.count({
      where: { workspaceId, status: "no_show", startsAt: { gte: since } },
    }),
    listAppointmentWorkflows(workspaceId).then((wfs) =>
      wfs.some((w) => w.templateId === "no_show_recovery" && w.active),
    ),
    prisma.voiceAppointment.findMany({
      where: { workspaceId, status: "no_show" },
      orderBy: { startsAt: "desc" },
      take: 25,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        status: true,
        metadata: true,
        staffName: true,
      },
    }),
  ]);
  const recentNoShows = recentRows.map((row) => {
    const meta = (row.metadata || {}) as { inviteeName?: string };
    return {
      id: row.id,
      customerName: meta.inviteeName || "Guest",
      serviceName: row.serviceName || "Appointment",
      startsAt: row.startsAt.toISOString(),
      status: row.status,
      staffName: row.staffName || null,
      recoveryStatus: "pending" as const,
    };
  });
  const lastScanAt = config.lastScanAt
    ? new Date(config.lastScanAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";
  return {
    noShowsLast30Days: noShows,
    recoveredBookings: 0,
    workflowInstalled,
    lastScanAt,
    recentNoShows,
  };
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
