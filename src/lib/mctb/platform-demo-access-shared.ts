function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readAdminTestWorkspaceIds(settingsJson: unknown): string[] {
  const settings = asRecord(settingsJson);
  const raw = settings.adminTestWorkspaceIds ?? settings.linkedAdminWorkspaces;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

export function isWorkspaceListedForPlatformDemoAccess(
  workspaceId: string,
  settingsJson: unknown,
  ownerWorkspaceId: string,
): boolean {
  if (ownerWorkspaceId === workspaceId) return true;
  return readAdminTestWorkspaceIds(settingsJson).includes(workspaceId);
}
