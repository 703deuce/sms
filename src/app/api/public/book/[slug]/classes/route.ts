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

      const seatMap = await prisma.classSeatMap.findFirst({
        where: { workspaceId: workspace.id, occurrenceId, active: true },
      });
      if (seatMap && (!seatMapId || rowIndex == null || colIndex == null)) {
        return NextResponse.json(
          { error: "This class requires seat selection before enrollment." },
          { status: 400 },
        );
      }
    }

    const enrollment = await enrollInClass(workspace.id, {
      contactId,
      occurrenceId,
      seriesId: body.seriesId ? String(body.seriesId) : undefined,
      enrollFullSeries: body.enrollFullSeries === true,
    });

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
