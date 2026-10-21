import type { IntakeFieldDefinition } from "../config/agent-config";
import type { CapturedField } from "../state/call-context";

/** Canonical intake key → alternate keys that may appear in legacy or tool payloads. */
export const STORED_INTAKE_KEY_ALIASES: Record<string, readonly string[]> = {
  name: ["name", "full_name", "caller_name"],
  phone: ["phone", "callback_phone", "callback_number"],
  service_reason: ["service_reason", "service", "reason", "notes"],
};

export function intakeLookupKeysForCanonical(canonicalKey: string): string[] {
  const aliases = STORED_INTAKE_KEY_ALIASES[canonicalKey];
  if (!aliases) return [canonicalKey];
  return [...aliases];
}

export function resolveStoredIntakeField(
  values: Record<string, CapturedField | undefined>,
  canonicalKey: string,
): CapturedField | undefined {
  for (const key of intakeLookupKeysForCanonical(canonicalKey)) {
    const row = values[key];
    if (row?.value?.trim()) return row;
  }
  return undefined;
}

export function resolveStoredIntakeString(
  values: Record<string, CapturedField | undefined>,
  canonicalKey: string,
): string | null {
  const v = resolveStoredIntakeField(values, canonicalKey)?.value?.trim();
  return v || null;
}

function fieldMatchesCanonicalRole(
  field: IntakeFieldDefinition,
  role: "name" | "phone" | "email",
): boolean {
  if (role === "phone") return field.type === "phone";
  if (role === "email") return field.type === "email";
  const label = field.label.trim().toLowerCase();
  return (
    field.type === "text" &&
    (label.includes("name") || label.includes("full name") || label === "caller")
  );
}

/** Resolve canonical caller identity when editor intake keys are opaque ids (e.g. i1, i2). */
export function resolveStoredIntakeStringFromConfig(
  values: Record<string, CapturedField | undefined>,
  canonicalKey: "name" | "phone" | "email",
  intakeFields?: IntakeFieldDefinition[],
): string | null {
  const direct = resolveStoredIntakeString(values, canonicalKey);
  if (direct) return direct;
  if (!intakeFields?.length) return null;
  const match = intakeFields.find((f) => fieldMatchesCanonicalRole(f, canonicalKey));
  if (!match) return null;
  const v = values[match.key]?.value?.trim();
  return v || null;
}

export function resolveCustomerIdentityFromIntake(
  config: { intakeFields: IntakeFieldDefinition[] },
  values: Record<string, CapturedField | undefined>,
): { name: string | null; phone: string | null; email: string | null } {
  return {
    name: resolveStoredIntakeStringFromConfig(values, "name", config.intakeFields),
    phone: resolveStoredIntakeStringFromConfig(values, "phone", config.intakeFields),
    email: resolveStoredIntakeStringFromConfig(values, "email", config.intakeFields),
  };
}
