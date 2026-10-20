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
