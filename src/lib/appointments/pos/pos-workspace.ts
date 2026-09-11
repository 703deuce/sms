import "server-only";

import { listAppointmentTypes } from "@/lib/appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { getManageAppointmentPaymentSummary } from "@/lib/appointments/service-booking/manage-payments";
import { getPrisma } from "@/lib/db";
import { getMerchantPaymentStatus } from "@/lib/merchant-payments/service";

export async function buildPosWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const [platform, types, packages, memberships, products, appointments, sessions, merchantStatus] =
    await Promise.all([
      loadAppointmentPlatformConfig(workspaceId),
      listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }),
      prisma.packageProduct.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" } }),
      prisma.serviceMembershipProduct.findMany({
        where: { workspaceId, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.bookingProduct.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" } }),
      prisma.voiceAppointment.findMany({
        where: { workspaceId, status: { notIn: ["canceled", "cancelled"] } },
        orderBy: { startsAt: "desc" },
        take: 120,
        select: {
          id: true,
          serviceName: true,
          startsAt: true,
          firstName: true,
          lastName: true,
          metadata: true,
          contactId: true,
        },
      }),
      prisma.posSession.findMany({
        where: { workspaceId, status: "checked_out" },
        orderBy: { checkedOutAt: "desc" },
        take: 30,
        include: { lineItems: true },
      }),
      getMerchantPaymentStatus(workspaceId).catch(() => null),
    ]);

  const openBalances = [];
  for (const apt of appointments) {
    try {
      const summary = await getManageAppointmentPaymentSummary(workspaceId, apt.id);
      if (summary.balanceDueCents <= 0) continue;
      openBalances.push({
        appointmentId: apt.id,
        contactId: apt.contactId,
        customer: [apt.firstName, apt.lastName].filter(Boolean).join(" ") || "Customer",
        serviceName: apt.serviceName || "Appointment",
        startsAt: apt.startsAt.toISOString(),
        totalCents: summary.totalPriceCents,
        paidCents: summary.amountPaidCents,
        balanceCents: summary.balanceDueCents,
      });
    } catch {
      // skip
    }
  }

  const services = types
    .filter((t) => (t.config?.bookingTypeKind || "SERVICE") === "SERVICE")
    .map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: t.config?.payment?.priceCents || 0,
      durationMinutes: t.durationMinutes,
    }));

  const recentSales = sessions.map((s) => ({
    id: s.id,
    at: (s.checkedOutAt || s.updatedAt).toISOString(),
    totalCents: s.totalCents,
    contactId: s.contactId,
    itemCount: s.lineItems.length,
    status: s.status,
  }));

  return {
    currency: platform.commerceDefaults?.paymentMode ? "usd" : "usd",
    merchant: merchantStatus,
    cardPresent: { stripeTerminal: false, squareTerminal: false },
    catalog: {
      services,
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
      })),
      memberships: memberships.map((m) => ({
        id: m.id,
        name: m.name,
        priceCents: m.priceCents,
        billingInterval: m.billingInterval,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
      })),
    },
    openBalances,
    recentSales,
  };
}
