import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadPublicGroupOfferings } from "@/lib/appointments/public-group-offering";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking disabled" }, { status: 403 });
    }

    const data = await loadPublicGroupOfferings(workspace.id, "class");
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Listing classes already refuses when the booking page is switched off.
    // Registering has to refuse as well, or a page loaded while it was still on
    // can keep enrolling people after it is turned off.
    const config = await loadAppointmentPlatformConfig(workspace.id);
    if (!config.bookingEnabled) {
      return NextResponse.json({ error: "Booking disabled" }, { status: 403 });
    }

    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    if (!phone || !firstName) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const { resolveContactIdByPhone } = await import(
      "@/lib/appointments/service-booking/booking-entitlements"
    );
    const { enrollInClass } = await import("@/lib/appointments/service-booking/classes");
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();

    let contactId = await resolveContactIdByPhone(
      workspace.id,
      phone,
      body.email ? String(body.email) : undefined,
    );
    if (!contactId) {
      const created = await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          firstName,
          lastName,
          phone,
          email: body.email ? String(body.email) : null,
          status: "SUBSCRIBED",
        },
      });
      contactId = created.id;
    }

    if (!contactId) {
      return NextResponse.json({ error: "Contact required" }, { status: 400 });
    }

    const occurrenceId = body.occurrenceId ? String(body.occurrenceId) : undefined;
    const seatMapId = body.seatMapId ? String(body.seatMapId) : undefined;
    const rowIndex = body.rowIndex != null ? Number(body.rowIndex) : undefined;
    const colIndex = body.colIndex != null ? Number(body.colIndex) : undefined;

    let seriesForRegistration: { id: string; metadata: unknown } | null = null;

    if (occurrenceId) {
      const occ = await prisma.classOccurrence.findFirst({
        where: { id: occurrenceId, workspaceId: workspace.id },
        include: { series: true },
      });
      if (!occ?.series) {
        return NextResponse.json({ error: "Class session not found" }, { status: 404 });
      }
      const { resolveClassSeriesOfferingKind } = await import(
        "@/lib/appointments/class-series-offering"
      );
      if (resolveClassSeriesOfferingKind(occ.series.metadata) !== "class") {
        return NextResponse.json({ error: "Invalid class session" }, { status: 400 });
      }
      seriesForRegistration = { id: occ.series.id, metadata: occ.series.metadata };

      const seatMap = await prisma.classSeatMap.findFirst({
        where: { workspaceId: workspace.id, occurrenceId, active: true },
      });
      if (seatMap && (!seatMapId || rowIndex == null || colIndex == null)) {
        return NextResponse.json(
          { error: "This class requires seat selection before enrollment." },
          { status: 400 },
        );
      }
    } else if (body.seriesId) {
      const series = await prisma.classSeries.findFirst({
        where: { id: String(body.seriesId), workspaceId: workspace.id },
      });
      if (!series) return NextResponse.json({ error: "Class not found" }, { status: 404 });
      seriesForRegistration = { id: series.id, metadata: series.metadata };
    }

    // The registration window is a setting on the class, so it is enforced
    // here rather than only hidden in the UI — a stale page must not be able
    // to register somebody after registration closed.
    if (seriesForRegistration) {
      const { classRegistrationClosedReason } = await import(
        "@/lib/appointments/public-group-offering"
      );
      const closed = classRegistrationClosedReason(seriesForRegistration.metadata);
      if (closed) return NextResponse.json({ error: closed }, { status: 400 });
    }

    let enrollment;
    try {
      enrollment = await enrollInClass(workspace.id, {
        contactId,
        occurrenceId,
        seriesId: body.seriesId ? String(body.seriesId) : undefined,
        enrollFullSeries: body.enrollFullSeries === true,
      });
    } catch (err) {
      // A class with a waitlist turns "full" into a place in the queue rather
      // than a dead end. Without one the capacity error stands.
      const message = err instanceof Error ? err.message : "Registration failed";
      const { parseClassSeriesMetadata } = await import(
        "@/lib/appointments/class-series-offering"
      );
      if (!seriesForRegistration || !message.toLowerCase().includes("full")) throw err;
      if (parseClassSeriesMetadata(seriesForRegistration.metadata).waitlistEnabled !== true) {
        throw err;
      }

      const { joinClassWaitlist } = await import("@/lib/appointments/service-booking/classes");
      const entry = await joinClassWaitlist(workspace.id, {
        seriesId: seriesForRegistration.id,
        occurrenceId,
        contactId,
      });
      return NextResponse.json({ data: { waitlisted: true, entry } }, { status: 202 });
    }

    let seatReservation = null;
    if (seatMapId && rowIndex != null && colIndex != null && contactId) {
      const { reserveSeat } = await import("@/lib/appointments/service-booking/phase2/seat-selection");
      const enrollmentId = Array.isArray(enrollment) ? enrollment[0]?.id : enrollment?.id;
      seatReservation = await reserveSeat(workspace.id, seatMapId, {
        contactId,
        rowIndex,
        colIndex,
        enrollmentId,
        seatLabel: body.seatLabel ? String(body.seatLabel) : undefined,
      });
    }

    return NextResponse.json({ data: { enrollment, seatReservation } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
