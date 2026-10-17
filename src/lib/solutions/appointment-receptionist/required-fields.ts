/** Wizard appointment-type field id → Voice V3 intake key (published runtime). */
export function mapServiceRequiredFieldToV3IntakeKey(fieldId: string): string {
  const trimmed = String(fieldId).trim();
  if (trimmed === "service" || trimmed === "serviceName") return "service_reason";
  if (trimmed === "full_name") return "name";
  if (trimmed === "reason") return "service_reason";
  if (trimmed.startsWith("custom_")) return trimmed.slice("custom_".length);
  return trimmed;
}

/** Filter + normalize wizard service requiredFields for Voice V3 book_appointment gates. */
export function resolveServiceRequiredFieldsForV3(
  typeFields: string[] | undefined,
  collectFields: Array<{ id: string; enabled?: boolean }>,
): string[] | undefined {
  const resolved = resolveServiceRequiredFields(typeFields, collectFields);
  if (!resolved.length) return undefined;
  const keys = [...new Set(resolved.map(mapServiceRequiredFieldToV3IntakeKey))];
  return keys.length ? keys : undefined;
}

/** Keep service requiredFields aligned with what the wizard actually collects. */
export function resolveServiceRequiredFields(
  typeFields: string[] | undefined,
  collectFields: Array<{ id: string; enabled?: boolean }>,
): string[] {
  const base = Array.isArray(typeFields) ? typeFields.map(String) : [];
  const enabledIds = new Set(
    collectFields.filter((f) => f.enabled !== false).map((f) => f.id),
  );
  if (!enabledIds.size) return base;
  return base.filter((field) => {
    if (field === "service" || field === "serviceName") return true;
    if (enabledIds.has(field)) return true;
    if (field === "full_name" && (enabledIds.has("name") || enabledIds.has("full_name"))) {
      return true;
    }
    return false;
  });
}
