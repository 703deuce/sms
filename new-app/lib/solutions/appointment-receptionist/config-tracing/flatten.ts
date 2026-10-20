import type { AppointmentReceptionistWizardState } from "../types";

export type FlatWizardConfig = Record<string, unknown>;

const MAX_DEPTH = 8;

export function flattenWizardState(
  state: Partial<AppointmentReceptionistWizardState> | Record<string, unknown> | null | undefined,
  prefix = "",
  depth = 0,
): FlatWizardConfig {
  const out: FlatWizardConfig = {};
  if (!state || typeof state !== "object" || depth > MAX_DEPTH) return out;

  for (const [key, value] of Object.entries(state)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      out[path] = value;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out[path] = [];
        continue;
      }
      const allPrimitive = value.every(
        (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
      );
      if (allPrimitive) {
        out[path] = value;
      } else {
        value.forEach((item, index) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            Object.assign(out, flattenWizardState(item as Record<string, unknown>, `${path}[${index}]`, depth + 1));
          } else {
            out[`${path}[${index}]`] = item;
          }
        });
      }
      continue;
    }
    if (typeof value === "object") {
      Object.assign(out, flattenWizardState(value as Record<string, unknown>, path, depth + 1));
      continue;
    }
    out[path] = value;
  }
  return out;
}

export function stableJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
