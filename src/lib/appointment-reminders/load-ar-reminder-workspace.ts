import "server-only";

import { getPrisma } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { buildDedicatedReminderTimeline } from "@/lib/appointments/reminder-engine";
import {
  isSmsReminderTimelineEvent,
  mapSmsReminderTimelineOutcome,
} from "@/lib/appointment-reminders/sms-reminder-timeline";
import { listEnabledReminderSteps } from "@/lib/appointments/reminders/reminders-config";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { getArSmsUsageSnapshot } from "@/lib/appointment-reminders/ar-sms-usage";

export async function loadArReminderWorkspacePanel(workspaceId: string) {
  const prisma = getPrisma();
  const { getMerchantPaymentStatus } = await import("@/lib/merchant-payments/service");
  const [platform, types, appointments, merchantStatus, smsUsage] = await Promise.all([
    loadAppointmentPlatformConfig(workspaceId),
    listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
    prisma.voiceAppointment.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        status: true,
        metadata: true,
      },
    }),
    getMerchantPaymentStatus(workspaceId).catch(() => null),
    getArSmsUsageSnapshot(workspaceId),
  ]);

  const steps = listEnabledReminderSteps(platform);
  const channels = new Set(steps.map((s) => s.step.channel));
  const channelLabel = [...channels].map((c) => c.toUpperCase()).join(" + ") || "—";

  const now = Date.now();
  let scheduledCount = 0;
  let sentToday = 0;
  let failed7d = 0;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const timeline = buildDedicatedReminderTimeline(meta);

    for (const ev of timeline) {
      if (!isSmsReminderTimelineEvent(ev.type)) continue;
      const outcome = mapSmsReminderTimelineOutcome(ev.type);
      if (outcome.status === "failed" && new Date(ev.at || row.startsAt).getTime() > now - 7 * 86400000) {
        failed7d += 1;
      }
      if (
        (outcome.status === "sent" || outcome.status === "delivered") &&
        ev.at &&
        new Date(ev.at) >= dayStart
      ) {
        sentToday += 1;
      }
    }

    if (
      row.startsAt.getTime() > now &&
      !meta.remindersSuppressed &&
      !["canceled", "cancelled", "completed", "no_show"].includes(row.status)
    ) {
      scheduledCount += steps.filter((s) => !s.immediate).length;
    }
  }

  const smsReady = Boolean(
    merchantStatus && (merchantStatus as { sms?: { ready?: boolean } }).sms?.ready !== false,
  );

  return {
    stats: {
      activeSteps: steps.length,
      channels: channelLabel,
      offeringsCount: types.length,
      coveragePercent: 100,
      scheduledCount,
      sentToday,
      failed7d,
    },
    readiness: {
      sms: smsReady ? "Ready" : "Needs setup",
      email: "Ready",
    },
    smsUsage: {
      usedInPeriod: smsUsage.usedInPeriod,
      limit: smsUsage.limit,
      atLimit: smsUsage.atLimit,
      periodKey: smsUsage.periodKey,
      meteringActive: smsUsage.meteringActive,
      limitSource: smsUsage.limitSource,
    },
    timezone: platform.timezone,
  };
}
