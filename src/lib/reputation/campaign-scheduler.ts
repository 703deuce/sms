/** Schedule paced campaign messages across business days. */

/** Set REVIEW_CAMPAIGN_IMMEDIATE_SEND=true in .env.local to skip send windows (dev/testing). */
export function campaignImmediateSendEnabled(): boolean {
  return process.env.REVIEW_CAMPAIGN_IMMEDIATE_SEND === "true";
}

export type ScheduleConfig = {
  startDate: string; // YYYY-MM-DD
  dailySendLimit: number;
  sendDays: number[]; // 0=Sun … 6=Sat
  windowStart: string; // HH:mm
  windowEnd: string; // HH:mm
  timezone: string;
};

export type MessageSlot = {
  recipientId: string;
  channel: "sms" | "email";
  scheduledFor: Date;
};

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function getLocalParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // Chrome can emit hour "24" at local midnight with hour12:false.
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
    hour,
    minute: Number(get("minute")),
  };
}

/** Calendar YYYY-MM-DD in a timezone (not UTC). */
export function ymdInTimeZone(date: Date, timeZone: string): string {
  const local = getLocalParts(date, timeZone);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

/** True when local calendar date in timezone is on/after startDate (YYYY-MM-DD). */
export function isOnOrAfterStartDate(now: Date, startDate: string, timeZone: string): boolean {
  return ymdInTimeZone(now, timeZone) >= startDate;
}

function toUtcFromLocal(
  y: number,
  mo: number,
  d: number,
  h: number,
  min: number,
  timeZone: string
): Date {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, min, 0));
  for (let i = 0; i < 4; i++) {
    const local = getLocalParts(guess, timeZone);
    const targetMin = h * 60 + min;
    const localMin = local.hour * 60 + local.minute;
    const dayDiff = d - local.day;
    guess = new Date(guess.getTime() + (targetMin - localMin) * 60_000 + dayDiff * 86_400_000);
  }
  return guess;
}

function addBusinessDays(
  startYmd: string,
  sendDays: number[],
  dayOffset: number
): { y: number; m: number; d: number } {
  const [y, mo, d] = startYmd.split("-").map(Number);
  let cursor = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  let found = 0;
  while (found < dayOffset) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    const wd = cursor.getUTCDay();
    if (sendDays.includes(wd)) found++;
  }
  while (!sendDays.includes(cursor.getUTCDay())) {
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return { y: cursor.getUTCFullYear(), m: cursor.getUTCMonth() + 1, d: cursor.getUTCDate() };
}

function randomMinuteInWindow(start: string, end: string): { h: number; m: number } {
  const s = parseHm(start);
  const e = parseHm(end);
  const startMin = s.h * 60 + s.m;
  const endMin = e.h * 60 + e.m;
  const pick = startMin + Math.floor(Math.random() * Math.max(1, endMin - startMin));
  return { h: Math.floor(pick / 60), m: pick % 60 };
}

export function estimateBusinessDays(messageCount: number, dailyLimit: number): number {
  if (messageCount <= 0 || dailyLimit <= 0) return 0;
  return Math.ceil(messageCount / dailyLimit);
}

export function buildMessageSchedule(
  items: Array<{ recipientId: string; channel: "sms" | "email" }>,
  config: ScheduleConfig
): MessageSlot[] {
  if (campaignImmediateSendEnabled()) {
    const now = Date.now();
    return items.map((item, i) => ({
      ...item,
      scheduledFor: new Date(now + i * 1000),
    }));
  }

  const slots: MessageSlot[] = [];
  let dayIndex = 0;
  let sentToday = 0;

  for (const item of items) {
    if (sentToday >= config.dailySendLimit) {
      dayIndex++;
      sentToday = 0;
    }
    const { y, m, d } = addBusinessDays(config.startDate, config.sendDays, dayIndex);
    const { h, m: min } = randomMinuteInWindow(config.windowStart, config.windowEnd);
    const scheduledFor = toUtcFromLocal(y, m, d, h, min, config.timezone);
    slots.push({ ...item, scheduledFor });
    sentToday++;
  }

  return slots;
}

export function isWithinSendWindow(now: Date, config: ScheduleConfig): boolean {
  if (campaignImmediateSendEnabled()) return true;
  const local = getLocalParts(now, config.timezone);
  if (!config.sendDays.includes(local.weekday)) return false;
  const start = parseHm(config.windowStart);
  const end = parseHm(config.windowEnd);
  const cur = local.hour * 60 + local.minute;
  const s = start.h * 60 + start.m;
  const e = end.h * 60 + end.m;
  return cur >= s && cur < e;
}

export function countSentTodayInTz(
  sentAts: string[],
  timezone: string,
  now = new Date()
): number {
  const local = getLocalParts(now, timezone);
  const ymd = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return sentAts.filter((iso) => {
    const p = getLocalParts(new Date(iso), timezone);
    const d = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    return d === ymd;
  }).length;
}
