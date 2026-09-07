import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";
import { listAppointments } from "@/lib/appointments/appointments-service";

export async function loadAppointmentsOverview(workspaceId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const today = await listAppointments(workspaceId, {
    from: startOfDay,
    to: endOfDay,
    take: 100,
  });

  const upcoming = await listAppointments(workspaceId, {
    from: now,
    take: 20,
  });

  const normalized = (status: string) => status.toLowerCase();
  const inactiveStatuses = new Set(["canceled", "cancelled", "completed", "no_show"]);
  // Count in memory — PostgREST compat does not support metadata JSON path filters.
  const reminderFailed = today.filter(
    (a: DbRow) =>
      !inactiveStatuses.has(normalized(a.status)) &&
      normalized(a.reminderStatus || "") === "failed",
  ).length;

  const counts = {
    todayTotal: today.length,
    confirmed: today.filter((a: DbRow) => normalized(a.status) === "confirmed").length,
    awaitingConfirmation: today.filter((a: DbRow) =>
      ["awaiting_confirmation", "scheduled"].includes(normalized(a.status)),
    ).length,
    pendingApproval: today.filter(
      (a: DbRow) =>
        (a.metadata as { pendingApproval?: boolean })?.pendingApproval === true &&
        !inactiveStatuses.has(normalized(a.status)),
    ).length,
    rescheduleRequested: today.filter((a: DbRow) => normalized(a.status) === "reschedule_requested")
      .length,
    unreadConversations: await prisma.conversation.count({
      where: { workspaceId, unread: true },
    }),
    reminderFailed,
  };

  const pendingApproval = upcoming.filter(
    (a: DbRow) =>
      (a.metadata as { pendingApproval?: boolean })?.pendingApproval === true &&
      !inactiveStatuses.has(normalized(a.status)),
  );

  const needsAttention = [
    ...pendingApproval.slice(0, 5).map((a: DbRow) => ({
      id: a.id,
      kind: "pending_approval" as const,
      label: `${a.inviteeName || "Customer"} — ${a.serviceName || "Appointment"} (approval required)`,
      href: `/appointments/${a.id}`,
    })),
    ...upcoming
      .filter((a: DbRow) => ["awaiting_confirmation", "scheduled"].includes(normalized(a.status)))
      .slice(0, 5)
      .map((a: DbRow) => ({
        id: a.id,
        kind: "awaiting_confirmation" as const,
        label: `${a.inviteeName || "Customer"} — ${a.serviceName || "Appointment"}`,
        href: `/appointments/${a.id}`,
      })),
    ...upcoming
      .filter((a: DbRow) => normalized(a.status) === "reschedule_requested")
      .slice(0, 5)
      .map((a: DbRow) => ({
        id: a.id,
        kind: "reschedule_requested" as const,
        label: `${a.inviteeName || "Customer"} requested reschedule`,
        href: `/appointments/${a.id}`,
      })),
    ...(reminderFailed > 0
      ? [
          {
            id: "reminder-failed",
            kind: "reminder_failed" as const,
            label: `${reminderFailed} reminder${reminderFailed === 1 ? "" : "s"} failed`,
            href: "/appointments/reminders",
          },
        ]
      : []),
  ];

  const recentConversations = await prisma.conversation.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });

  return {
    counts,
    todayAppointments: today.sort(
      (a: DbRow, b: DbRow) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    ),
    upcomingAppointments: upcoming.slice(0, 8),
    needsAttention,
    recentConversations: recentConversations.map((c: DbRow) => ({
      id: c.id,
      name:
        `${c.contact?.firstName || ""} ${c.contact?.lastName || ""}`.trim() ||
        c.contact?.phone ||
        "Customer",
      preview: c.messages[0]?.body?.slice(0, 120) || "",
      updatedAt: c.updatedAt.toISOString(),
      unread: c.unread,
    })),
  };
}
