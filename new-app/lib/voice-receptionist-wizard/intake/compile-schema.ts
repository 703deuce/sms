const CALLER_ID_TO_INTAKE_KEY: Record<string, string> = {
  reason: "service_reason",
};

/** Map wizard caller row ids to canonical intake keys (Voice V3 collect-fields compile). */
export function callerFieldIdToIntakeKey(id: string): string {
  let trimmed = id.trim();
  if (trimmed === "full_name") trimmed = "name";
  if (trimmed.startsWith("custom_")) trimmed = trimmed.slice("custom_".length);
  return CALLER_ID_TO_INTAKE_KEY[trimmed] ?? trimmed;
}
