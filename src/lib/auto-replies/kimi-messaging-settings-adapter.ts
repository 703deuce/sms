/**
 * Maps /api/settings/messaging-runtime ↔ Kimi auto-replies settings tabs.
 */
import type {
  BusinessHoursJson,
  InboxPermissionsJson,
  InboxTagDefinition,
  MessagingRuntimeSettings,
  OptInMessagesJson,
} from "@/lib/messaging/messaging-settings";
import { defaultBusinessHours, DEFAULT_INBOX_PERMISSIONS, resolveInboxPermissions } from "@/lib/messaging/messaging-settings";

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

const KIMI_DAY_TO_KEY: Record<string, string> = {
  Sunday: "sun",
  Monday: "mon",
  Tuesday: "tue",
  Wednesday: "wed",
  Thursday: "thu",
  Friday: "fri",
  Saturday: "sat",
};

const KEY_TO_KIMI_DAY: Record<string, string> = Object.fromEntries(
  Object.entries(KIMI_DAY_TO_KEY).map(([k, v]) => [v, k]),
);

export function kimiActiveDaysToBusinessHours(
  activeDays: string[],
  start = "09:00",
  end = "17:00",
): BusinessHoursJson {
  const hours = defaultBusinessHours();
  for (const [label, key] of Object.entries(KIMI_DAY_TO_KEY)) {
    hours[key] = {
      start,
      end,
      enabled: activeDays.includes(label),
    };
  }
  return hours;
}

export function businessHoursToKimiActiveDays(hours: BusinessHoursJson | null): string[] {
  if (!hours) return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return Object.entries(KIMI_DAY_TO_KEY)
    .filter(([, key]) => hours[key]?.enabled !== false)
    .map(([label]) => label);
}

export function optInBodiesFromSettings(
  json: OptInMessagesJson | null | undefined,
  defaults: Record<string, string>,
): Record<string, string> {
  if (!json) return defaults;
  return {
    ...defaults,
    ...(json.optin ? { optin: json.optin } : {}),
    ...(json.double ? { double: json.double } : {}),
    ...(json.exists ? { exists: json.exists } : {}),
    ...(json.reoptin ? { reoptin: json.reoptin } : {}),
  };
}

export function bodiesToOptInMessagesJson(bodies: Record<string, string>): OptInMessagesJson {
  return {
    optin: bodies.optin || "",
    double: bodies.double || "",
    exists: bodies.exists || "",
    reoptin: bodies.reoptin || "",
  };
}

export function inboxTagsFromSettings(
  rows: InboxTagDefinition[] | null | undefined,
): InboxTagDefinition[] {
  return Array.isArray(rows) ? rows : [];
}

export async function persistInboxTag(
  tag: Omit<InboxTagDefinition, "id" | "created"> & { id?: string },
): Promise<InboxTagDefinition[]> {
  const settings = await fetchMessagingRuntimeSettings();
  const existing = inboxTagsFromSettings(settings.inboxTagsJson);
  const id = tag.id || `tag-${Date.now()}`;
  const row: InboxTagDefinition = {
    id,
    name: tag.name,
    description: tag.description,
    color: tag.color,
    untagOnClose: tag.untagOnClose,
    created: new Date().toISOString(),
  };
  const next = [...existing.filter((t) => t.id !== id && t.name !== tag.name), row];
  const saved = await patchMessagingRuntimeSettings({ inboxTagsJson: next });
  return inboxTagsFromSettings(saved.inboxTagsJson);
}

export async function migrateConversationTags(input: {
  rename?: { from: string; to: string };
  remove?: string;
}): Promise<void> {
  const res = await fetch("/api/inbox/tags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update conversation tags");
}

export async function deleteInboxTag(tagName: string): Promise<InboxTagDefinition[]> {
  const settings = await fetchMessagingRuntimeSettings();
  const existing = inboxTagsFromSettings(settings.inboxTagsJson);
  await migrateConversationTags({ remove: tagName });
  const next = existing.filter((t) => t.name !== tagName && t.id !== tagName);
  const saved = await patchMessagingRuntimeSettings({ inboxTagsJson: next });
  return inboxTagsFromSettings(saved.inboxTagsJson);
}

export async function updateInboxTag(
  tagName: string,
  patch: Partial<Omit<InboxTagDefinition, "id">>,
): Promise<InboxTagDefinition[]> {
  const settings = await fetchMessagingRuntimeSettings();
  const existing = inboxTagsFromSettings(settings.inboxTagsJson);
  const nextName = patch.name?.trim();
  if (nextName && nextName !== tagName) {
    await migrateConversationTags({ rename: { from: tagName, to: nextName } });
  }
  const next = existing.map((t) =>
    t.name === tagName || t.id === tagName ? { ...t, ...patch, name: patch.name ?? t.name } : t,
  );
  const saved = await patchMessagingRuntimeSettings({ inboxTagsJson: next });
  return inboxTagsFromSettings(saved.inboxTagsJson);
}

export { KEY_TO_KIMI_DAY };

const KIMI_TOGGLE_TO_PERMISSION: Record<string, keyof InboxPermissionsJson> = {
  inboxOn: "inboxEnabled",
  start: "allowStartConversations",
  assign: "allowAssignment",
  tag: "allowTagging",
  unassign: "unassignOnClose",
  unread: "markUnreadOnAssign",
};

export function inboxPermissionsToKimiToggles(
  json: InboxPermissionsJson | null | undefined,
): Record<string, boolean> {
  const p = resolveInboxPermissions(json);
  return {
    inboxOn: p.inboxEnabled !== false,
    start: p.allowStartConversations !== false,
    assign: p.allowAssignment !== false,
    tag: p.allowTagging !== false,
    unassign: p.unassignOnClose !== false,
    unread: p.markUnreadOnAssign !== false,
  };
}

export function kimiTogglesToInboxPermissions(
  toggles: Record<string, boolean>,
): InboxPermissionsJson {
  const out: InboxPermissionsJson = { ...DEFAULT_INBOX_PERMISSIONS };
  for (const [toggleId, key] of Object.entries(KIMI_TOGGLE_TO_PERMISSION)) {
    if (toggleId in toggles) out[key] = toggles[toggleId];
  }
  return out;
}
