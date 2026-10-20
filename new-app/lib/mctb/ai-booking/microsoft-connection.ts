/** MCTB pointer migration is monolith-only; no-op in new-app. */
export async function migrateMctbAiBookingMicrosoftConnectionPointers(_input: {
  workspaceId: string;
  activeConnectionId: string;
}): Promise<{ migrated: boolean; fromId?: string; toId?: string; reason?: string }> {
  return { migrated: false };
}
