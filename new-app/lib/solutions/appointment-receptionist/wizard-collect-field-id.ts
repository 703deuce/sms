/** Client-safe wizard field id mapping (shared by wizard UI and publish helpers). */

export function wizardCollectFieldIdToCallerRowId(id: string): string {
  const trimmed = id.trim();
  if (trimmed === "full_name") return "name";
  if (trimmed === "service") return "reason";
  return trimmed;
}
