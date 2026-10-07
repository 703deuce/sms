import { getPrisma } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { buildDedicatedReminderTimeline } from "@/lib/appointments/reminder-engine";
import {
  isSmsReminderTimelineEvent,
  mapSmsReminderTimelineOutcome,
} from "@/lib/appointment-reminders/sms-reminder-timeline";
import { listEnabledReminderSteps } from "@/lib/appointments/reminders/reminders-config";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const prisma = getPrisma();
    const { getMerchantPaymentStatus } = await import("@/lib/merchant-payments/service");
    const [platform, types, appointments, merchantStatus] = await Promise.all([
      loadAppointmentPlatformConfig(workspaceId),
      listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
      prisma.voiceAppointment.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 120,
        select: {
          id: true,
          serviceName: true,
          startsAt: true,
          status: true,
          metadata: true,
          contactId: true,
        },
      }),
      getMerchantPaymentStatus(workspaceId).catch(() => null),
    ]);

    const steps = listEnabledReminderSteps(platform);
    const channels = new Set(steps.map((s) => s.step.channel));
    const channelLabel = [...channels].map((c) => c.toUpperCase()).join(" + ") || "—";

    const activity: Array<{
      id: string;
      at: string;
      customerLabel: string;
      bookingLabel: string;
      reminderLabel: string;
      channel: string;
      status: string;
      detail?: string;
      appointmentId: string;
    }> = [];

    const now = Date.now();
    let scheduledCount = 0;
    let sentToday = 0;
    let failed7d = 0;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    for (const row of appointments) {
      const meta = (row.metadata || {}) as AppointmentMetadata;
      const timeline = buildDedicatedReminderTimeline(meta);
      const customerLabel = (meta.inviteeName as string) || "Customer";
      const bookingLabel = `${row.serviceName || "Appointment"} · ${row.startsAt.toISOString().slice(0, 10)}`;

      for (const ev of timeline) {
        if (!isSmsReminderTimelineEvent(ev.type)) continue;
        const outcome = mapSmsReminderTimelineOutcome(ev.type);
        const status =
          outcome.status === "failed"
            ? "Failed"
            : outcome.status === "skipped"
              ? "Skipped"
              : outcome.status === "sent" || outcome.status === "delivered"
                ? "Sent"
                : outcome.statusLabel;
        if (status === "Failed" && new Date(ev.at || row.startsAt).getTime() > now - 7 * 86400000) {
          failed7d += 1;
        }
        if (
          (outcome.status === "sent" || outcome.status === "delivered") &&
          ev.at &&
          new Date(ev.at) >= dayStart
        ) {
          sentToday += 1;
        }
        activity.push({
          id: `${row.id}-${ev.type}-${ev.at || ""}`,
          at: ev.at || row.startsAt.toISOString(),
          customerLabel,
          bookingLabel,
          reminderLabel: ev.label || ev.type,
          channel: ev.type.includes("email") ? "Email" : "SMS",
          status,
          detail: ev.detail,
          appointmentId: row.id,
        });
      }

      if (
        row.startsAt.getTime() > now &&
        !meta.remindersSuppressed &&
        !["canceled", "cancelled", "completed", "no_show"].includes(row.status)
      ) {
        scheduledCount += steps.filter((s) => !s.immediate).length;
      }
    }

    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const offerings = types.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.config?.bookingTypeKind || "SERVICE",
      sequenceLabel: "Default",
      stepCount: steps.length,
      channels: channelLabel,
      status: "Active",
    }));

    const smsReady = Boolean(
      merchantStatus &&
        (merchantStatus as { sms?: { ready?: boolean } }).sms?.ready !== false,
    );
    const emailReady = true;

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
      steps: steps.map((s) => ({
        id: s.id,
        label: s.step.label,
        channel: s.step.channel,
        minutesBefore: s.minutesBefore,
        immediate: Boolean(s.immediate),
        enabled: s.step.enabled,
      })),
      offerings,
      activity: activity.slice(0, 80),
      readiness: {
        sms: smsReady ? "Ready" : "Needs setup",
        email: emailReady ? "Ready" : "Unavailable",
      },
      timezone: platform.timezone,
    };
  });
}
