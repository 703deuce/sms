import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  createPlatformAppointment,
  getAvailability,
  listAppointmentTypes,
  loadAppointmentPlatformConfig,
  resolveWorkspaceBySlug,
} from "@/lib/appointments";
import { evaluatePublicBookingRisk, recordSuspiciousBooking } from "@/lib/appointments/booking-protection";
import { createAppointmentCheckoutSession } from "@/lib/appointments/payment-checkout";
import { createRecurringAppointments } from "@/lib/appointments/recurring";
import {
  applyBookingEntitlement,
  lookupBookingEntitlements,
  markAppointmentPaidByEntitlement,
  resolveContactIdByPhone,
  suggestAutoEntitlement,
  type BookingEntitlementSelection,
} from "@/lib/appointments/service-booking/booking-entitlements";
import { listBookingCategories } from "@/lib/appointments/service-booking/booking-category";
import { loadSchedulerTheme } from "@/lib/appointments/service-booking/scheduler-theme";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import { listBookingAddOns, listSchedulingResources, listIntakeForms } from "@/lib/appointments/service-booking";
import { listCustomerFieldDefinitions } from "@/lib/appointments/service-booking/phase2/custom-fields";
import { calculateAddOnTotals } from "@/lib/appointments/service-booking/add-ons";
import { chargeSavedCardForAppointment } from "@/lib/merchant-payments/saved-cards";
import {
  loadSchedulingContext,
  resolveRoutingDestination,
  resolveStaffForBooking,
} from "@/lib/appointments/scheduling-domain";
import { SlotTakenError } from "@/lib/appointments/slot-booking";
import type { AppointmentTypeConfig, PaymentRequirement } from "@/lib/appointments/types";
import { getPrisma, type DbRow } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

