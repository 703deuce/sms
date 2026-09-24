/**
 * Operator/script paths must not silently default to ws_1 in production.
 * Customer APIs should use session workspaceId — not this helper.
 */
export function requireExplicitWorkspaceId(
  explicit?: string | null,
  options?: { envVar?: string; label?: string },
): string {
  const envVar = options?.envVar ?? "WORKSPACE_ID";
  const id = explicit?.trim() || process.env[envVar]?.trim();
  if (!id) {
    const label = options?.label ?? "Operation";
    throw new Error(`${label} requires workspaceId (argument or ${envVar})`);
  }
  return id;
}
