import { getPrisma } from "@/lib/db";

export type BusinessHoursDay = { start: string; end: string; enabled?: boolean };
export type BusinessHoursJson = Record<string, BusinessHoursDay>;

export type OptInMessagesJson = {
  optin?: string;
  double?: string;
  exists?: string;
  reoptin?: string;
};

export type InboxTagDefinition = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  untagOnClose?: boolean;
  created?: string;
};

export type InboxPermissionsJson = {
  inboxEnabled?: boolean;
  allowStartConversations?: boolean;
  allowAssignment?: boolean;
  allowTagging?: boolean;
  unassignOnClose?: boolean;
  markUnreadOnAssign?: boolean;
};

export type MessagingRuntimeSettings = {
  workspaceId: string;
  businessHoursJson: BusinessHoursJson | null;
  timezone: string;
  awayMessage: string | null;
  awayInsideMessage: string | null;
  awayEnabled: boolean;
  awayAlways: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  reviewLinkUrl: string | null;
  optOutKeywords: string | null;
  optInKeywords: string | null;
  helpKeywords: string | null;
  optInMessagesJson: OptInMessagesJson | null;
  inboxTagsJson: InboxTagDefinition[] | null;
  inboxPermissionsJson: InboxPermissionsJson | null;
};

export const DEFAULT_OPT_OUT_KEYWORDS = "STOP,STOPALL,UNSUBSCRIBE,CANCEL,END,QUIT";
export const DEFAULT_OPT_IN_KEYWORDS = "START,YES,UNSTOP";
export const DEFAULT_HELP_KEYWORDS = "HELP,INFO";

