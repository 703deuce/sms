import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { listRecallCampaigns } from "@/lib/appointments/recall-campaigns";

export type RecallDueStatus =
  | "upcoming"
  | "due"
  | "overdue"
  | "contacted"
  | "booked"
  | "dismissed";

export type RecallDueRow = {
  id: string;
  contactId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  lastAppointmentAt: string | null;
  serviceName: string | null;
  recommendedReturnAt: string;
  status: RecallDueStatus;
  statusLabel: string;
  dueReason: string;
  lastContactAt: string | null;
};

type DismissalMap = Record<string, string>;

async function loadDismissals(workspaceId: string): Promise<DismissalMap> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return ((platform as { recallDismissals?: DismissalMap }).recallDismissals || {}) as DismissalMap;
}

function formatDueLabel(status: RecallDueStatus, daysUntil: number): string {
  if (status === "dismissed") return "Dismissed";
  if (status === "booked") return "Booked";
  if (status === "contacted") return "Reminder sent";
  if (status === "due") return "Due today";
  if (status === "overdue") return `${Math.abs(daysUntil)} days overdue`;
  if (daysUntil === 1) return "Due tomorrow";
  return `Due ${new Date(Date.now() + daysUntil * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function computeStatus(
  daysUntil: number,
  dismissed: boolean,
  hasFutureBooking: boolean,
  contactedRecently: boolean,
): RecallDueStatus {
  if (dismissed) return "dismissed";
  if (hasFutureBooking) return "booked";
  if (contactedRecently && daysUntil >= 0) return "contacted";
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "due";
  return "upcoming";
}

export async function listRecallDueCustomers(workspaceId: string): Promise<RecallDueRow[]> {
  const prisma = getPrisma();
  const campaigns = await listRecallCampaigns(workspaceId);
  const active = campaigns.find((c) => c.active);
  const intervalDays = active?.segment?.lastVisitDaysAgo ?? 90;
  const serviceFilter = active?.segment?.appointmentTypeName;
  const dismissals = await loadDismissals(workspaceId);

  const appointments = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      status: { in: ["completed", "confirmed", "no_show"] },
      ...(serviceFilter ? { serviceName: serviceFilter } : {}),
    },
    orderBy: { startsAt: "desc" },
    take: 500,
    include: {
      contact: { select: { id: true, phone: true, email: true, firstName: true, lastName: true } },
    },
  });

  const byContact = new Map<string, (typeof appointments)[number]>();
  for (const appt of appointments) {
    if (!appt.contactId || byContact.has(appt.contactId)) continue;
    byContact.set(appt.contactId, appt);
  }

  const rows: RecallDueRow[] = [];

  for (const [contactId, appt] of byContact) {
    const lastAt = appt.startsAt;
    const recommended = new Date(lastAt.getTime() + intervalDays * 86400000);
    const daysUntil = Math.ceil((recommended.getTime() - Date.now()) / 86400000);

    const futureCount = await prisma.voiceAppointment.count({
      where: {
        workspaceId,
        contactId,
        startsAt: { gte: new Date() },
        status: { notIn: ["canceled", "cancelled", "no_show"] },
      },
    });

    const dismissed = Boolean(dismissals[contactId]);
    const status = computeStatus(daysUntil, dismissed, futureCount > 0, false);
    const c = appt.contact;
    const name = `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || "Customer";

    rows.push({
      id: `recall-${contactId}`,
      contactId,
      customerName: name,
      phone: c?.phone || null,
      email: c?.email || null,
      lastAppointmentAt: lastAt.toISOString(),
      serviceName: appt.serviceName,
      recommendedReturnAt: recommended.toISOString(),
      status,
      statusLabel: formatDueLabel(status, daysUntil),
      dueReason: serviceFilter
        ? `${serviceFilter} recommends follow-up after ${intervalDays} days`
        : `Recommend another appointment after ${intervalDays} days`,
      lastContactAt: null,
    });
  }

  return rows.sort((a, b) => a.recommendedReturnAt.localeCompare(b.recommendedReturnAt));
}

export async function dismissRecallCustomer(workspaceId: string, contactId: string) {
  const dismissals = await loadDismissals(workspaceId);
  dismissals[contactId] = new Date().toISOString();
  await saveAppointmentPlatformConfig(workspaceId, { recallDismissals: dismissals } as object);
  return { contactId, dismissedAt: dismissals[contactId] };
}

export async function restoreRecallCustomer(workspaceId: string, contactId: string) {
  const dismissals = await loadDismissals(workspaceId);
  delete dismissals[contactId];
  await saveAppointmentPlatformConfig(workspaceId, { recallDismissals: dismissals } as object);
  return { contactId };
}
