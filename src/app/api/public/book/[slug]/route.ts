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
  loadSchedulingContext,
  resolveRoutingDestination,
  resolveStaffForBooking,
} from "@/lib/appointments/scheduling-domain";
import { SlotTakenError } from "@/lib/appointments/slot-booking";
import type { AppointmentTypeConfig, PaymentRequirement } from "@/lib/appointments/types";
import { getPrisma } from "@/lib/db";

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
    const match = types.find((t) => t.id === serviceId);
    if (match) return { id: match.id, name: match.name, config: match.config || {} };
  }
  if (serviceName) {
    const match = types.find((t) => t.name === serviceName);
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
      .map((t: { id: string; name: string; durationMinutes: number; config: unknown }) => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
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

    if (action === "availability") {
      const data = await getAvailability(workspace.id, {
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
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

    const schedulingCtx = await loadSchedulingContext(workspace.id, resolvedServiceName);
    const assignedStaff = await resolveStaffForBooking(schedulingCtx, {
      preferredStaffId: staffId,
      preferredStaffName: body.staffName ? String(body.staffName) : undefined,
    });
    if (assignedStaff) {
      staffId = assignedStaff.id;
    }

    if (locationId) {
      const loc = (config.locations || []).find((l) => l.id === locationId);
      locationName = loc?.name;
    } else if (resolvedType?.config.locationId) {
      locationId = resolvedType.config.locationId;
      locationName = resolvedType.config.location;
    }

    const attendeeCount = body.attendeeCount ? Number(body.attendeeCount) : undefined;
    const recurring = body.recurring as
      | { frequency?: string; occurrences?: number }
      | undefined;

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
      return NextResponse.json(
        {
          error: "Additional verification is required to complete your booking.",
          challengeRequired: true,
        },
        { status: 428 },
      );
    }

    const payment = resolvedType?.config.payment;
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
      status: payment?.mode && payment.mode !== "none" ? "awaiting_confirmation" : "awaiting_confirmation",
      staffId,
      staffName: assignedStaff?.name,
      locationId,
      locationName,
      attendeeCount,
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
      if (seriesResult.created[0] && payment?.mode && payment.mode !== "none") {
        paymentInfo = await attachPaymentCheckout(
          workspace.id,
          seriesResult.created[0],
          payment,
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

    let paymentInfo: {
      paymentRequired: boolean;
      checkoutUrl: string | null;
      checkoutConfigured: boolean;
      checkoutError?: string | null;
    } = { paymentRequired: false, checkoutUrl: null, checkoutConfigured: true };
    if (appointmentId && payment?.mode && payment.mode !== "none") {
      paymentInfo = await attachPaymentCheckout(
        workspace.id,
        appointmentId,
        payment,
        body.email ? String(body.email) : undefined,
        `${resolvedServiceName} appointment`,
      );
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

    return NextResponse.json(
      { data: { ...result, ...paymentInfo } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return jsonError(err, 400);
  }
}
