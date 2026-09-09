import "server-only";

import { getPrisma } from "@/lib/db";

export async function loadAcuityStyleReports(
  workspaceId: string,
  from: Date,
  to: Date,
  filters?: { staffId?: string; bookingTypeId?: string; status?: string },
) {
  const prisma = getPrisma();
  const appointments = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      startsAt: { gte: from, lte: to },
    },
  });

  const filtered = appointments.filter((a: (typeof appointments)[number]) => {
    const meta = (a.metadata || {}) as { staffId?: string; appointmentTypeId?: string };
    if (filters?.staffId && meta.staffId !== filters.staffId) return false;
    if (filters?.bookingTypeId && meta.appointmentTypeId !== filters.bookingTypeId) return false;
    if (filters?.status && a.status !== filters.status) return false;
    return true;
  });

  const byType: Record<string, number> = {};
  let totalDurationMinutes = 0;
  const statusCounts: Record<string, number> = {};
  let paid = 0;
  let unpaid = 0;

  for (const a of filtered) {
    const name = a.serviceName || "Unknown";
    byType[name] = (byType[name] || 0) + 1;
    const duration = a.endsAt
      ? (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000
      : 30;
    totalDurationMinutes += duration;
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    const meta = (a.metadata || {}) as { paymentStatus?: string };
    if (meta.paymentStatus === "paid") paid++;
    else unpaid++;
  }

  const payments = await prisma.appointmentMerchantPayment.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to } },
  });

  const revenue = {
    appointmentPaymentsCents: payments.reduce((s: number, p: (typeof payments)[number]) => s + p.amountPaidCents, 0),
    depositsCents: payments.filter((p: (typeof payments)[number]) => p.paymentMode === "deposit").reduce((s: number, p: (typeof payments)[number]) => s + p.amountPaidCents, 0),
    tipsCents: payments.reduce((s: number, p: (typeof payments)[number]) => {
      const meta = (p.metadata || {}) as { tipCents?: number };
      return s + (meta.tipCents || 0);
    }, 0),
  };

  return {
    appointments: {
      count: filtered.length,
      totalDurationMinutes,
      byType,
      statusCounts,
      paid,
      unpaid,
    },
    revenue,
  };
}

export function reportsToCsv(report: Awaited<ReturnType<typeof loadAcuityStyleReports>>): string {
  const lines = ["section,metric,value"];
  lines.push(`appointments,count,${report.appointments.count}`);
  lines.push(`appointments,total_duration_minutes,${report.appointments.totalDurationMinutes}`);
  lines.push(`appointments,paid,${report.appointments.paid}`);
  lines.push(`appointments,unpaid,${report.appointments.unpaid}`);
  for (const [type, count] of Object.entries(report.appointments.byType)) {
    lines.push(`by_type,"${type}",${count}`);
  }
  lines.push(`revenue,appointment_payments_cents,${report.revenue.appointmentPaymentsCents}`);
  lines.push(`revenue,deposits_cents,${report.revenue.depositsCents}`);
  lines.push(`revenue,tips_cents,${report.revenue.tipsCents}`);
  return lines.join("\n");
}
