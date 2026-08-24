import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadSmartRoutingWorkspaceSettings } from "./workspace-settings";

function phonesMatch(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return false;
  }
}

export async function listBlockedCallerE164(workspaceId: string): Promise<string[]> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const raw = settings?.scheduleOverrideJson as
    | { blockedCallersE164?: string[] }
    | null
    | undefined;
  const list = raw?.blockedCallersE164 ?? [];
  return list
    .map((p) => {
      try {
        return normalizeE164(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];
}

export async function isCallerBlockedForSmartRouting(
  workspaceId: string,
  callerE164: string,
): Promise<boolean> {
  const blocked = await listBlockedCallerE164(workspaceId);
  return blocked.some((b) => phonesMatch(b, callerE164));
}

export async function blockCallerForSmartRouting(workspaceId: string, callerE164: string) {
  const phone = normalizeE164(callerE164);
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const base =
    settings?.scheduleOverrideJson && typeof settings.scheduleOverrideJson === "object"
      ? { ...(settings.scheduleOverrideJson as Record<string, unknown>) }
      : {};
  const existing = (base.blockedCallersE164 as string[] | undefined) ?? [];
  if (existing.some((e) => phonesMatch(e, phone))) return existing;

  const next = [...existing, phone];
  const { updateSmartRoutingWorkspaceSettings } = await import("./workspace-settings");
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    scheduleOverrideJson: { ...base, blockedCallersE164: next },
  });
  return next;
}

export async function unblockCallerForSmartRouting(workspaceId: string, callerE164: string) {
  const phone = normalizeE164(callerE164);
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const base =
    settings?.scheduleOverrideJson && typeof settings.scheduleOverrideJson === "object"
      ? { ...(settings.scheduleOverrideJson as Record<string, unknown>) }
      : {};
  const existing = (base.blockedCallersE164 as string[] | undefined) ?? [];
  const next = existing.filter((e) => !phonesMatch(e, phone));
  const { updateSmartRoutingWorkspaceSettings } = await import("./workspace-settings");
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    scheduleOverrideJson: { ...base, blockedCallersE164: next },
  });
  return next;
}
