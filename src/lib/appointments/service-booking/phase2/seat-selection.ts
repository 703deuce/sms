import "server-only";

import { getPrisma } from "@/lib/db";

export type SeatLayoutCell = {
  rowIndex: number;
  colIndex: number;
  label: string;
  blocked?: boolean;
};

export async function listSeatMaps(
  workspaceId: string,
  filters?: { occurrenceId?: string; seriesId?: string },
) {
  const prisma = getPrisma();
  return prisma.classSeatMap.findMany({
    where: {
      workspaceId,
      ...(filters?.occurrenceId ? { occurrenceId: filters.occurrenceId } : {}),
      ...(filters?.seriesId ? { seriesId: filters.seriesId } : {}),
    },
    include: { reservations: { where: { status: "reserved" } } },
    orderBy: { name: "asc" },
  });
}

export async function upsertSeatMap(
  workspaceId: string,
  input: {
    id?: string;
    occurrenceId?: string;
    seriesId?: string;
    name: string;
    rows: number;
    columns: number;
    layout?: SeatLayoutCell[];
    active?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const layout =
    input.layout ??
    Array.from({ length: input.rows }, (_, row) =>
      Array.from({ length: input.columns }, (_, col) => ({
        rowIndex: row,
        colIndex: col,
        label: `${row + 1}${String.fromCharCode(65 + col)}`,
        blocked: false,
      })),
    ).flat();

  const data = {
    occurrenceId: input.occurrenceId,
    seriesId: input.seriesId,
    name: input.name.trim(),
    rows: input.rows,
    columns: input.columns,
    layout,
    active: input.active ?? true,
    metadata: input.metadata,
  };

  if (input.id) {
    return prisma.classSeatMap.update({
      where: { id: input.id, workspaceId },
      data,
      include: { reservations: { where: { status: "reserved" } } },
    });
  }

  return prisma.classSeatMap.create({
    data: { workspaceId, ...data },
    include: { reservations: true },
  });
}

export async function reserveSeat(
  workspaceId: string,
  seatMapId: string,
  input: {
    contactId: string;
    rowIndex: number;
    colIndex: number;
    enrollmentId?: string;
    seatLabel?: string;
  },
) {
  const prisma = getPrisma();
  const map = await prisma.classSeatMap.findFirst({
    where: { id: seatMapId, workspaceId, active: true },
    include: { reservations: { where: { status: "reserved" } } },
  });
  if (!map) throw new Error("Seat map not found");

  const layout = (map.layout || []) as SeatLayoutCell[];
  const cell = layout.find((c) => c.rowIndex === input.rowIndex && c.colIndex === input.colIndex);
  if (!cell || cell.blocked) throw new Error("Seat unavailable");

  const taken = map.reservations.some(
    (r: { rowIndex: number; colIndex: number }) =>
      r.rowIndex === input.rowIndex && r.colIndex === input.colIndex,
  );
  if (taken) throw new Error("Seat already reserved");

  const existingForContact = map.reservations.find(
    (r: { contactId: string; id: string }) => r.contactId === input.contactId,
  );
  if (existingForContact) {
    await prisma.classSeatReservation.update({
      where: { id: existingForContact.id },
      data: { status: "released", releasedAt: new Date() },
    });
  }

  return prisma.classSeatReservation.create({
    data: {
      seatMapId,
      contactId: input.contactId,
      enrollmentId: input.enrollmentId,
      rowIndex: input.rowIndex,
      colIndex: input.colIndex,
      seatLabel: input.seatLabel ?? cell.label,
      status: "reserved",
    },
  });
}

export async function releaseSeat(workspaceId: string, reservationId: string) {
  const prisma = getPrisma();
  const reservation = await prisma.classSeatReservation.findFirst({
    where: { id: reservationId, seatMap: { workspaceId } },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "reserved") throw new Error("Seat is not reserved");

  return prisma.classSeatReservation.update({
    where: { id: reservationId },
    data: { status: "released", releasedAt: new Date() },
  });
}

export async function getSeatMapWithAvailability(workspaceId: string, seatMapId: string) {
  const prisma = getPrisma();
  const map = await prisma.classSeatMap.findFirst({
    where: { id: seatMapId, workspaceId },
    include: { reservations: { where: { status: "reserved" } } },
  });
  if (!map) throw new Error("Seat map not found");

  const reservedKeys = new Set(
    map.reservations.map((r: { rowIndex: number; colIndex: number }) => `${r.rowIndex}:${r.colIndex}`),
  );
  const layout = (map.layout || []) as SeatLayoutCell[];

  return {
    ...map,
    seats: layout.map((cell) => ({
      ...cell,
      status: cell.blocked
        ? "blocked"
        : reservedKeys.has(`${cell.rowIndex}:${cell.colIndex}`)
          ? "reserved"
          : "available",
    })),
  };
}
