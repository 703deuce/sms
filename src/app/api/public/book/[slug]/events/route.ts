import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { listClassSeries } from "@/lib/appointments/service-booking/classes";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

function isEventSeries(series: { metadata?: unknown; requireFullSeries: boolean }, occurrenceCount: number) {
  const meta = (series.metadata || {}) as Record<string, unknown>;
  if (meta.kind === "event" || meta.kind === "workshop") return true;
  if (!series.requireFullSeries && occurrenceCount === 1) return true;
  return false;
}

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
      take: 200,
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

    const staffMap = new Map(
      (config.staff || []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );
    const locationMap = new Map(
      (config.locations || []).map((l: { id: string; name: string }) => [l.id, l.name]),
    );

    const occBySeries = new Map<string, typeof occurrences>();
    for (const occ of occurrences) {
      const list = occBySeries.get(occ.seriesId) || [];
      list.push(occ);
      occBySeries.set(occ.seriesId, list);
    }

    const eventSeries = active.filter((s: { id: string; metadata?: unknown; requireFullSeries: boolean }) =>
      isEventSeries(s, (occBySeries.get(s.id) || []).length),
    );
    const eventSeriesIds = new Set(eventSeries.map((s: { id: string }) => s.id));

    const publicOccurrences = occurrences
      .filter((occ: { seriesId: string }) => eventSeriesIds.has(occ.seriesId))
      .map(
        (occ: {
          id: string;
          seriesId: string;
          startsAt: Date;
          endsAt: Date;
          capacity: number | null;
        }) => {
          const series = eventSeries.find((s: { id: string }) => s.id === occ.seriesId);
          const enrolled = Number(countMap.get(occ.id) ?? 0);
          const capacity = Number(occ.capacity ?? series?.capacity ?? 0);
          const remaining = Math.max(0, capacity - enrolled);
          const meta = (series?.metadata || {}) as Record<string, unknown>;
          return {
            id: occ.id,
            seriesId: occ.seriesId,
            title: series?.name || "Event",
            description: series?.description,
            startsAt: occ.startsAt.toISOString(),
            endsAt: occ.endsAt.toISOString(),
            capacity,
            enrolled,
            remaining,
            instructor: series?.staffId ? staffMap.get(series.staffId) : null,
            location: series?.locationId ? locationMap.get(series.locationId) : null,
            priceCents: typeof meta.priceCents === "number" ? meta.priceCents : null,
            capacityDisplay: (meta.capacityDisplay as string) || "exact",
            waitlistEnabled: meta.waitlistEnabled === true,
          };
        },
      );

    return NextResponse.json({
      data: {
        events: publicOccurrences,
        timezone: config.timezone,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
