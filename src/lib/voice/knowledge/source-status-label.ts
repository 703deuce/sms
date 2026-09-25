/** Customer-facing labels for VoiceKnowledgeSource.status */
export function customerSourceStatusLabel(status: string): string {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "pending":
      return "Waiting to process";
    case "processing":
      return "Processing";
    case "indexed":
      return "Ready for search";
    case "ready":
      return "Ready for search";
    case "failed":
      return "Needs attention";
    case "active":
      return "Waiting to process";
    default:
      return "Processing";
  }
}

export function isSourceSearchReady(status: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "indexed" || s === "ready";
}
