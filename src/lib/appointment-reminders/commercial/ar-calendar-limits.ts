import "server-only";

import { listWorkspaceCalendarConnections } from "@/lib/calendar/connections";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { assertImportCalendarCountAllowed } from "@/lib/appointment-reminders/commercial/ar-feature-gates";

export async function countWorkspaceImportedCalendars(workspaceId: string): Promise<number> {
  const connections = await listWorkspaceCalendarConnections(workspaceId);
  const ids = new Set<string>();
  for (const conn of connections) {
    const cfg = (conn.config || {}) as CalendarConfig;
    for (const id of cfg.importCalendarIds || []) {
      if (id) ids.add(String(id));
    }
  }
  return ids.size;
}

export async function assertWorkspaceImportCalendarPatchAllowed(
  workspaceId: string,
  connectionId: string,
  nextImportIds: string[],
): Promise<void> {
  const connections = await listWorkspaceCalendarConnections(workspaceId);
  const ids = new Set<string>();
  for (const conn of connections) {
    const cfg = (conn.config || {}) as CalendarConfig;
    const list =
      conn.id === connectionId ? nextImportIds : cfg.importCalendarIds || [];
    for (const id of list) {
      if (id) ids.add(String(id));
    }
  }
  await assertImportCalendarCountAllowed(workspaceId, ids.size);
}
