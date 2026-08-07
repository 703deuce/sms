import type { BuilderFieldType, WorkflowFieldDefinition } from "./types";

export class FieldValidationError extends Error {
  constructor(
    public readonly fieldId: string,
    message: string,
  ) {
    super(message);
    this.name = "FieldValidationError";
  }
}

export function validateFieldValue(
  def: WorkflowFieldDefinition,
  raw: unknown,
): string | number | boolean {
  const str = raw == null ? "" : String(raw).trim();
  if (!str && def.required) {
    throw new FieldValidationError(def.field_id, `${def.label} is required`);
  }
  if (!str) return "";

  switch (def.type) {
    case "number": {
      const n = Number(str.replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        throw new FieldValidationError(def.field_id, `${def.label} must be a number`);
      }
      return n;
    }
    case "boolean": {
      const lower = str.toLowerCase();
      if (["true", "yes", "y", "1"].includes(lower)) return true;
      if (["false", "no", "n", "0"].includes(lower)) return false;
      throw new FieldValidationError(def.field_id, `${def.label} must be yes or no`);
    }
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        throw new FieldValidationError(def.field_id, `${def.label} must be a valid email`);
      }
      return str;
    }
    case "phone":
      return str;
    case "single_select": {
      if (def.options?.length && !def.options.some((o) => o.toLowerCase() === str.toLowerCase())) {
        throw new FieldValidationError(
          def.field_id,
          `${def.label} must be one of: ${def.options.join(", ")}`,
        );
      }
      return str;
    }
    case "multi_select": {
      const parts = str.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (def.options?.length) {
        for (const p of parts) {
          if (!def.options.some((o) => o.toLowerCase() === p.toLowerCase())) {
            throw new FieldValidationError(
              def.field_id,
              `${def.label} option "${p}" is not allowed`,
            );
          }
        }
      }
      return parts.join(", ");
    }
    case "date":
    case "datetime":
    case "address":
    case "long_text":
    case "text":
    default:
      return str;
  }
}
