/**
 * Daily contact birthday trigger processor.
 * Matches contacts whose birthday (customFields.dateOfBirth) falls on today
 * in the configured timezone at the configured time-of-day window.
 */

import { getPrisma } from "@/lib/db";
import { parseAutomationDefinition } from "../types";
import { enrollForTrigger } from "../enroll";
import { getMessagingRuntimeSettings } from "@/lib/messaging/messaging-settings";

function parseBirthday(raw: unknown): { month: number; day: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // YYYY-MM-DD or MM/DD/YYYY or MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { month: Number(iso[2]), day: Number(iso[3]) };
  }
  const us = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (us) {
    return { month: Number(us[1]), day: Number(us[2]) };
  }
  return null;
}

function localNowParts(timezone: string): { month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function timeMatchesWindow(timeOfDay: string, hour: number, minute: number): boolean {
  const [h, m] = timeOfDay.split(":").map((x) => Number(x) || 0);
  // Fire during the configured hour (±30 min window for cron drift).
  if (hour !== h) return false;
  return Math.abs(minute - m) <= 30;
}

export async function processContactBirthdayTriggers() {
  const prisma = getPrisma();
  const flows = await prisma.automationFlow.findMany({
    where: { status: "ACTIVE" },
    take: 50,
  });

  let enrolled = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const flow of flows) {
    const def = parseAutomationDefinition(flow.publishedDefinition ?? flow.definition);
    const trigger = def.nodes.find((n) => n.type === "trigger");
    if (!trigger || trigger.data.blockType !== "contact_birthday") continue;

    const cfg = (trigger.data.config || {}) as Record<string, unknown>;
    const birthdayField = String(cfg.birthdayField || "dateOfBirth");
    const timeOfDay = String(cfg.timeOfDay || "09:00");
    const timezoneMode = String(cfg.timezoneMode || "business");

    const settings = await getMessagingRuntimeSettings(flow.workspaceId);
    const tz =
      timezoneMode === "contact"
        ? settings.timezone
        : timezoneMode === "specified" && cfg.timezone
          ? String(cfg.timezone)
          : settings.timezone;

    const now = localNowParts(tz);
    if (!timeMatchesWindow(timeOfDay, now.hour, now.minute)) continue;

    const fireKey = `birthday:${flow.id}:${today}:${timeOfDay}`;
    const fired = await prisma.auditLog.findFirst({
      where: {
        workspaceId: flow.workspaceId,
        event: "automation.birthday",
        detail: { contains: fireKey },
      },
    });
    if (fired) continue;

    const contacts = await prisma.contact.findMany({
      where: { workspaceId: flow.workspaceId, status: "SUBSCRIBED" },
      take: 500,
      select: { id: true, customFields: true, consentSource: true },
    });

    for (const contact of contacts) {
      const cf =
        contact.customFields && typeof contact.customFields === "object"
          ? (contact.customFields as Record<string, unknown>)
          : {};
      const raw =
        birthdayField === "dateOfBirth"
          ? cf.dateOfBirth ?? cf.birthday
          : cf[birthdayField];
      const bday = parseBirthday(raw);
      if (!bday || bday.month !== now.month || bday.day !== now.day) continue;

      // Optional list filter
      const listId = String(cfg.listId || "").trim();
      if (listId) {
        const member = await prisma.contactListMember.findUnique({
          where: { listId_contactId: { listId, contactId: contact.id } },
        });
        if (!member) continue;
      }

      const results = await enrollForTrigger(
        flow.workspaceId,
        "contact_birthday",
        contact.id,
        { field: birthdayField },
      );
      if (results.some((r) => !r.skipped)) enrolled += 1;
    }

    await prisma.auditLog.create({
      data: {
        workspaceId: flow.workspaceId,
        event: "automation.birthday",
        detail: fireKey,
      },
    });
  }

  return { enrolled };
}
