export function formatCapacityLabel(
  displayMode: string,
  remaining: number,
  capacity: number,
  full: boolean,
): string {
  if (full) return "Full";
  switch (displayMode) {
    case "hidden":
      return "";
    case "general":
      return remaining <= 3 ? "Limited availability" : "Spaces available";
    case "exact":
    default:
      return `${remaining} space${remaining === 1 ? "" : "s"} left`;
  }
}
