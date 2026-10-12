import "server-only";

import { isSimMicrosoftConnectionId } from "@/lib/calendar/disposable-calendar-test-data-ids";

/** Workspace slug/name markers for isolated AR scale tests. */
export const AR_SCALE_TEST_WORKSPACE_NAME = "AR_SCALE_TEST_DO_NOT_USE";

export type DisposableCalendarConnectionInput = {
  id: string;
  workspaceId: string;
  provider: string;
  status: string;
  credentialsRef?: string | null;
  name?: string | null;
};

export type ProtectedCalendarConnectionReason =
  | "protected_workspace"
  | "connected_with_credentials"
  | "manual_review";

const DEFAULT_PROTECTED_WORKSPACE_IDS = new Set(["ws_1"]);

function protectedWorkspaceIdsFromEnv(): Set<string> {
  const raw = process.env.CALENDAR_CLEANUP_PROTECT_WORKSPACE_IDS?.trim();
  const set = new Set(DEFAULT_PROTECTED_WORKSPACE_IDS);
  if (!raw) return set;
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) set.add(id);
  }
  return set;
}

export function isMctbPerfTestWorkspaceId(workspaceId: string): boolean {
  return workspaceId.startsWith("mctb_p0pf_");
}

export function isLikelyDisposableMicrosoftCalendarConnection(
  conn: DisposableCalendarConnectionInput,
  opts?: { scaleTestWorkspaceIds?: Set<string> },
): boolean {
  if (conn.provider !== "microsoft") return false;
  if (isSimMicrosoftConnectionId(conn.id)) return true;
  if (isMctbPerfTestWorkspaceId(conn.workspaceId)) return true;
  if (opts?.scaleTestWorkspaceIds?.has(conn.workspaceId)) return true;
  if (conn.name?.startsWith("Sim Microsoft ")) return true;
  return false;
}

export function isProtectedMicrosoftCalendarConnection(
  conn: DisposableCalendarConnectionInput,
): { protected: boolean; reason?: ProtectedCalendarConnectionReason } {
  const protectedWorkspaces = protectedWorkspaceIdsFromEnv();
  if (protectedWorkspaces.has(conn.workspaceId)) {
    return { protected: true, reason: "protected_workspace" };
  }
  if (
    conn.status === "connected" &&
    Boolean(conn.credentialsRef?.trim())
  ) {
    return { protected: true, reason: "connected_with_credentials" };
  }
  return { protected: false };
}
