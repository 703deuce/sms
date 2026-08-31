/**
 * Maps /api/settings/messaging-runtime ↔ Kimi auto-replies settings tabs.
 */
import type { MessagingRuntimeSettings } from "@/lib/messaging/messaging-settings";

export async function fetchMessagingRuntimeSettings(): Promise<MessagingRuntimeSettings> {
  const res = await fetch("/api/settings/messaging-runtime");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load messaging settings");
  return json.data;
}

export async function patchMessagingRuntimeSettings(
  patch: Partial<MessagingRuntimeSettings>,
): Promise<MessagingRuntimeSettings> {
  const res = await fetch("/api/settings/messaging-runtime", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save messaging settings");
  return json.data;
}
