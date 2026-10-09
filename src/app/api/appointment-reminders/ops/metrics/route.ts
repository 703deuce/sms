import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { microsoftCalendarReconcileIntervalMinutes } from "@/lib/calendar/microsoft-schedule-config";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";

export async function GET() {
  const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
  if ("error" in auth) return auth.error;
  const prisma = getPrisma();
  const now = new Date();

  const [
    msConnected,
    msOverdueSync,
    msOverdueRenew,
    reminderPending,
    reminderUnknown,
    oldestReminderPending,
  ] = await Promise.all([
    prisma.voiceCalendarConnection.count({
      where: { provider: "microsoft", status: "connected" },
    }),
    prisma.voiceCalendarConnection.count({
      where: {
        provider: "microsoft",
        status: { in: ["connected", "needs_reauth"] },
        OR: [{ nextSyncDueAt: null }, { nextSyncDueAt: { lte: now } }],
      },
    }),
    prisma.voiceCalendarConnection.count({
      where: {
        provider: "microsoft",
        status: "connected",
        OR: [{ subscriptionRenewDueAt: null }, { subscriptionRenewDueAt: { lte: now } }],
      },
    }),
    prisma.arReminderDispatch.count({ where: { status: { in: ["pending", "claimed", "submitting"] } } }),
    prisma.arReminderDispatch.count({ where: { status: "unknown" } }),
    prisma.arReminderDispatch.findFirst({
      where: { status: "pending" },
      orderBy: { intendedFireAt: "asc" },
      select: { intendedFireAt: true },
    }),
  ]);

  const maintenanceBacklog = await prisma.jobQueue.count({
    where: {
      queueName: "maintenance",
      status: { in: ["pending", "deferred", "processing"] },
    },
  });

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    microsoft: {
      connected: msConnected,
      overdueSync,
      overdueSubscriptionRenew: msOverdueRenew,
      reconcileIntervalMinutes: microsoftCalendarReconcileIntervalMinutes(),
    },
    reminders: {
      pendingDispatch: reminderPending,
      unknownSubmissions: reminderUnknown,
      oldestPendingFireAt: oldestReminderPending?.intendedFireAt?.toISOString() || null,
    },
    queues: { maintenanceBacklog },
  });
}
