import "server-only";

import { getPrisma } from "@/lib/db";
import { getManageAppointmentPaymentSummary } from "@/lib/appointments/service-booking/manage-payments";
import { listEligibleEntitlementsForContact } from "@/lib/appointments/service-booking/entitlements";
import { getWalletBalance } from "@/lib/appointments/service-booking/phase2/client-wallet";
import { packageBalanceSummary } from "@/lib/appointments/service-booking/package-lifecycle";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import type { ClientPortalSessionContext } from "./auth";
import { evaluateExtendedCancellationPolicy, evaluateExtendedReschedulePolicy } from "@/lib/appointments/service-booking/scheduling-limits";
import type { ExtendedCancellationPolicy, ExtendedReschedulePolicy } from "@/lib/appointments/service-booking/types";

const CANCELLED = new Set(["cancelled", "canceled", "no_show", "noshow"]);

function displayName(c: { firstName: string | null; lastName: string | null; email: string | null }) {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return n || c.email || "Client";
}

async function policiesForService(
  workspaceId: string,
  serviceName: string | null,
): Promise<{ cancellation?: ExtendedCancellationPolicy; reschedule?: ExtendedReschedulePolicy }> {
  if (!serviceName) return {};
  const prisma = getPrisma();
  const type = await prisma.voiceService.findFirst({
    where: { workspaceId, name: serviceName },
    select: { config: true },
  });
  const cfg = (type?.config || {}) as {
    extendedCancellationPolicy?: ExtendedCancellationPolicy;
    extendedReschedulePolicy?: ExtendedReschedulePolicy;
  };
  return {
    cancellation: cfg.extendedCancellationPolicy,
    reschedule: cfg.extendedReschedulePolicy,
  };
}

