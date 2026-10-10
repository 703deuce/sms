export const TEMPLATE_VARIABLE_KEYS = [
  "first_name",
  "business_name",
  "appointment_date",
  "appointment_time",
  "location",
  "business_phone",
  "appointment_link",
  "confirm_link",
  "reschedule_link",
  "cancel_link",
  "directions_link",
  "service",
  "manage_link",
] as const;

const REQUIRED_AT_SEND = new Set(["business_name", "appointment_date", "appointment_time"]);

export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}|\{([a-z_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    found.add(m[1] || m[2]);
  }
  return [...found];
}

export function validateTemplateVariables(
  template: string,
  resolved: Record<string, string | undefined | null>,
): { missing: string[]; warnings: string[] } {
  const vars = extractTemplateVariables(template);
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of vars) {
    const val = resolved[key];
    if (val == null || String(val).trim() === "") {
      if (REQUIRED_AT_SEND.has(key)) missing.push(key);
      else warnings.push(key);
    }
  }

  return { missing, warnings };
}

export function normalizeLibraryBraces(text: string): string {
  return text.replace(/\{([a-z_]+)\}/g, "{{$1}}");
}
