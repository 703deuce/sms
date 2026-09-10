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

    const staffMap = new Map(
      (config.staff || []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );
    const locationMap = new Map(
      (config.locations || []).map((l: { id: string; name: string }) => [l.id, l.name]),
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
        const series = active.find((s: { id: string }) => s.id === occ.seriesId);
        const enrolled = Number(countMap.get(occ.id) ?? 0);
        const capacity = Number(occ.capacity ?? series?.capacity ?? 0);
        const meta = (series?.metadata || {}) as Record<string, unknown>;
        return {
          id: occ.id,
          seriesId: occ.seriesId,
          startsAt: occ.startsAt.toISOString(),
          endsAt: occ.endsAt.toISOString(),
          capacity,
          enrolled,
          remaining: Math.max(0, capacity - enrolled),
          instructor: series?.staffId ? staffMap.get(series.staffId) : null,
          location: series?.locationId ? locationMap.get(series.locationId) : null,
          priceCents: typeof meta.priceCents === "number" ? meta.priceCents : null,
          capacityDisplay: (meta.capacityDisplay as string) || "exact",
          waitlistEnabled: meta.waitlistEnabled === true,
          seatMapId: seatMap?.id ?? null,
          seatMapName: seatMap?.name ?? null,
          requiresSeatSelection: Boolean(seatMap?.id),
        };
      },
    );

    return NextResponse.json({
      data: {
        series: active.map(
          (s: {
            id: string;
            name: string;
            description: string | null;
            capacity: number;
            requireFullSeries: boolean;
            metadata?: unknown;
          }) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            capacity: s.capacity,
            requireFullSeries: s.requireFullSeries,
            capacityDisplay: ((s.metadata || {}) as Record<string, unknown>).capacityDisplay || "exact",
          }),
        ),
        occurrences: publicOccurrences,
        timezone: config.timezone,
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
    const partySize = Math.max(1, Math.floor(Number(body.partySize || 1)));
    const waitlist = body.waitlist === true;
    const seatMapId = body.seatMapId ? String(body.seatMapId) : undefined;
    const rowIndex = body.rowIndex != null ? Number(body.rowIndex) : undefined;
    const colIndex = body.colIndex != null ? Number(body.colIndex) : undefined;

    if (occurrenceId && waitlist) {
      const occ = await prisma.classOccurrence.findFirst({
        where: { id: occurrenceId, workspaceId: workspace.id },
        include: { series: true },
      });
      if (!occ) return NextResponse.json({ error: "Class session not found" }, { status: 404 });
      const enrolled = await prisma.classEnrollment.count({
        where: { workspaceId: workspace.id, occurrenceId, status: "enrolled" },
      });
      const capacity = Number(occ.capacity ?? occ.series?.capacity ?? 0);
      if (enrolled < capacity) {
        return NextResponse.json({ error: "This class still has openings — register instead." }, { status: 400 });
      }
      const { joinWaitlist } = await import("@/lib/appointments/waitlist");
      const entry = await joinWaitlist({
        workspaceId: workspace.id,
        contactId,
        serviceName: occ.series?.name || "Class",
        preferredDate: occ.startsAt.toISOString().slice(0, 10),
        preferredTimeStart: occ.startsAt.toISOString(),
        preferredTimeEnd: occ.endsAt.toISOString(),
        phone,
        email: body.email ? String(body.email) : undefined,
      });
      return NextResponse.json({ data: { waitlist: entry } }, { status: 201 });
    }

    if (occurrenceId) {
      const occ = await prisma.classOccurrence.findFirst({
        where: { id: occurrenceId, workspaceId: workspace.id },
        include: { series: true },
      });
      if (!occ) return NextResponse.json({ error: "Class session not found" }, { status: 404 });
      const enrolled = await prisma.classEnrollment.count({
        where: { workspaceId: workspace.id, occurrenceId, status: "enrolled" },
      });
      const capacity = Number(occ.capacity ?? occ.series?.capacity ?? 0);
      if (enrolled + partySize > capacity) {
        return NextResponse.json(
          { error: "This class doesn't have enough space for your group." },
          { status: 409 },
        );
      }
    }

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
