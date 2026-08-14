import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";

export type ScheduleBranch = "open" | "closed" | "holiday" | "temporary_closure";

export async function evaluateScheduleBranch(
  workspaceId: string,
  timezone: string,
  scheduleJson?: Record<string, unknown> | null,
  at = new Date(),
): Promise<ScheduleBranch> {
  const meta = scheduleJson ?? {};
  if (meta.temporaryClosure === true) return "temporary_closure";
  if (Array.isArray(meta.holidayDates)) {
    const day = at.toISOString().slice(0, 10);
    if ((meta.holidayDates as string[]).includes(day)) return "holiday";
  }

  const runtime = await getMessagingRuntimeSettings(workspaceId).catch(() => null);
  if (runtime) {
    const within = isWithinBusinessHours(runtime, at);
    return within ? "open" : "closed";
  }

  // Fallback: use timezone-local hour check from schedule windows
  const windows = meta.windows as
    | Array<{ days: number[]; start: string; end: string }>
    | undefined;
  if (!windows?.length) return "open";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = formatter.formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  const dayNum = dayMap[weekday] ?? 1;
  const nowMinutes = hour * 60 + minute;

  for (const w of windows) {
    if (!w.days?.includes(dayNum)) continue;
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (nowMinutes >= start && nowMinutes < end) return "open";
  }
  return "closed";
}
