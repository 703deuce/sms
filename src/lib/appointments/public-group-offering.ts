import "server-only";

import { getPrisma } from "@/lib/db";
import { listClassSeries } from "@/lib/appointments/service-booking/classes";
import {
  resolveClassSeriesOfferingKind,
  type ClassSeriesOfferingKind,
} from "@/lib/appointments/class-series-offering";

export type PublicGroupOccurrence = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolled: number;
  remaining: number;
  seatMapId: string | null;
  seatMapName: string | null;
  requiresSeatSelection: boolean;
};

export type PublicGroupSeries = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  requireFullSeries: boolean;
};

export async function loadPublicGroupOfferings(
  workspaceId: string,
  offeringKind: ClassSeriesOfferingKind,
): Promise<{ series: PublicGroupSeries[]; occurrences: PublicGroupOccurrence[] }> {
  const prisma = getPrisma();
  const allSeries = await listClassSeries(workspaceId);
  const active = allSeries.filter(
    (s) =>
      s.active &&
      resolveClassSeriesOfferingKind(s.metadata) === offeringKind,
  );
  const seriesIds = active.map((s) => s.id);
  if (seriesIds.length === 0) {
    return { series: [], occurrences: [] };
  }

  const occurrences = await prisma.classOccurrence.findMany({
    where: {
      workspaceId,
      seriesId: { in: seriesIds },
      status: "scheduled",
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  const enrollmentCounts = await prisma.classEnrollment.groupBy({
    by: ["occurrenceId"],
    where: { workspaceId, status: "enrolled" },
    _count: { occurrenceId: true },
  });
  const countMap = new Map(
    enrollmentCounts.map((e) => [e.occurrenceId, e._count.occurrenceId]),
  );

  const occurrenceIds = occurrences.map((occ) => occ.id);
  const seatMaps = occurrenceIds.length
    ? await prisma.classSeatMap.findMany({
        where: { workspaceId, occurrenceId: { in: occurrenceIds }, active: true },
        select: { id: true, occurrenceId: true, name: true },
      })
    : [];
  const seatMapByOccurrence = new Map<string, { id: string; name: string }>(
    seatMaps
      .filter((m) => Boolean(m.occurrenceId))
      .map((m) => [String(m.occurrenceId), { id: m.id, name: m.name }]),
  );

  const publicOccurrences: PublicGroupOccurrence[] = occurrences.map((occ) => {
    const seatMap = seatMapByOccurrence.get(occ.id);
    const enrolled = Number(countMap.get(occ.id) ?? 0);
    const cap = Number(occ.capacity ?? 0);
    return {
      id: occ.id,
      seriesId: occ.seriesId,
      startsAt: occ.startsAt.toISOString(),
      endsAt: occ.endsAt.toISOString(),
      capacity: cap,
      enrolled,
      remaining: Math.max(0, cap - enrolled),
      seatMapId: seatMap?.id ?? null,
      seatMapName: seatMap?.name ?? null,
      requiresSeatSelection: Boolean(seatMap?.id),
    };
  });

  const series: PublicGroupSeries[] = active.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    capacity: s.capacity,
    requireFullSeries: s.requireFullSeries,
  }));

  return { series, occurrences: publicOccurrences };
}
