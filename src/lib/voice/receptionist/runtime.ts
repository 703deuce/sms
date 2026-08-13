import type { ReceptionistCompiledSnapshot } from "./types";
import { RECEPTIONIST_COMPILED_KEY } from "./types";

export function getReceptionistCompiledFromAdvanced(
  advanced: Record<string, unknown> | undefined,
): ReceptionistCompiledSnapshot | null {
  const raw = advanced?.[RECEPTIONIST_COMPILED_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ReceptionistCompiledSnapshot;
}

export function hasGenericReceptionistProfile(
  advanced: Record<string, unknown> | undefined,
): boolean {
  return getReceptionistCompiledFromAdvanced(advanced) !== null;
}
