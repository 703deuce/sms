import "server-only";

import { getPrisma } from "@/lib/db";

export type AppointmentSegmentPreset =
  | "booked_tomorrow"
  | "membership_customers"
  | "low_credits"
  | "inactive_60_days"
  | "booking_type";

export type SegmentContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export async function resolveAppointmentSegment(
  workspaceId: string,
  preset: AppointmentSegmentPreset,
  opts?: { bookingTypeId?: string; bookingTypeName?: string },
): Promise<SegmentContact[]> {
  const prisma = getPrisma();
  const now = new Date();

  if (preset === "booked_tomorrow") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = await prisma.voiceAppointment.findMany({
      where: { workspaceId, startsAt: { gte: start, lt: end } },
      select: { contactId: true },
    });
    const ids = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
    if (!ids.length) return [];
    return prisma.contact.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
  }

  if (preset === "membership_customers") {
    const subs = await prisma.serviceMembershipSubscription.findMany({
      where: { workspaceId, status: "active" },
      select: { contactId: true },
    });
    const ids = [...new Set(subs.map((s) => s.contactId))];
    if (!ids.length) return [];
    return prisma.contact.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
  }

  if (preset === "low_credits") {
    const balances = await prisma.packageBalance.findMany({
      where: { workspaceId, status: "active" },
    });
    const lowIds = balances
      .filter((b) => {
        const credits = (b.remainingCredits || {}) as Record<string, number>;
        const total = Object.values(credits).reduce((s, n) => s + (n || 0), 0);
        return total > 0 && total < 2;
      })
      .map((b) => b.contactId);
    if (!lowIds.length) return [];
    return prisma.contact.findMany({
      where: { workspaceId, id: { in: lowIds } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
  }

  if (preset === "inactive_60_days") {
    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const recent = await prisma.voiceAppointment.findMany({
      where: { workspaceId, startsAt: { gte: cutoff } },
      select: { contactId: true },
    });
    const activeIds = new Set(recent.map((r) => r.contactId).filter(Boolean));
    const contacts = await prisma.contact.findMany({
      where: { workspaceId, phone: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      take: 500,
    });
    return contacts.filter((c) => !activeIds.has(c.id));
  }

  if (preset === "booking_type" && (opts?.bookingTypeName || opts?.bookingTypeId)) {
    const rows = await prisma.voiceAppointment.findMany({
      where: {
        workspaceId,
        ...(opts.bookingTypeName ? { serviceName: opts.bookingTypeName } : {}),
      },
      select: { contactId: true },
      take: 500,
    });
    const ids = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[];
    if (!ids.length) return [];
    return prisma.contact.findMany({
      where: { workspaceId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
  }

  return [];
}

export const APPOINTMENT_SEGMENT_PRESETS: Array<{ id: AppointmentSegmentPreset; label: string }> = [
  { id: "booked_tomorrow", label: "Booked tomorrow" },
  { id: "membership_customers", label: "Membership customers" },
  { id: "low_credits", label: "Fewer than 2 credits remaining" },
  { id: "inactive_60_days", label: "Not seen in 60 days" },
  { id: "booking_type", label: "Customers of a booking type" },
];
