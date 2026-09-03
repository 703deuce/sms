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
import { SlotTakenError } from "@/lib/appointments/slot-booking";

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

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }
    const types = (await listAppointmentTypes(workspace.id)).filter((t: { active: boolean }) => t.active);
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
      serviceName: body.serviceName ? String(body.serviceName) : undefined,
      humanVerification,
    });

    if (risk.action === "block") {
      await recordSuspiciousBooking(workspace.id, {
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
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
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
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

    const result = await createPlatformAppointment(workspace.id, {
      serviceId: body.serviceId ? String(body.serviceId) : undefined,
      serviceName: String(body.serviceName || ""),
      startsAt: String(body.startsAt || ""),
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone,
      email: body.email ? String(body.email) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      bookingAnswers,
      smsConsent,
      source: "public_booking",
      status: "awaiting_confirmation",
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return jsonError(err, 400);
  }
}