/** Split a comma/space/newline separated keyword list into an upper-cased set. */
export function parseKeywordList(raw: string | null | undefined, fallback: string): string[] {
  const source = (raw ?? "").trim() || fallback;
  return [
    ...new Set(
      source
        .split(/[,\n]/)
        .map((k) => k.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseHm(hm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function localParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) || "mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { weekday, hour, minute, minutes: hour * 60 + minute };
}

function weekdayKey(weekday: string): string {
  const map: Record<string, string> = {
    sun: "sun",
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
  };
  return map[weekday] || "mon";
}

function inTimeWindow(minutes: number, start: string, end: string): boolean {
  const s = parseHm(start);
  const e = parseHm(end);
  if (!s || !e) return false;
  const startMin = s.h * 60 + s.m;
  const endMin = e.h * 60 + e.m;
  if (startMin <= endMin) {
    return minutes >= startMin && minutes < endMin;
  }
  // overnight window e.g. 21:00–08:00
  return minutes >= startMin || minutes < endMin;
}

export function isWithinBusinessHours(
  settings: MessagingRuntimeSettings,
  at = new Date(),
): boolean {
  const hours = settings.businessHoursJson;
  if (!hours || Object.keys(hours).length === 0) {
    // Default Mon–Fri 9–17
    const { weekday, minutes } = localParts(at, settings.timezone);
    const key = weekdayKey(weekday);
    if (key === "sat" || key === "sun") return false;
    return inTimeWindow(minutes, "09:00", "17:00");
  }

  const { weekday, minutes } = localParts(at, settings.timezone);
  const key = weekdayKey(weekday);
  const day = hours[key];
  if (!day || day.enabled === false) return false;
  if (!day.start || !day.end) return false;
  return inTimeWindow(minutes, day.start, day.end);
}

export function isInQuietHours(settings: MessagingRuntimeSettings, at = new Date()): boolean {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return false;
  const { minutes } = localParts(at, settings.timezone);
  return inTimeWindow(minutes, settings.quietHoursStart, settings.quietHoursEnd);
}

export function shouldSendAwayReply(settings: MessagingRuntimeSettings, at = new Date()): boolean {
  if (!settings.awayEnabled || !settings.awayMessage?.trim()) return false;
  if (settings.awayAlways) return true;
  return !isWithinBusinessHours(settings, at);
}

export async function getMessagingRuntimeSettings(workspaceId: string): Promise<MessagingRuntimeSettings> {
  const prisma = getPrisma();
  const row = await prisma.workspaceMessagingSettings.findUnique({ where: { workspaceId } });
  if (!row) {
    return {
      workspaceId,
      businessHoursJson: null,
      timezone: "America/Los_Angeles",
      awayMessage: null,
      awayEnabled: false,
      awayAlways: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      reviewLinkUrl: null,
      optOutKeywords: null,
      optInKeywords: null,
      helpKeywords: null,
      optInMessagesJson: null,
      inboxTagsJson: null,
      inboxPermissionsJson: null,
      awayInsideMessage: null,
    };
  }
  return {
    workspaceId: row.workspaceId,
    businessHoursJson: (row.businessHoursJson as BusinessHoursJson | null) || null,
    timezone: row.timezone || "America/Los_Angeles",
    awayMessage: row.awayMessage,
    awayInsideMessage: row.awayInsideMessage ?? null,
    awayEnabled: row.awayEnabled,
    awayAlways: row.awayAlways,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    reviewLinkUrl: row.reviewLinkUrl,
    optOutKeywords: row.optOutKeywords ?? null,
    optInKeywords: row.optInKeywords ?? null,
    helpKeywords: row.helpKeywords ?? null,
    optInMessagesJson: (row.optInMessagesJson as OptInMessagesJson | null) || null,
    inboxTagsJson: Array.isArray(row.inboxTagsJson)
      ? (row.inboxTagsJson as InboxTagDefinition[])
      : null,
    inboxPermissionsJson: (row.inboxPermissionsJson as InboxPermissionsJson | null) || null,
  };
}

export async function upsertMessagingRuntimeSettings(
  workspaceId: string,
  patch: Partial<Omit<MessagingRuntimeSettings, "workspaceId">>,
): Promise<MessagingRuntimeSettings> {
  const prisma = getPrisma();
  const row = await prisma.workspaceMessagingSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      businessHoursJson: patch.businessHoursJson ?? undefined,
      timezone: patch.timezone || "America/Los_Angeles",
      awayMessage: patch.awayMessage,
      awayInsideMessage: patch.awayInsideMessage,
      awayEnabled: patch.awayEnabled ?? false,
      awayAlways: patch.awayAlways ?? false,
      quietHoursStart: patch.quietHoursStart,
      quietHoursEnd: patch.quietHoursEnd,
      reviewLinkUrl: patch.reviewLinkUrl,
      optOutKeywords: patch.optOutKeywords,
      optInKeywords: patch.optInKeywords,
      helpKeywords: patch.helpKeywords,
      optInMessagesJson: patch.optInMessagesJson ?? undefined,
      inboxTagsJson: patch.inboxTagsJson ?? undefined,
      inboxPermissionsJson: patch.inboxPermissionsJson ?? undefined,
    },
    update: {
      businessHoursJson: patch.businessHoursJson ?? undefined,
      timezone: patch.timezone,
      awayMessage: patch.awayMessage,
      awayInsideMessage: patch.awayInsideMessage,
      awayEnabled: patch.awayEnabled,
      awayAlways: patch.awayAlways,
      quietHoursStart: patch.quietHoursStart,
      quietHoursEnd: patch.quietHoursEnd,
      reviewLinkUrl: patch.reviewLinkUrl,
      optOutKeywords: patch.optOutKeywords,
      optInKeywords: patch.optInKeywords,
      helpKeywords: patch.helpKeywords,
      optInMessagesJson: patch.optInMessagesJson ?? undefined,
      inboxTagsJson: patch.inboxTagsJson ?? undefined,
      inboxPermissionsJson: patch.inboxPermissionsJson ?? undefined,
    },
  });
  return {
    workspaceId: row.workspaceId,
    businessHoursJson: (row.businessHoursJson as BusinessHoursJson | null) || null,
    timezone: row.timezone,
    awayMessage: row.awayMessage,
    awayInsideMessage: row.awayInsideMessage ?? null,
    awayEnabled: row.awayEnabled,
    awayAlways: row.awayAlways,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    reviewLinkUrl: row.reviewLinkUrl,
    optOutKeywords: row.optOutKeywords ?? null,
    optInKeywords: row.optInKeywords ?? null,
    helpKeywords: row.helpKeywords ?? null,
    optInMessagesJson: (row.optInMessagesJson as OptInMessagesJson | null) || null,
    inboxTagsJson: Array.isArray(row.inboxTagsJson)
      ? (row.inboxTagsJson as InboxTagDefinition[])
      : null,
    inboxPermissionsJson: (row.inboxPermissionsJson as InboxPermissionsJson | null) || null,
  };
}

export const DEFAULT_INBOX_PERMISSIONS: InboxPermissionsJson = {
  inboxEnabled: true,
  allowStartConversations: true,
  allowAssignment: true,
  allowTagging: true,
  unassignOnClose: true,
  markUnreadOnAssign: true,
};

export function resolveInboxPermissions(
  raw: InboxPermissionsJson | null | undefined,
): InboxPermissionsJson {
  return { ...DEFAULT_INBOX_PERMISSIONS, ...(raw || {}) };
}

export function defaultBusinessHours(): BusinessHoursJson {
  const hours: BusinessHoursJson = {};
  for (const day of DAY_KEYS) {
    hours[day] = {
      start: "09:00",
      end: "17:00",
      enabled: day !== "sat" && day !== "sun",
    };
  }
  return hours;
}
