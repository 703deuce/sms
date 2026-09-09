import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { listClassSeries } from "@/lib/appointments/service-booking/classes";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";

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

    const prisma = getPrisma();
    const series = await listClassSeries(workspace.id);
    const active = series.filter((s: { active: boolean }) => s.active);

    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        workspaceId: workspace.id,
        status: "scheduled",
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });

    const enrollmentCounts = await prisma.classEnrollment.groupBy({
      by: ["occurrenceId"],
      where: { workspaceId: workspace.id, status: "enrolled" },
      _count: { occurrenceId: true },
    });
    const countMap = new Map(
      enrollmentCounts.map((e: { occurrenceId: string; _count: { occurrenceId: number } }) => [
        e.occurrenceId,
        e._count.occurrenceId,
      ]),
    );

    const occurrenceIds = occurrences.map((occ: { id: string }) => occ.id);
    const seatMaps = occurrenceIds.length
      ? await prisma.classSeatMap.findMany({
          where: { workspaceId: workspace.id, occurrenceId: { in: occurrenceIds }, active: true },
          select: { id: true, occurrenceId: true, name: true },
        })
      : [];
    const seatMapByOccurrence = new Map<string, { id: string; name: string }>(
      seatMaps
        .filter((m: { occurrenceId: string | null }) => Boolean(m.occurrenceId))
        .map((m: { id: string; occurrenceId: string | null; name: string }) => [
          String(m.occurrenceId),
          { id: m.id, name: m.name },
        ]),
    );

    const publicOccurrences = occurrences.map(
      (occ: {
        id: string;
        seriesId: string;
        startsAt: Date;
        endsAt: Date;
        capacity: number | null;
      }) => {
        const seatMap = seatMapByOccurrence.get(occ.id);
        return {
          id: occ.id,
          seriesId: occ.seriesId,
          startsAt: occ.startsAt.toISOString(),
          endsAt: occ.endsAt.toISOString(),
          capacity: occ.capacity,
          enrolled: Number(countMap.get(occ.id) ?? 0),
          remaining: Math.max(0, Number(occ.capacity ?? 0) - Number(countMap.get(occ.id) ?? 0)),
          seatMapId: seatMap?.id ?? null,
          seatMapName: seatMap?.name ?? null,
          requiresSeatSelection: Boolean(seatMap?.id),
        };
      },
    );

    return NextResponse.json({
      data: {
        series: active.map((s: { id: string; name: string; description: string | null; capacity: number; requireFullSeries: boolean }) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          capacity: s.capacity,
          requireFullSeries: s.requireFullSeries,
        })),
        occurrences: publicOccurrences,
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

    let contactId = await resolveContactIdByPhone(workspace.id, phone, body.email ? String(body.email) : undefined);
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