const PUBLIC_BOOKING_RATE = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function enforcePublicRateLimit(workspaceId: string, ip: string): boolean {
  const key = `${workspaceId}:${ip}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const list = (PUBLIC_BOOKING_RATE.get(key) || []).filter((t) => t >= now - windowMs);
  if (list.length >= max) return false;
  list.push(now);
  PUBLIC_BOOKING_RATE.set(key, list);
  return true;
}

async function resolveTypeConfig(
  workspaceId: string,
  serviceId?: string,
  serviceName?: string,
): Promise<{ id: string; name: string; config: AppointmentTypeConfig } | null> {
  const types = await listAppointmentTypes(workspaceId);
  if (serviceId) {
    const match = types.find((t: DbRow) => t.id === serviceId);
    if (match) return { id: match.id, name: match.name, config: match.config || {} };
  }
  if (serviceName) {
    const match = types.find((t: DbRow) => t.name === serviceName);
    if (match) return { id: match.id, name: match.name, config: match.config || {} };
  }
  return null;
}

async function attachPaymentCheckout(
  workspaceId: string,
  appointmentId: string,
  payment: PaymentRequirement,
  customerEmail?: string,
  description?: string,
): Promise<{
  paymentRequired: boolean;
  checkoutUrl: string | null;
  checkoutConfigured: boolean;
  checkoutError?: string | null;
  provider?: string;
  square?: {
    applicationId: string;
    locationId: string;
    amountCents: number;
    currency: string;
  };
  appointmentId?: string;
}> {
  if (!payment || payment.mode === "none") {
    return { paymentRequired: false, checkoutUrl: null, checkoutConfigured: true };
  }
  const checkout = await createAppointmentCheckoutSession({
    workspaceId,
    appointmentId,
    payment,
    customerEmail,
    description,
  });
  return {
    paymentRequired: true,
    checkoutUrl: checkout.url,
    checkoutConfigured: checkout.configured,
    checkoutError: checkout.error,
    provider: checkout.provider?.toLowerCase(),
    square: checkout.square,
    appointmentId,
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }
    const types = (await listAppointmentTypes(workspace.id))
      .filter((t: { active: boolean }) => t.active)
      .map((t: { id: string; name: string; durationMinutes: number; config: AppointmentTypeConfig }) => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
        bookingTypeKind: resolveBookingTypeKind(t.config),
        durationOptions: t.config?.durationOptions,
        confirmationPage: t.config?.confirmationPage,
        config: t.config,
      }));
    const staff = (config.staff || [])
      .filter((s) => s.active !== false && s.customerSelectable !== false)
      .map((s) => ({
        id: s.id,
        name: s.name,
      }));
    const locations = (config.locations || []).filter((l) => l.active !== false).map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      address: l.address,
    }));
    const categoryRows = await listBookingCategories(workspace.id);
    const categories = categoryRows
      .filter((c: { active: boolean }) => c.active)
      .map(
        (c: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          displayOrder: number;
          collapsible: boolean;
          collapsedByDefault: boolean;
          imageUrl: string | null;
        }) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          displayOrder: c.displayOrder,
          collapsible: c.collapsible,
          collapsedByDefault: c.collapsedByDefault,
          imageUrl: c.imageUrl,
        }),
      );
    const schedulerTheme = await loadSchedulerTheme(workspace.id);
    const allResources = await listSchedulingResources(workspace.id);
    const allAddOns = await listBookingAddOns(workspace.id);
    const intakeForms = await listIntakeForms(workspace.id, "appointment");
    const customFieldDefinitions = await listCustomerFieldDefinitions(workspace.id);
    const resources = allResources
      .filter((r) => r.active)
      .map((r) => ({
        id: r.id,
        name: r.name,
        quantity: r.quantity,
        description: r.description,
        eligibleTypeIds: r.eligibleTypeIds,
      }));
    const addOns = allAddOns
      .filter((a) => a.active)
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        priceCents: a.priceCents,
        durationDeltaMinutes: a.durationDeltaMinutes,
        quantityMax: a.quantityMax,
        required: a.required,
        eligibleTypeIds: a.eligibleTypeIds,
      }));
    return NextResponse.json({
      data: {
        workspace: {
          slug: workspace.slug,
          name: workspace.displayName || workspace.name,
          logoUrl: workspace.logoUrl,
        },
        timezone: config.timezone,
        businessDisplayName: config.businessDisplayName || workspace.displayName || workspace.name,
        businessPhone: config.businessPhone,
        businessAddress: config.businessAddress,
        consentText: config.consentText,
        consentVersion: config.consentVersion || "v1",
        termsUrl: config.termsUrl,
        privacyUrl: config.privacyUrl,
        types,
        categories,
        resources,
        addOns,
        intakeForms: intakeForms
          .filter((f: { active: boolean }) => f.active)
          .map((f: { id: string; name: string; fields: unknown }) => ({
            id: f.id,
            name: f.name,
            fields: f.fields,
          })),
        customFieldDefinitions: customFieldDefinitions
          .filter((d: { active: boolean }) => d.active)
          .map(
            (d: {
              id: string;
              key: string;
              label: string;
              fieldType: string;
              options?: string[] | null;
              required: boolean;
            }) => ({
              id: d.id,
              key: d.key,
              label: d.label,
              fieldType: d.fieldType,
              options: d.options,
              required: d.required,
            }),
          ),
        schedulerTheme,
        staff,
        locations,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }

    const ip = clientIp(request);
    if (!enforcePublicRateLimit(workspace.id, ip)) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "book");

    if (action === "entitlements") {
      const phone = String(body.phone || "").trim();
      const email = body.email ? String(body.email) : undefined;
      const serviceId = body.serviceId ? String(body.serviceId) : undefined;
      const serviceName = body.serviceName ? String(body.serviceName) : undefined;
      if (!phone) {
        return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      }
      const contactId = await resolveContactIdByPhone(workspace.id, phone, email);
      if (!contactId) {
        return NextResponse.json({ data: { packages: [], gifts: [], memberships: [] } });
      }
      const entitlements = await lookupBookingEntitlements({
        workspaceId: workspace.id,
        contactId,
        bookingTypeId: serviceId,
        serviceName,
      });
      const { getSavedPaymentMethodForContact } = await import("@/lib/merchant-payments/saved-cards");
      const saved = await getSavedPaymentMethodForContact(workspace.id, contactId);
      const autoSuggestion = suggestAutoEntitlement(entitlements);
      return NextResponse.json({
        data: {
          ...entitlements,
          hasSavedCard: Boolean(saved?.defaultPaymentMethodId),
          autoSuggestion,
        },
      });
    }

    if (action === "preview_recurring") {
      const { generateRecurringOccurrences, type RecurringFrequency } = await import(
        "@/lib/appointments/recurring-schedule"
      );
      const startsAt = String(body.startsAt || "");
      const frequency = String(body.frequency || "weekly") as RecurringFrequency;
      const occurrences = Math.min(Number(body.occurrences || 4), 52);
      const weekdays = Array.isArray(body.weekdays)
        ? (body.weekdays as number[]).map(Number).filter((n) => n >= 0 && n <= 6)
        : undefined;
      if (!startsAt) {
        return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
      }
      const dates = generateRecurringOccurrences({
        startsAt,
        frequency,
        occurrences,
        weekdays,
      });
      const serviceName = body.serviceName ? String(body.serviceName) : "Appointment";
      const conflicts: Array<{ startsAt: string; reason: string }> = [];
      for (const date of dates) {
        try {
          const { assertSlotAvailableForBooking } = await import("@/lib/appointments/slot-validation");
          await assertSlotAvailableForBooking(workspace.id, { serviceName, startsAt: date });
        } catch (err) {
          conflicts.push({
            startsAt: date,
            reason: err instanceof Error ? err.message : "unavailable",
          });
        }
      }
      return NextResponse.json({ data: { dates, conflicts } });
    }

    if (action === "availability") {
      const data = await getAvailability(workspace.id, {
        serviceId: body.serviceId ? String(body.serviceId) : undefined,
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
        staffId: body.staffId ? String(body.staffId) : undefined,
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
        daysAhead: Number(body.daysAhead || 14),
      });
      const typeInfo = await resolveTypeConfig(
        workspace.id,
        body.serviceId ? String(body.serviceId) : undefined,
        body.serviceName ? String(body.serviceName) : undefined,
      );
      if (typeInfo?.config.groupBooking?.enabled && typeInfo.config.groupBooking.capacity) {
        const capacity = typeInfo.config.groupBooking.capacity;
        const slotsWithCapacity = await Promise.all(
          data.slots.map(async (slot) => {
            const { checkGroupCapacity } = await import("@/lib/appointments/scheduling-domain");
            const cap = await checkGroupCapacity(
              workspace.id,
              typeInfo.name,
              new Date(slot.startsAt),
              capacity,
            );
            return { ...slot, remaining: cap.remaining, capacity };
          }),
        );
        return NextResponse.json({ data: { slots: slotsWithCapacity } });
      }
      return NextResponse.json({ data });
    }

    const phone = String(body.phone || "").trim();
    const firstName = body.firstName ? String(body.firstName).trim() : "";
    const lastName = body.lastName ? String(body.lastName).trim() : "";
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (!firstName && !lastName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { assertClientNotRestricted } = await import("@/lib/appointments/service-booking/client-restrictions");
    await assertClientNotRestricted(workspace.id, {
      email: body.email ? String(body.email) : undefined,
      phone,
      action: "book",
    });

    const bookingAnswers =
      body.bookingAnswers && typeof body.bookingAnswers === "object"
        ? (body.bookingAnswers as Record<string, string>)
        : undefined;

    const smsConsent = body.smsConsent === true;
    const humanVerification = body.humanVerification === true;
    const serviceId = body.serviceId ? String(body.serviceId) : undefined;
    const serviceName = String(body.serviceName || "");
    const startsAt = String(body.startsAt || "");

    const typeInfo = await resolveTypeConfig(workspace.id, serviceId, serviceName);
    let resolvedType = typeInfo;
    const resolvedServiceName = resolvedType?.name || serviceName;

    let staffId = body.staffId ? String(body.staffId) : undefined;
    let locationId = body.locationId ? String(body.locationId) : undefined;
    let locationName: string | undefined;

    const routingDest = resolveRoutingDestination(config.routingRules, bookingAnswers || {});
    if (routingDest) {
      if (routingDest.appointmentTypeId) {
        const routed = await resolveTypeConfig(workspace.id, routingDest.appointmentTypeId);
        if (routed) resolvedType = routed;
      }
      if (routingDest.staffPoolIds?.length) {
        staffId = routingDest.staffPoolIds[0];
      }
      if (routingDest.locationId) {
        locationId = routingDest.locationId;
      }
    }

    const schedulingCtxEarly = await loadSchedulingContext(workspace.id, resolvedServiceName);
    if (body.staffId || body.staffName) {
      const preStaff = await resolveStaffForBooking(schedulingCtxEarly, {
        preferredStaffId: staffId,
        preferredStaffName: body.staffName ? String(body.staffName) : undefined,
      });
      if (preStaff) staffId = preStaff.id;
    }

    if (locationId) {
      const loc = (config.locations || []).find((l) => l.id === locationId);
      locationName = loc?.name;
    } else if (resolvedType?.config.locationId) {
      locationId = resolvedType.config.locationId;
      locationName = resolvedType.config.location;
    }

    const attendeeCount = body.attendeeCount ? Number(body.attendeeCount) : undefined;
    const extraRecipients = Array.isArray(body.extraRecipients)
      ? (body.extraRecipients as Array<{ email?: string; phone?: string; name?: string }>)
          .map((r) => ({
            email: r.email ? String(r.email).trim() : undefined,
            phone: r.phone ? String(r.phone).trim() : undefined,
            name: r.name ? String(r.name).trim() : undefined,
          }))
          .filter((r) => r.email || r.phone)
      : undefined;
    const recurring = body.recurring as
      | { frequency?: string; occurrences?: number }
      | undefined;
    const resourceIds = Array.isArray(body.resourceIds)
      ? (body.resourceIds as string[]).map(String).filter(Boolean)
      : undefined;
    const addOnSelections = Array.isArray(body.addOnSelections)
      ? (body.addOnSelections as Array<{ addOnId: string; quantity?: number }>)
      : undefined;
    const addOnIds = addOnSelections?.map((s) => s.addOnId) || undefined;

    const intakeResponses = Array.isArray(body.intakeResponses)
      ? (body.intakeResponses as Array<{ formId: string; answers: Record<string, unknown> }>)
      : undefined;
    const customFieldValues =
      body.customFieldValues && typeof body.customFieldValues === "object"
        ? (body.customFieldValues as Record<string, unknown>)
        : undefined;
    const multiServiceLines = Array.isArray(body.multiServiceLines)
      ? (body.multiServiceLines as Array<{
          appointmentTypeId?: string;
          serviceName: string;
          staffId?: string;
          resourceIds?: string[];
          startsAt: string;
          endsAt: string;
          priceCents?: number;
          displayOrder?: number;
        }>)
      : undefined;

    const risk = await evaluatePublicBookingRisk({
      workspaceId: workspace.id,
      ip,
      phone,
      email: body.email ? String(body.email) : undefined,
      firstName,
      lastName,
      notes: body.notes ? String(body.notes) : undefined,
      bookingAnswers,
      honeypot: body.website ? String(body.website) : undefined,
      formStartedAt: typeof body.formStartedAt === "number" ? body.formStartedAt : undefined,
      serviceName: resolvedServiceName,
      humanVerification,
    });

    if (risk.action === "block") {
      await recordSuspiciousBooking(workspace.id, {
        serviceName: resolvedServiceName,
        phone,
        email: body.email ? String(body.email) : undefined,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        signals: risk.signals,
        action: "block",
      });
      return NextResponse.json(
        {
          error: "We could not complete this booking online. Please contact the business directly.",
        },
        { status: 403 },
      );
    }

    if (risk.action === "challenge") {
      await recordSuspiciousBooking(workspace.id, {
        serviceName: resolvedServiceName,
        phone,
        email: body.email ? String(body.email) : undefined,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        signals: risk.signals,
        action: "challenge",
      });
      const emailOtpVerified = body.emailOtpVerified === true;
      const typeRequiresOtp = resolvedType?.config.bookingApproval?.required;
      if (!emailOtpVerified && (typeRequiresOtp || body.email)) {
        return NextResponse.json(
          {
            error: "Additional verification is required to complete your booking.",
            challengeRequired: true,
            otpRequired: true,
          },
          { status: 428 },
        );
      }
      return NextResponse.json(
        {
          error: "Additional verification is required to complete your booking.",
          challengeRequired: true,
        },
        { status: 428 },
      );
    }

    const utm =
      body.utm && typeof body.utm === "object"
        ? (body.utm as {
            source?: string;
            medium?: string;
            campaign?: string;
            term?: string;
            content?: string;
          })
        : undefined;
    const utmAttribution = utm
      ? {
          source: utm.source,
          medium: utm.medium,
          campaign: utm.campaign,
          term: utm.term,
          content: utm.content,
          capturedAt: new Date().toISOString(),
        }
      : undefined;

    const durationMinutes = body.durationMinutes
      ? Number(body.durationMinutes)
      : undefined;
    const serviceDuration =
      resolvedType?.id
        ? (
            await getPrisma().voiceService.findFirst({
              where: { id: resolvedType.id, workspaceId: workspace.id },
              select: { durationMinutes: true },
            })
          )?.durationMinutes
        : undefined;
    const effectiveDuration = durationMinutes || serviceDuration || 30;
    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(startsAtDate.getTime() + effectiveDuration * 60_000);

    const schedulingCtx = await loadSchedulingContext(workspace.id, resolvedServiceName);
    const assignedStaff = await resolveStaffForBooking(schedulingCtx, {
      preferredStaffId: staffId,
      preferredStaffName: body.staffName ? String(body.staffName) : undefined,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      durationMinutes: effectiveDuration,
    });
    if (assignedStaff) staffId = assignedStaff.id;

    const payment = resolvedType?.config.payment;
    let effectivePayment = payment ? { ...payment } : undefined;
    if (effectivePayment && effectivePayment.mode !== "none" && addOnSelections?.length) {
      const catalog = await listBookingAddOns(workspace.id);
      const selectedAddOnRows = addOnSelections
        .map((sel) => {
          const row = catalog.find((a: { id: string }) => a.id === sel.addOnId);
          if (!row) return null;
          return {
            priceCents: row.priceCents || 0,
            durationDeltaMinutes: row.durationDeltaMinutes || 0,
            quantity: sel.quantity ?? 1,
          };
        })
        .filter(Boolean) as Array<{ priceCents: number; durationDeltaMinutes: number; quantity?: number }>;
      const addOnTotals = calculateAddOnTotals(selectedAddOnRows);
      if (addOnTotals.priceCents > 0) {
        effectivePayment = {
          ...effectivePayment,
          priceCents: (effectivePayment.priceCents || 0) + addOnTotals.priceCents,
        };
      }
    }

    const bookInput = {
      serviceId: resolvedType?.id || serviceId,
      serviceName: resolvedServiceName,
      startsAt,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone,
      email: body.email ? String(body.email) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      bookingAnswers,
      smsConsent,
      source: "public_booking" as const,
      status:
        payment?.mode && payment.mode !== "none" ? "pending_payment" : "awaiting_confirmation",
      staffId,
      staffName: assignedStaff?.name,
      locationId,
      locationName,
      attendeeCount,
      durationMinutes: effectiveDuration || undefined,
      utm: utmAttribution,
      emailOtpVerified: body.emailOtpVerified === true,
      singleUseToken: body.singleUseToken ? String(body.singleUseToken) : undefined,
      extraRecipients,
      resourceIds,
      addOnIds,
      addOnSelections,
      intakeResponses,
      customFieldValues,
      multiServiceLines,
    };

    if (
      recurring?.frequency &&
      recurring.occurrences &&
      Number(recurring.occurrences) > 1 &&
      resolvedType?.config.recurring?.enabled
    ) {
      const freq = recurring.frequency as "weekly" | "biweekly" | "monthly";
      const maxOcc = resolvedType?.config.recurring?.maxOccurrences || 52;
      const occurrences = Math.min(Number(recurring.occurrences), maxOcc);
      const seriesResult = await createRecurringAppointments({
        workspaceId: workspace.id,
        serviceName: resolvedServiceName,
        startsAt,
        frequency: freq,
        occurrences,
        phone,
        firstName,
        lastName,
        email: body.email ? String(body.email) : undefined,
        smsConsent,
      });

      let paymentInfo = { paymentRequired: false, checkoutUrl: null as string | null };
      if (seriesResult.created[0] && effectivePayment?.mode && effectivePayment.mode !== "none") {
        paymentInfo = await attachPaymentCheckout(
          workspace.id,
          seriesResult.created[0],
          effectivePayment,
          body.email ? String(body.email) : undefined,
          `${resolvedServiceName} appointment`,
        );
      }

      return NextResponse.json(
        {
          data: {
            ...seriesResult,
            appointmentId: seriesResult.created[0],
            recurring: true,
            ...paymentInfo,
          },
        },
        { status: 201 },
      );
    }

    const result = await createPlatformAppointment(workspace.id, bookInput);
    const appointmentId = String(result.appointmentId || "");
    const contactId = String(result.contactId || "");

    let entitlementOutcome: Awaited<ReturnType<typeof applyBookingEntitlement>> | null = null;
    const entitlementMethod = body.entitlementMethod
      ? String(body.entitlementMethod)
      : "none";
    if (appointmentId && contactId && entitlementMethod !== "none") {
      let selection: BookingEntitlementSelection = { method: "none" };
      if (entitlementMethod === "package" && body.packageBalanceId) {
        selection = { method: "package", packageBalanceId: String(body.packageBalanceId) };
      } else if (entitlementMethod === "gift" && body.giftCertificateCode) {
        selection = {
          method: "gift",
          giftCertificateCode: String(body.giftCertificateCode),
        };
      }
      if (selection.method !== "none") {
        entitlementOutcome = await applyBookingEntitlement({
          workspaceId: workspace.id,
          appointmentId,
          contactId,
          bookingTypeId: resolvedType?.id || serviceId,
          serviceName: resolvedServiceName,
          payment: effectivePayment,
          selection,
        });
        if (entitlementOutcome.paymentWaived && entitlementOutcome.method !== "none") {
          await markAppointmentPaidByEntitlement(workspace.id, appointmentId, {
            method: entitlementOutcome.method,
            amountCentsWaived: entitlementOutcome.amountCentsWaived,
            packageBalanceId: entitlementOutcome.packageBalanceId,
            giftBalanceId: entitlementOutcome.giftBalanceId,
            giftCode: entitlementOutcome.giftCode,
          });
        }
      }
    }

    let paymentInfo: {
      paymentRequired: boolean;
      checkoutUrl: string | null;
      checkoutConfigured: boolean;
      checkoutError?: string | null;
      provider?: string;
      square?: {
        applicationId: string;
        locationId: string;
        amountCents: number;
        currency: string;
        sandbox?: boolean;
      };
      appointmentId?: string;
    } = { paymentRequired: false, checkoutUrl: null, checkoutConfigured: true };
    const paymentWaivedByEntitlement = Boolean(entitlementOutcome?.paymentWaived);
    let paymentHandled = paymentWaivedByEntitlement;

    if (appointmentId && payment?.mode && payment.mode !== "none" && !paymentHandled) {
      const useSavedCard = body.useSavedCard === true;
      if (useSavedCard && contactId) {
        const charged = await chargeSavedCardForAppointment({
          workspaceId: workspace.id,
          appointmentId,
          contactId,
          payment: effectivePayment,
          customerEmail: body.email ? String(body.email) : undefined,
          description: `${resolvedServiceName} appointment`,
        });
        if (charged.succeeded) {
          paymentHandled = true;
          paymentInfo = {
            paymentRequired: false,
            checkoutUrl: null,
            checkoutConfigured: true,
            appointmentId,
          };
        } else if (charged.checkoutUrl) {
          paymentHandled = true;
          paymentInfo = {
            paymentRequired: true,
            checkoutUrl: charged.checkoutUrl,
            checkoutConfigured: charged.configured,
            checkoutError: charged.error,
            provider: "stripe",
            appointmentId,
          };
        }
      }

      if (!paymentHandled) {
        paymentInfo = await attachPaymentCheckout(
          workspace.id,
          appointmentId,
          effectivePayment!,
          body.email ? String(body.email) : undefined,
          `${resolvedServiceName} appointment`,
        );
      }

      if (paymentInfo.paymentRequired && !paymentInfo.checkoutConfigured) {
        await getPrisma().voiceAppointment.update({
          where: { id: appointmentId },
          data: {
            metadata: {
              ...(result as { metadata?: object }).metadata,
              paymentStatus: "unconfigured",
              paymentError: paymentInfo.checkoutError,
            } as object,
          },
        });
      }
    }

    const { storeReturningInviteeCookieData } = await import("@/lib/appointments/booking-links");
    const returningCookie = await storeReturningInviteeCookieData(workspace.id, {
      email: body.email ? String(body.email) : undefined,
      phone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    return NextResponse.json(
      {
        data: {
          ...result,
          appointmentId,
          entitlement: entitlementOutcome,
          ...paymentInfo,
          returningInviteeCookie: returningCookie,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return jsonError(err, 400);
  }
}
