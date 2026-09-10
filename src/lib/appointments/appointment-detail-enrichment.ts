import "server-only";

import { getPrisma } from "@/lib/db";
import { listAppointmentTypes, type ListedAppointmentType } from "@/lib/appointments/booking-platform";
import { listServicePhaseTemplates } from "@/lib/appointments/service-booking/service-phases";
import { buildPhaseOccupancyWindows } from "@/lib/appointments/service-booking/staff-phase-occupancy";
import { listBookingAddOns } from "@/lib/appointments/service-booking/add-ons";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type AppointmentDetailEnrichment = {
  servicePhases: Array<{
    name: string;
    phaseKind: string;
    startsAt: string;
    endsAt: string;
    staffRequired: boolean;
  }>;
  roomsEquipment: Array<{ label: string; quantity?: number; fromGroup?: string }>;
  addOns: Array<{ name: string; priceCents?: number; durationMinutes?: number }>;
  intakeResponses: Array<{
    formId: string;
    formName: string;
    answers: Record<string, unknown>;
    attachments: Array<{ fieldId: string; filename: string; url?: string; mimeType?: string }>;
  }>;
  entitlementPayment?: {
    method: "package" | "gift";
    packageName?: string;
    creditsUsed?: number;
    creditsRemaining?: number;
    membershipName?: string;
    monthlyCreditsUsed?: number;
    monthlyCreditsRemaining?: number;
    giftCode?: string;
    amountCentsWaived?: number;
  };
  recurringSeries?: {
    seriesId: string;
    frequencyLabel: string;
    occurrenceIndex: number;
    totalOccurrences?: number;
    rangeLabel?: string;
  };
  termsAcceptance?: {
    accepted: boolean;
    acceptedAt?: string;
    termsVersion?: string;
    termsUrl?: string;
  };
  financialSummary: {
    totalCents?: number;
    depositCents?: number;
    paidCents?: number;
    balanceCents?: number;
    refundedCents?: number;
    paymentMethod?: string;
  };
};

function isFileAnswer(value: unknown): value is { filename?: string; url?: string; mimeType?: string; name?: string } {
  return Boolean(value && typeof value === "object" && ("url" in (value as object) || "filename" in (value as object)));
}

