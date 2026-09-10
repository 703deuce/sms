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
import { resolveAppointmentRouting } from "@/lib/appointments/appointment-routing";
import {
  loadSchedulingContext,
  resolveStaffForBooking,
} from "@/lib/appointments/scheduling-domain";
import { SlotTakenError } from "@/lib/appointments/slot-booking";
import type { AppointmentTypeConfig, PaymentRequirement } from "@/lib/appointments/types";
import { getPrisma, type DbRow } from "@/lib/db";
import { enforcePublicBookingRateLimit } from "@/lib/appointments/public-booking-rate-limit";

type Params = { params: Promise<{ slug: string }> };

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeIntakeFormFields(fields: unknown): Array<{
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}> {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field) => {
      if (!field || typeof field !== "object") return null;
      const row = field as Record<string, unknown>;
      const id = String(row.id || "");
      const label = String(row.label || "");
      const type = String(row.type || row.fieldType || "text");
      if (!id || !label) return null;
      return {
        id,
        label,
        type,
        required: row.required === true,
        options: Array.isArray(row.options) ? row.options.map(String) : undefined,
      };
    })
    .filter((field): field is NonNullable<typeof field> => field !== null);
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
      .filter((r: { active: boolean }) => r.active)
      .map((r: { id: string; name: string; quantity: number; description: string | null; eligibleTypeIds: string[] }) => ({
        id: r.id,
        name: r.name,
        quantity: r.quantity,
        description: r.description,
        eligibleTypeIds: r.eligibleTypeIds,
      }));
    const addOns = allAddOns
      .filter((a: { active: boolean }) => a.active)
      .map((a: {
        id: string;
        name: string;
        description: string | null;
        priceCents: number;
        durationDeltaMinutes: number;
        quantityMax: number | null;
        required: boolean;
        eligibleTypeIds: string[];
      }) => ({
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
        termsVersion: config.termsVersion,
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
            fields: normalizeIntakeFormFields(f.fields),
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

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "book");

    const ip = clientIp(request);
    if (!enforcePublicBookingRateLimit(workspace.id, ip, action)) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429 },
      );
    }

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
      let walletBalanceCents = 0;
      if (contactId) {
        try {
          const { getWalletBalance } = await import(
            "@/lib/appointments/service-booking/phase2/client-wallet"
          );
          const wallet = await getWalletBalance(workspace.id, contactId);
          walletBalanceCents = wallet.balanceCents;
        } catch {
          walletBalanceCents = 0;
        }
      }
      let loyaltyPrograms: Array<{
        programId: string;
        programName: string;
        pointsBalance: number;
        redeemRateCents: number;
      }> = [];
      if (contactId) {
        try {
          const { listLoyaltyPrograms, getLoyaltyBalance } = await import(
            "@/lib/appointments/service-booking/phase2/loyalty"
          );
          const programs = await listLoyaltyPrograms(workspace.id);
          loyaltyPrograms = await Promise.all(
            programs
              .filter((p: { active: boolean }) => p.active)
              .map(async (p: { id: string; name: string; redeemRateCents: number }) => {
                const balance = await getLoyaltyBalance(workspace.id, p.id, contactId);
                return {
                  programId: p.id,
                  programName: p.name,
                  pointsBalance: balance.pointsBalance,
                  redeemRateCents: p.redeemRateCents,
                };
              }),
          );
          loyaltyPrograms = loyaltyPrograms.filter((p) => p.pointsBalance > 0);
        } catch {
          loyaltyPrograms = [];
        }
      }
      return NextResponse.json({
        data: {
          ...entitlements,
          hasSavedCard: Boolean(saved?.defaultPaymentMethodId),
          autoSuggestion,
          walletBalanceCents,
          loyaltyPrograms,
        },
      });
    }

    if (action === "validate_single_use") {
      const token = String(body.singleUseToken || "").trim();
      if (!token) {
        return NextResponse.json({ error: "Booking link is required." }, { status: 400 });
      }
      const { resolveSingleUseBookingLink } = await import("@/lib/appointments/booking-links");
      const resolved = await resolveSingleUseBookingLink(workspace.id, token);
      if (!resolved) {
        const platform = await loadAppointmentPlatformConfig(workspace.id);
        const links = (platform as { singleUseLinks?: Array<{ token: string; expiresAt?: string; usedCount: number; maxUses: number }> }).singleUseLinks || [];
        const stale = links.find((l) => l.token === token);
        if (!stale) {
          return NextResponse.json({ error: "This booking link is no longer available." }, { status: 404 });
        }
        if (stale.expiresAt && new Date(stale.expiresAt) < new Date()) {
          return NextResponse.json({ error: "This booking link has expired." }, { status: 410 });
        }
        if (stale.usedCount >= stale.maxUses) {
          return NextResponse.json({ error: "This booking link has already been used." }, { status: 410 });
        }
        return NextResponse.json({ error: "This booking link is no longer available." }, { status: 404 });
      }
      return NextResponse.json({
        data: { appointmentTypeId: resolved.appointmentTypeId, valid: true },
      });
    }

    if (action === "preview_recurring") {
      const { generateRecurringOccurrences } = await import("@/lib/appointments/recurring-schedule");
      const startsAt = String(body.startsAt || "");
      const frequency = String(body.frequency || "weekly");
      const occurrences = Math.min(Number(body.occurrences || 4), 52);
      const weekdays = Array.isArray(body.weekdays)
        ? (body.weekdays as number[]).map(Number).filter((n) => n >= 0 && n <= 6)
        : undefined;
      if (!startsAt) {
        return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
      }
      const dates = generateRecurringOccurrences({
        startsAt,
        frequency: frequency as import("@/lib/appointments/recurring-schedule").RecurringFrequency,
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
        locationId: body.locationId ? String(body.locationId) : undefined,
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
      return NextResponse.json(
        { data },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action === "evaluate_price") {
      const typeInfo = await resolveTypeConfig(
        workspace.id,
        body.serviceId ? String(body.serviceId) : undefined,
        body.serviceName ? String(body.serviceName) : undefined,
      );
      const basePriceCents = typeInfo?.config?.payment?.priceCents || 0;
      const startsAtRaw = String(body.startsAt || "");
      if (!startsAtRaw) {
        return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
      }
      const { evaluateSlotPrice } = await import(
        "@/lib/appointments/service-booking/phase2/dynamic-pricing"
      );
      const priced = await evaluateSlotPrice(workspace.id, {
        basePriceCents,
        startsAt: startsAtRaw,
        appointmentTypeId: typeInfo?.id,
        staffId: body.staffId ? String(body.staffId) : undefined,
        locationId: body.locationId ? String(body.locationId) : undefined,
      });
      return NextResponse.json({ data: priced });
    }

    if (action === "hold_slot") {
      const startsAtRaw = String(body.startsAt || "");
      const durationMinutes = Number(body.durationMinutes || 30);
      const startsAt = new Date(startsAtRaw);
      if (Number.isNaN(startsAt.getTime())) {
        return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
      }
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const { holdAppointmentSlot } = await import("@/lib/voice/calendar/slot-holds");
      const hold = await holdAppointmentSlot({
        workspaceId: workspace.id,
        phone: body.phone ? String(body.phone) : undefined,
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
        startsAt,
        endsAt,
        timezone: config.timezone,
        expiresInSeconds: 300,
        metadata: {
          source: "public_booking",
          staffId: body.staffId ? String(body.staffId) : undefined,
          locationId: body.locationId ? String(body.locationId) : undefined,
        },
      });
      return NextResponse.json({
        data: { holdId: hold.id, expiresAt: hold.expiresAt.toISOString() },
      });
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

    const routingDest = resolveAppointmentRouting(config, bookingAnswers || {});
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

    let contactIdBeforeBook = await resolveContactIdByPhone(
      workspace.id,
      phone,
      body.email ? String(body.email) : undefined,
    );

    try {
      const { resolveAuthorizedBookForContact } = await import(
        "@/lib/appointments/service-booking/portal-booking-context"
      );
      const authorizedBookFor = await resolveAuthorizedBookForContact({
        workspaceId: workspace.id,
        portalToken: body.portalToken ? String(body.portalToken) : undefined,
        bookForContactId: body.bookForContactId ? String(body.bookForContactId) : undefined,
      });
      if (authorizedBookFor) {
        contactIdBeforeBook = authorizedBookFor;
      }
    } catch (bookForErr) {
      return NextResponse.json(
        { error: bookForErr instanceof Error ? bookForErr.message : "Unauthorized booking context" },
        { status: 403 },
      );
    }
    try {
      const { assertMemberAccessForBookingType } = await import(
        "@/lib/appointments/service-booking/membership-lifecycle"
      );
      await assertMemberAccessForBookingType(
        workspace.id,
        contactIdBeforeBook,
        resolvedType?.id || serviceId,
      );
    } catch (memberErr) {
      return NextResponse.json(
        {
          error:
            memberErr instanceof Error
              ? memberErr.message
              : "An active membership is required to book this service.",
        },
        { status: 403 },
      );
    }

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
    if (effectivePayment?.mode === "pay_what_you_want") {
      const { validatePayWhatYouWantAmount } = await import(
        "@/lib/appointments/service-booking/payments-extended"
      );
      const pwywCents = Math.round(Number(body.payWhatYouWantCents || 0));
      const config = effectivePayment.payWhatYouWant || { enabled: true, minimumCents: 0 };
      try {
        const validated = validatePayWhatYouWantAmount(
          { enabled: true, minimumCents: config.minimumCents ?? 0, suggestedCents: config.suggestedCents },
          pwywCents,
        );
        effectivePayment = { ...effectivePayment, mode: "full", priceCents: validated };
      } catch (pwywErr) {
        return NextResponse.json(
          { error: pwywErr instanceof Error ? pwywErr.message : "Invalid amount" },
          { status: 400 },
        );
      }
    }
    if (
      effectivePayment &&
      (effectivePayment.mode === "deposit_fixed" ||
        effectivePayment.mode === "deposit_percent" ||
        effectivePayment.mode === "customer_choice")
    ) {
      effectivePayment = { ...effectivePayment, mode: "deposit" };
    }
    if (effectivePayment?.mode === "optional") {
      effectivePayment = { ...effectivePayment, mode: "none" };
    }
    if (effectivePayment?.priceCents && startsAt) {
      try {
        const { evaluateSlotPrice } = await import(
          "@/lib/appointments/service-booking/phase2/dynamic-pricing"
        );
        const priced = await evaluateSlotPrice(workspace.id, {
          basePriceCents: effectivePayment.priceCents,
          startsAt: startsAtDate,
          appointmentTypeId: resolvedType?.id || serviceId,
          locationId,
          staffId,
        });
        if (priced.finalPriceCents !== priced.basePriceCents) {
          effectivePayment = {
            ...effectivePayment,
            priceCents: priced.finalPriceCents,
            dynamicPricing: priced,
          };
        }
      } catch {
        // Dynamic pricing optional — base price stands
      }
    }
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

    const couponCode = body.couponCode ? String(body.couponCode).trim() : "";
    if (couponCode && effectivePayment?.priceCents) {
      try {
        const { validateAndApplyCoupon } = await import(
          "@/lib/appointments/service-booking/coupons"
        );
        const couponResult = await validateAndApplyCoupon(workspace.id, couponCode, {
          baseCents: effectivePayment.priceCents,
          contactId: contactIdBeforeBook ?? undefined,
          targetKind: "booking_type",
          targetId: resolvedType?.id || serviceId,
        });
        effectivePayment = {
          ...effectivePayment,
          priceCents: couponResult.totalCents,
          couponCode,
          couponDiscountCents: couponResult.discountCents,
          couponRedemptionId: couponResult.redemptionId,
        };
      } catch (couponErr) {
        return NextResponse.json(
          {
            error:
              couponErr instanceof Error ? couponErr.message : "This promo code is invalid or expired.",
          },
          { status: 400 },
        );
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
      termsAccepted: body.termsAccepted === true,
      termsVersion: body.termsVersion ? String(body.termsVersion) : undefined,
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
      contactId: contactIdBeforeBook || undefined,
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

    if (appointmentId && body.holdId) {
      const { convertHoldToAppointment } = await import("@/lib/voice/calendar/slot-holds");
      await convertHoldToAppointment({
        workspaceId: workspace.id,
        appointmentId,
        holdId: String(body.holdId),
        phone,
      });
    }

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
    let paymentDue = effectivePayment ? { ...effectivePayment } : undefined;
    const loyaltyRedeemPoints = Math.max(0, Math.floor(Number(body.loyaltyRedeemPoints || 0)));
    const loyaltyProgramId = body.loyaltyProgramId ? String(body.loyaltyProgramId) : undefined;
    if (loyaltyRedeemPoints > 0 && loyaltyProgramId && contactId && paymentDue?.priceCents) {
      try {
        const { redeemLoyaltyPoints, loyaltyRedeemValueCents } = await import(
          "@/lib/appointments/service-booking/phase2/loyalty"
        );
        const prisma = getPrisma();
        const program = await prisma.loyaltyProgram.findFirst({
          where: { id: loyaltyProgramId, workspaceId: workspace.id, active: true },
        });
        if (!program) throw new Error("Loyalty program not found");
        await redeemLoyaltyPoints(workspace.id, loyaltyProgramId, contactId, loyaltyRedeemPoints, {
          appointmentId,
          note: "Redeemed at booking checkout",
        });
        const discountCents = loyaltyRedeemValueCents(program, loyaltyRedeemPoints);
        paymentDue = { ...paymentDue, priceCents: Math.max(0, (paymentDue.priceCents ?? 0) - discountCents) };
        if ((paymentDue.priceCents ?? 0) <= 0) paymentHandled = true;
      } catch (loyaltyErr) {
        return NextResponse.json(
          {
            error:
              loyaltyErr instanceof Error ? loyaltyErr.message : "Could not apply loyalty points",
          },
          { status: 400 },
        );
      }
    }

    const walletApplyCents = Math.max(0, Number(body.walletApplyCents || 0));
    if (walletApplyCents > 0 && contactId && paymentDue?.priceCents) {
      try {
        const { debitWallet } = await import("@/lib/appointments/service-booking/phase2/client-wallet");
        const applied = Math.min(walletApplyCents, paymentDue.priceCents);
        await debitWallet(workspace.id, contactId, applied, {
          kind: "booking_checkout",
          referenceId: appointmentId,
          note: "Applied to booking checkout",
        });
        paymentDue = { ...paymentDue, priceCents: (paymentDue.priceCents ?? 0) - applied };
        if ((paymentDue.priceCents ?? 0) <= 0) paymentHandled = true;
      } catch {
        // Wallet debit failed — continue with full payment due
      }
    }

    if (appointmentId && payment?.mode && payment.mode !== "none" && !paymentHandled) {
      const useSavedCard = body.useSavedCard === true;
      if (useSavedCard && contactId && paymentDue) {
        const charged = await chargeSavedCardForAppointment({
          workspaceId: workspace.id,
          appointmentId,
          contactId,
          payment: paymentDue,
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
          paymentDue!,
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

    if (contactId && appointmentId && effectivePayment?.priceCents) {
      try {
        const { listLoyaltyPrograms, earnLoyaltyPoints } = await import(
          "@/lib/appointments/service-booking/phase2/loyalty"
        );
        const programs = await listLoyaltyPrograms(workspace.id);
        const activeProgram = programs.find((p: { active: boolean }) => p.active);
        if (activeProgram) {
          await earnLoyaltyPoints(workspace.id, activeProgram.id, contactId, {
            spendCents: effectivePayment.priceCents,
            appointmentId,
            note: "Earned from booking",
          });
        }
      } catch {
        // Loyalty earn is best-effort
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
