export type RoomEquipmentKind = "room" | "equipment" | "other";

export type SchedulingResourceRow = {
  id: string;
  name: string;
  quantity: number;
  description?: string | null;
  active: boolean;
  eligibleTypeIds: string[];
  metadata?: Record<string, unknown> | null;
};

export type ResourceGroupRow = {
  id: string;
  name: string;
  resourceIds: string[];
  active: boolean;
};

export const ROOM_EQUIPMENT_KINDS: Array<{ value: RoomEquipmentKind; label: string }> = [
  { value: "room", label: "Room" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

export function resourceKind(row: SchedulingResourceRow): RoomEquipmentKind {
  const kind = row.metadata?.kind;
  if (kind === "room" || kind === "equipment" || kind === "other") return kind;
  return "room";
}

export function resourceKindLabel(row: SchedulingResourceRow): string {
  return ROOM_EQUIPMENT_KINDS.find((k) => k.value === resourceKind(row))?.label ?? "Room";
}

export function resourceLocationIds(row: SchedulingResourceRow): string[] {
  const ids = row.metadata?.locationIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

export function usedByCount(row: SchedulingResourceRow): number {
  return row.eligibleTypeIds?.length ?? 0;
}

export function formatLocationNames(
  locationIds: string[],
  locations: Array<{ id: string; name: string }>,
): string {
  if (!locationIds.length) return "All locations";
  const names = locationIds
    .map((id) => locations.find((l) => l.id === id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
}
