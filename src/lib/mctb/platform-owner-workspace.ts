/** Primary MCTB production / cert workspace (571 owner). Override via env in other environments. */
export const MCTB_PLATFORM_OWNER_WORKSPACE_ID_DEFAULT = "ws_1";

export function resolveMctbPlatformOwnerWorkspaceId(): string {
  return (
    process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() ||
    MCTB_PLATFORM_OWNER_WORKSPACE_ID_DEFAULT
  );
}
