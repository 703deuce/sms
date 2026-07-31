/**
 * Shared template merge for SMS/email bodies.
 * Supports {{first_name}}, {{last_name}}, {{name}}, {{business_name}},
 * {{phone}}, {{email}}, {{tracking_link}}, {{review_link}}, and arbitrary keys.
 */
export function mergeTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function splitDisplayName(displayName?: string | null) {
  const parts = (displayName || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
    name: displayName || parts[0] || "",
  };
}
