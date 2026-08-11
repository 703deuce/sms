/** Parse a CRM search safeId into a local Transovo contact id, if applicable. */
export function parseLocalContactIdFromSafeId(safeId: string | undefined): string | undefined {
  if (!safeId?.startsWith("local:")) return undefined;
  const id = safeId.slice("local:".length).trim();
  return id || undefined;
}

/** True when value is a bare local contact id (not a CRM safeId token). */
export function isBareLocalContactId(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return !value.includes(":");
}
