import { getMessagingRuntimeSettings, resolveInboxPermissions } from "@/lib/messaging/messaging-settings";

export async function assertInboxEnabled(workspaceId: string): Promise<void> {
  const runtime = await getMessagingRuntimeSettings(workspaceId);
  const perms = resolveInboxPermissions(runtime.inboxPermissionsJson);
  if (perms.inboxEnabled === false) {
    throw new Error("Inbox is disabled for this workspace");
  }
}

export async function loadInboxPermissions(workspaceId: string) {
  const runtime = await getMessagingRuntimeSettings(workspaceId);
  return resolveInboxPermissions(runtime.inboxPermissionsJson);
}
