import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  createPlatformAppointment,
  getAvailability,
  listAppointmentTypes,
  loadAppointmentPlatformConfig,
  resolveWorkspaceBySlug,
} from "@/lib/appointments";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking page disabled" }, { status: 403 });
    }
    const types = (await listAppointmentTypes(workspace.id)).filter((t) => t.active);
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
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "book");

    if (action === "availability") {
      const data = await getAvailability(workspace.id, {
        serviceName: body.serviceName ? String(body.serviceName) : undefined,
        daysAhead: Number(body.daysAhead || 14),
      });
      return NextResponse.json({ data });
    }

    if (body.smsConsent !== true) {
      return NextResponse.json({ error: "SMS consent is required" }, { status: 400 });
    }

    const bookingAnswers =
      body.bookingAnswers && typeof body.bookingAnswers === "object"
        ? (body.bookingAnswers as Record<string, string>)
        : undefined;

    const result = await createPlatformAppointment(workspace.id, {
      serviceId: body.serviceId ? String(body.serviceId) : undefined,
      serviceName: String(body.serviceName || ""),
      startsAt: String(body.startsAt || ""),
      firstName: body.firstName ? String(body.firstName) : undefined,
      lastName: body.lastName ? String(body.lastName) : undefined,
      phone: String(body.phone || ""),
      email: body.email ? String(body.email) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      bookingAnswers,
      smsConsent: true,
      source: "public_booking",
      status: "awaiting_confirmation",
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
