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
