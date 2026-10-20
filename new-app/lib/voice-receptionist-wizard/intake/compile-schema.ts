/** Minimal intake key mapping for Voice V3 wizard collectFields (full schema compile lives in monolith). */

const CALLER_ID_TO_INTAKE_KEY: Record<string, string> = {
  reason: "service_reason",
};

export function callerFieldIdToIntakeKey(id: string): string {
  let trimmed = id.trim();
  if (trimmed === "full_name") trimmed = "name";
  if (trimmed.startsWith("custom_")) trimmed = trimmed.slice("custom_".length);
  return CALLER_ID_TO_INTAKE_KEY[trimmed] ?? trimmed;
}