export async function enrichAppointmentDetail(
  workspaceId: string,
  appointment: {
    id: string;
    serviceName: string | null;
    startsAt: string;
    metadata: AppointmentMetadata;
  },
): Promise<AppointmentDetailEnrichment> {
  const prisma = getPrisma();
  const meta = appointment.metadata || {};
  const startsAt = new Date(appointment.startsAt);

  const types = await listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true });
  const matchedType: ListedAppointmentType | undefined = types.find(
    (t: ListedAppointmentType) => t.name === appointment.serviceName,
  );
  const typeId = matchedType?.id;

  let servicePhases: AppointmentDetailEnrichment["servicePhases"] = [];
  if (typeId) {
    const templates = await listServicePhaseTemplates(workspaceId, typeId);
    if (templates.length) {
      const windows = buildPhaseOccupancyWindows(
        startsAt,
        templates.map((p: Awaited<ReturnType<typeof listServicePhaseTemplates>>[number]) => ({
          phaseKind: p.phaseKind as "active_staff" | "processing",
          durationMinutes: p.durationMinutes,
          staffRequired: p.staffRequired,
          resourceIds: (p.resourceIds as string[]) || [],
        })),
      );
      servicePhases = windows.map((w, i) => ({
        name: templates[i]?.name || `Phase ${i + 1}`,
        phaseKind: w.phaseKind,
        startsAt: w.startsAt.toISOString(),
        endsAt: w.endsAt.toISOString(),
        staffRequired: w.staffRequired,
      }));
    }
  }

  const resourceLabels = (meta.resourceLabels as Record<string, string> | undefined) || {};
  const resourceIds = (meta.resourceIds as string[] | undefined) || [];
  const roomsEquipment = resourceIds.map((id) => ({
    label: resourceLabels[id] || id,
  }));

  const addOnIds = (meta.addOnIds as string[] | undefined) || [];
  const allAddOns = addOnIds.length ? await listBookingAddOns(workspaceId) : [];
  const addOns = addOnIds
    .map((id) => allAddOns.find((a: Awaited<ReturnType<typeof listBookingAddOns>>[number]) => a.id === id))
    .filter(Boolean)
    .map((a) => ({
      name: a!.name,
      priceCents: a!.priceCents ?? undefined,
      durationMinutes: a!.durationMinutes ?? undefined,
    }));

  const intakeRows = await prisma.intakeFormResponse.findMany({
    where: { workspaceId, appointmentId: appointment.id },
    include: { form: { select: { id: true, name: true, fields: true } } },
    orderBy: { createdAt: "asc" },
  });

  const intakeResponses = intakeRows.map((row: (typeof intakeRows)[number]) => {
    const answers = (row.answers || {}) as Record<string, unknown>;
    const attachments: AppointmentDetailEnrichment["intakeResponses"][number]["attachments"] = [];
    for (const [fieldId, value] of Object.entries(answers)) {
      if (isFileAnswer(value)) {
        attachments.push({
          fieldId,
          filename: value.filename || value.name || "Attachment",
          url: value.url,
          mimeType: value.mimeType,
        });
      }
    }
    return {
      formId: row.formId,
      formName: row.form?.name || "Intake form",
      answers,
      attachments,
    };
  });

  let entitlementPayment: AppointmentDetailEnrichment["entitlementPayment"];
  const ent = meta.entitlementPayment as Record<string, unknown> | undefined;
  if (ent?.method === "package" && ent.packageBalanceId) {
    const balance = await prisma.packageBalance.findFirst({
      where: { id: String(ent.packageBalanceId), workspaceId },
      include: { product: { select: { name: true } } },
    });
    const remaining = (balance?.remainingCredits || {}) as Record<string, number>;
    const totalRemaining = Object.values(remaining).reduce((s, n) => s + (n || 0), 0);
    entitlementPayment = {
      method: "package",
      packageName: balance?.product?.name || "Package",
      creditsUsed: 1,
      creditsRemaining: totalRemaining,
      amountCentsWaived: Number(ent.amountCentsWaived) || undefined,
    };
  } else if (ent?.method === "gift") {
    entitlementPayment = {
      method: "gift",
      giftCode: String(ent.giftCode || ""),
      amountCentsWaived: Number(ent.amountCentsWaived) || undefined,
    };
  }

  const membershipSub = meta.membershipSubscriptionId
    ? await prisma.serviceMembershipSubscription.findFirst({
        where: { id: String(meta.membershipSubscriptionId), workspaceId },
        include: { product: { select: { name: true } } },
      })
    : null;
  if (membershipSub) {
    entitlementPayment = {
      method: "package",
      membershipName: membershipSub.product?.name || "Membership",
      monthlyCreditsUsed: 1,
      monthlyCreditsRemaining: undefined,
    };
  }

  let recurringSeries: AppointmentDetailEnrichment["recurringSeries"];
  if (meta.recurringSeriesId) {
    const seriesAppointments = await prisma.voiceAppointment.findMany({
      where: { workspaceId },
      select: { id: true, metadata: true, startsAt: true },
    });
    const inSeries = seriesAppointments
      .filter(
        (r: (typeof seriesAppointments)[number]) =>
          ((r.metadata || {}) as AppointmentMetadata).recurringSeriesId === meta.recurringSeriesId,
      )
      .sort(
        (a: (typeof seriesAppointments)[number], b: (typeof seriesAppointments)[number]) =>
          (((a.metadata || {}) as AppointmentMetadata).recurringOccurrenceIndex || 0) -
          (((b.metadata || {}) as AppointmentMetadata).recurringOccurrenceIndex || 0),
      );
    const freq = matchedType?.config?.recurring?.allowedFrequencies?.[0] || "weekly";
    recurringSeries = {
      seriesId: String(meta.recurringSeriesId),
      frequencyLabel: freq === "biweekly" ? "Every 2 weeks" : freq === "monthly" ? "Monthly" : "Weekly",
      occurrenceIndex: Number(meta.recurringOccurrenceIndex) || 1,
      totalOccurrences: inSeries.length || undefined,
      rangeLabel: inSeries.length
        ? `${inSeries[0].startsAt.toLocaleDateString()} – ${inSeries[inSeries.length - 1].startsAt.toLocaleDateString()}`
        : undefined,
    };
  }

  const terms = meta.termsAcceptance as AppointmentDetailEnrichment["termsAcceptance"];
  const financialSummary = {
    totalCents: Number(meta.totalPriceCents) || undefined,
    depositCents: Number(meta.depositPaidCents) || undefined,
    paidCents: Number(meta.paymentAmountCents) || undefined,
    balanceCents: Number(meta.balanceDueCents ?? meta.amountDueCents) || undefined,
    refundedCents: Number(meta.refundAmountCents) || undefined,
    paymentMethod: meta.paymentProvider ? String(meta.paymentProvider) : undefined,
  };

  return {
    servicePhases,
    roomsEquipment,
    addOns,
    intakeResponses,
    entitlementPayment,
    recurringSeries,
    termsAcceptance: terms,
    financialSummary,
  };
}
