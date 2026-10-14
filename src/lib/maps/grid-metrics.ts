export function computeSolv(_input?: unknown): number {
  return 0;
}

export function rankLabel(rank: number | null | undefined): string {
  if (rank == null || rank <= 0) return "NR";
  return String(rank);
}
