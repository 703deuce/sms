/** Pure pointer migration rules (safe to import from certification scripts). */

export function shouldRemigrateMctbMicrosoftPointer(input: {
  configuredId: string | null;
  configuredHealthy: boolean;
  activeConnectionId: string;
  activeHealthy: boolean;
  replacedConnectionIds?: string[];
}): { migrate: boolean; reason: string } {
  if (!input.activeHealthy) {
    return { migrate: false, reason: "active_connection_not_healthy" };
  }
  const replaced = new Set(input.replacedConnectionIds || []);
  if (!input.configuredId) {
    return { migrate: true, reason: "missing_pointer" };
  }
  if (replaced.has(input.configuredId)) {
    return { migrate: true, reason: "replaced_connection" };
  }
  if (!input.configuredHealthy) {
    return { migrate: true, reason: "stale_or_disconnected_pointer" };
  }
  if (input.configuredId !== input.activeConnectionId) {
    return { migrate: false, reason: "unchanged" };
  }
  return { migrate: false, reason: "unchanged" };
}
