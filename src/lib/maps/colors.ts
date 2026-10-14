export function rankHex(rank: number | null | undefined): string {
  if (rank == null || rank <= 0) return "#94a3b8";
  if (rank <= 3) return "#22c55e";
  if (rank <= 10) return "#eab308";
  return "#ef4444";
}

export function rankTextColor(rank: number | null | undefined): string {
  return rank != null && rank > 0 && rank <= 10 ? "#0f172a" : "#64748b";
}