export async function buildClientPortalWorkspace(ctx: ClientPortalSessionContext) {
  const prisma = getPrisma();
  const [contact, workspace, appointments, entitlements, wallet, intakeResponses, intakeForms] =
    await Promise.all([
      prisma.contact.findFirst({ where: { id: ctx.contactId, workspaceId: ctx.workspaceId } }),
      prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: { id: true, name: true, slug: true, settingsJson: true },
      }),
      prisma.voiceAppointment.findMany({
        where: { workspaceId: ctx.workspaceId, contactId: ctx.contactId },
        orderBy: { startsAt: "desc" },
        take: 100,
      }),
      listEligibleEntitlementsForContact(ctx.workspaceId, ctx.contactId),
      getWalletBalance(ctx.workspaceId, ctx.contactId).catch(() => ({
        balanceCents: 0,
        currency: "usd",
        accountId: "",
        status: "active",
      })),
      prisma.intakeFormResponse.findMany({
        where: { workspaceId: ctx.workspaceId, contactId: ctx.contactId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.intakeForm.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: { id: true, name: true },
      }),
    ]);

  if (!contact || !workspace) return null;

  const formNames = new Map(intakeForms.map((f) => [f.id, f.name]));
  const now = new Date();
  const settings = (workspace.settingsJson || {}) as Record<string, unknown>;
  const branding = (settings.bookingBranding || settings.branding || {}) as {
    logoUrl?: string;
    accentColor?: string;
    businessName?: string;
  };

  let outstandingCents = 0;
  const appointmentCards = await Promise.all(
    appointments.map(async (a) => {
      const meta = (a.metadata || {}) as AppointmentMetadata;
      const st = String(a.status).toLowerCase();
      const cancelled = CANCELLED.has(st);
      let payment = { balanceDueCents: 0, amountPaidCents: 0, totalPriceCents: 0 };
      try {
        payment = await getManageAppointmentPaymentSummary(ctx.workspaceId, a.id);
        if (payment.balanceDueCents > 0 && !cancelled) outstandingCents += payment.balanceDueCents;
      } catch {
        /* ignore */
      }
      const policies = await policiesForService(ctx.workspaceId, a.serviceName);
      const rescheduleEval = evaluateExtendedReschedulePolicy(
        policies.reschedule,
        new Date(a.startsAt),
      );
      const cancelEval = evaluateExtendedCancellationPolicy(
        policies.cancellation,
        new Date(a.startsAt),
      );
      const offeringKind =
        (meta.bookingType as string) ||
        (meta.appointmentType as string) ||
        (meta.classSessionId ? "class" : meta.workshopId ? "workshop" : "service");

      return {
        id: a.id,
        title: a.serviceName || "Appointment",
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() || null,
        status: a.status,
        staffName: a.staffName || meta.staffName || null,
        location: meta.location || meta.locationName || null,
        meetingLink: meta.meetingLink || meta.videoUrl || null,
        timezone: contact.timezone || meta.timezone || null,
        offeringKind,
        payment,
        canReschedule: !cancelled && a.startsAt > now && rescheduleEval.allowed,
        rescheduleBlockedReason: rescheduleEval.allowed ? null : rescheduleEval.reason || null,
        canCancel: !cancelled && cancelEval.allowed,
        cancelBlockedReason: cancelEval.allowed ? null : cancelEval.reason || null,
        manageAppointmentUrl: meta.manageAppointmentUrl || null,
      };
    }),
  );

  const upcoming = appointmentCards.filter(
    (a) => new Date(a.startsAt) > now && !CANCELLED.has(String(a.status).toLowerCase()),
  );
  const past = appointmentCards.filter(
    (a) => new Date(a.startsAt) <= now || CANCELLED.has(String(a.status).toLowerCase()),
  );
  const next = upcoming.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )[0];

  const tasks: Array<{ id: string; label: string; detail: string; href: string; kind: string }> = [];
  if (next && next.payment.balanceDueCents > 0) {
    tasks.push({
      id: `pay-${next.id}`,
      kind: "payment",
      label: `Pay ${(next.payment.balanceDueCents / 100).toFixed(0)} balance`,
      detail: next.title,
      href: `/client/appointments/${next.id}?pay=1`,
    });
  }

  const forms = intakeResponses.map((r) => ({
    id: r.id,
    formName: formNames.get(r.formId) || "Form",
    status: "completed",
    submittedAt: r.createdAt.toISOString(),
    appointmentId: r.appointmentId,
  }));

  const apptIds = appointments.map((a) => a.id);
  const payments = apptIds.length
    ? await prisma.appointmentMerchantPayment.findMany({
        where: { workspaceId: ctx.workspaceId, appointmentId: { in: apptIds } },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];

  const packages = (entitlements.packages || []).map((p) => ({
    id: p.id,
    name: p.product?.name || "Package",
    remaining: packageBalanceSummary((p.remainingCredits || {}) as Record<string, number>).totalRemaining,
    expiresAt: p.expiresAt?.toISOString() || null,
    status: p.status,
  }));

  const memberships = (entitlements.memberships || []).map((m) => ({
    id: m.id,
    name: m.product?.name || "Membership",
    status: m.status,
    billingInterval: m.product?.billingInterval || null,
  }));

  return {
    business: {
      id: workspace.id,
      name: branding.businessName || workspace.name,
      slug: workspace.slug,
      logoUrl: branding.logoUrl || null,
      accentColor: branding.accentColor || "#0d9488",
    },
    profile: {
      id: contact.id,
      displayName: displayName(contact),
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      timezone: contact.timezone,
    },
    nextAppointment: next || null,
    tasks,
    appointments: { upcoming, past, cancelled: appointmentCards.filter((a) => CANCELLED.has(String(a.status).toLowerCase())) },
    forms,
    packages,
    memberships,
    payments: {
      outstandingCents,
      walletCreditCents: wallet.balanceCents,
      transactions: payments.map((p) => ({
        id: p.id,
        at: (p.paidAt || p.createdAt).toISOString(),
        amountCents: p.amountPaidCents,
        status: p.status,
        appointmentId: p.appointmentId,
      })),
    },
    bookUrl: workspace.slug ? `/book/${encodeURIComponent(workspace.slug)}` : "/book",
    bookUrlWithContact: workspace.slug
      ? `/book/${encodeURIComponent(workspace.slug)}?contactId=${encodeURIComponent(ctx.contactId)}`
      : "/book",
  };
}

export async function buildClientPortalAppointmentDetail(
  ctx: ClientPortalSessionContext,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId: ctx.workspaceId, contactId: ctx.contactId },
  });
  if (!appointment) return null;

  const meta = (appointment.metadata || {}) as AppointmentMetadata;
  const payment = await getManageAppointmentPaymentSummary(ctx.workspaceId, appointmentId);
  const policies = await policiesForService(ctx.workspaceId, appointment.serviceName);
  const rescheduleEval = evaluateExtendedReschedulePolicy(
    policies.reschedule,
    new Date(appointment.startsAt),
  );
  const cancelEval = evaluateExtendedCancellationPolicy(
    policies.cancellation,
    new Date(appointment.startsAt),
  );

  const { getManageAppointmentIntakeContext } = await import(
    "@/lib/appointments/service-booking/manage-intake"
  );
  const intakeForms = await getManageAppointmentIntakeContext(ctx.workspaceId, appointmentId);

  return {
    id: appointment.id,
    title: appointment.serviceName || "Appointment",
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt?.toISOString() || null,
    status: appointment.status,
    staffName: appointment.staffName || meta.staffName || null,
    location: meta.location || meta.locationName || null,
    meetingLink: meta.meetingLink || meta.videoUrl || null,
    payment,
    intakeForms,
    canReschedule: rescheduleEval.allowed,
    rescheduleBlockedReason: rescheduleEval.reason || null,
    canCancel: cancelEval.allowed,
    cancelBlockedReason: cancelEval.reason || null,
    offeringKind:
      (meta.bookingType as string) ||
      (meta.classSessionId ? "class" : meta.workshopId ? "workshop" : "service"),
  };
}
