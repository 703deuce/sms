/**
 * Validate / coerce mapped custom field values before CRM writes.
 */

export type FieldTypeHint =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "url"
  | "picklist"
  | "multipicklist"
  | "owner"
  | "unknown";

export type FieldValidationIssue = {
  field: string;
  message: string;
  value: unknown;
};

export function coerceFieldValue(
  value: unknown,
  type: FieldTypeHint,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: undefined };
  }
  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return { ok: false, message: "Expected number" };
      return { ok: true, value: n };
    }
    case "boolean": {
      if (typeof value === "boolean") return { ok: true, value };
      if (value === "true" || value === "1" || value === 1) return { ok: true, value: true };
      if (value === "false" || value === "0" || value === 0) return { ok: true, value: false };
      return { ok: false, message: "Expected boolean" };
    }
    case "date": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return { ok: false, message: "Expected date" };
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case "datetime": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return { ok: false, message: "Expected datetime" };
      return { ok: true, value: d.toISOString() };
    }
    case "url": {
      const s = String(value);
      if (!/^https?:\/\//i.test(s)) return { ok: false, message: "Expected http(s) URL" };
      return { ok: true, value: s };
    }
    case "multipicklist": {
      if (Array.isArray(value)) return { ok: true, value: value.map(String) };
      return { ok: true, value: String(value).split(";").map((x) => x.trim()).filter(Boolean) };
    }
    default:
      return { ok: true, value };
  }
}

/** Infer a coarse type from a provider field name/label when describe metadata is unavailable. */
export function inferFieldType(name: string, label?: string): FieldTypeHint {
  const s = `${name} ${label || ""}`.toLowerCase();
  if (/url|website|link/.test(s)) return "url";
  if (/date/.test(s) && /time/.test(s)) return "datetime";
  if (/date|birthday|close/.test(s)) return "date";
  if (/amount|quantity|score|count|number|percent/.test(s)) return "number";
  if (/is_|has_|active|opt.?in|boolean/.test(s)) return "boolean";
  if (/owner|user.?id/.test(s)) return "owner";
  if (/multi/.test(s)) return "multipicklist";
  if (/status|stage|type|source|picklist/.test(s)) return "picklist";
  return "text";
}

export function validateMappedPayload(
  payload: Record<string, unknown>,
  fieldTypes?: Record<string, FieldTypeHint>,
): { payload: Record<string, unknown>; issues: FieldValidationIssue[] } {
  const out: Record<string, unknown> = {};
  const issues: FieldValidationIssue[] = [];
  for (const [k, v] of Object.entries(payload)) {
    const type = fieldTypes?.[k] || inferFieldType(k);
    const coerced = coerceFieldValue(v, type);
    if (!coerced.ok) {
      issues.push({ field: k, message: coerced.message, value: v });
      continue;
    }
    if (coerced.value !== undefined) out[k] = coerced.value;
  }
  return { payload: out, issues };
}
