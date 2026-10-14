export type GridEntityRef = {
  key: string;
  name: string;
  placeId?: string | null;
  cid?: string | null;
};

export function normalizeRankForCalc(rank: number | null | undefined): number {
  return rank == null || rank <= 0 ? 21 : rank;
}

export function entityKeyFromParts(parts: { placeId?: string | null; cid?: string | null; name?: string }): string {
  return parts.placeId ?? parts.cid ?? parts.name ?? "unknown";
}

export function buildYouEntity(name: string): GridEntityRef {
  return { key: "you", name };
}

export function entitiesFromTopCompetitors(_rows: unknown[]): GridEntityRef[] {
  return [];
}

export function buildEntityGridCells(_input?: unknown): unknown[] {
  return [];
}
