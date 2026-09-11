import "server-only";

import { getPrisma } from "@/lib/db";
import { listClassSeries } from "@/lib/appointments/service-booking/classes";
import {
  parseClassSeriesMetadata,
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
  priceCents: number;
  isFree: boolean;
  category: string | null;
  imageUrl: string | null;
  showRemainingSpots: boolean;
  waitlistEnabled: boolean;
  confirmationMessage: string | null;
  /** Null when registration is open; otherwise why it is not. */
  registrationClosedReason: string | null;
};

/**
 * The registration window an operator configured, applied to a moment in time.
 * Exported so the write path enforces the same rule the read path advertises.
 */
export function classRegistrationClosedReason(
  metadata: unknown,
  now = new Date(),
): string | null {
  const meta = parseClassSeriesMetadata(metadata);
  if (meta.registrationOpensAt && new Date(meta.registrationOpensAt) > now) {
    return `Registration opens ${new Date(meta.registrationOpensAt).toLocaleString()}`;
  }
  if (meta.registrationClosesAt && new Date(meta.registrationClosesAt) < now) {
    return "Registration has closed";
  }
  return null;
}

export async function loadPublicGroupOfferings(
  workspaceId: string,
  offeringKind: ClassSeriesOfferingKind,
): Promise<{ series: PublicGroupSeries[]; occurrences: PublicGroupOccurrence[] }> {
  const prisma = getPrisma();
  // The database accessor is untyped, so the shape this function relies on is
  // declared rather than inferred.
  const allSeries: Array<{
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    requireFullSeries: boolean;
    active: boolean;
    metadata: unknown;
  }> = await listClassSeries(workspaceId);
  // Hidden is a real setting on the class, so it has to keep the class off the
  // public listing — otherwise the toggle in the editor means nothing.
  const active = allSeries.filter(
    (s) =>
      s.active &&
      resolveClassSeriesOfferingKind(s.metadata) === offeringKind &&
      parseClassSeriesMetadata(s.metadata).visibility !== "hidden",
  );
  const seriesIds = active.map((s) => s.id);
  if (seriesIds.length === 0) {
    return { series: [], occurrences: [] };
  }

  const occurrences: Array<{
    id: string;
    seriesId: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number | null;
  }> = await prisma.classOccurrence.findMany({
    where: {
      workspaceId,
      seriesId: { in: seriesIds },
      status: "scheduled",
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  const enrollmentCounts: Array<{
    occurrenceId: string;
    _count: { occurrenceId: number };
  }> = await prisma.classEnrollment.groupBy({
    by: ["occurrenceId"],
    where: { workspaceId, status: "enrolled" },
    _count: { occurrenceId: true },
  });
  const countMap = new Map<string, number>(
    enrollmentCounts.map((e) => [e.occurrenceId, e._count.occurrenceId]),
  );

  const occurrenceIds = occurrences.map((occ) => occ.id);
  const seatMaps: Array<{
    id: string;
    occurrenceId: string | null;
    name: string;
  }> = occurrenceIds.length
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

  const series: PublicGroupSeries[] = active.map((s) => {
    const meta = parseClassSeriesMetadata(s.metadata);
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      capacity: s.capacity,
      requireFullSeries: s.requireFullSeries,
      priceCents: Number(meta.priceCents ?? 0),
      isFree: meta.isFree !== false && !(meta.priceCents && meta.priceCents > 0),
      category: meta.category ?? null,
      imageUrl: meta.imageUrl ?? null,
      showRemainingSpots: meta.showRemainingSpots !== false,
      waitlistEnabled: meta.waitlistEnabled === true,
      confirmationMessage: meta.confirmationMessage ?? null,
      registrationClosedReason: classRegistrationClosedReason(s.metadata),
    };
  });

  return { series, occurrences: publicOccurrences };
}
