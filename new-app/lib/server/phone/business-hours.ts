import { getBusinessHours } from "@/lib/server/phone/routing";

type DayHours = { open?: string; close?: string; closed?: boolean };

/** Best-effort open check from workspace messaging business hours JSON. */
export async function isBusinessOpenNow(workspaceId: string): Promise<boolean> {
  const { timezone, hours } = await getBusinessHours(workspaceId);
  if (!hours || typeof hours !== "object") return true;

  const tz = timezone || "America/Chicago";
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  const minutes = hour * 60 + minute;

  const dayKey = weekday.slice(0, 3);
  const map = hours as Record<string, DayHours>;
  const day =
    map[dayKey] ||
    map[weekday] ||
    map[weekday.toLowerCase()] ||
    null;
  if (!day || day.closed) return false;
  if (!day.open || !day.close) return true;

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map((x) => Number(x));
    return (h || 0) * 60 + (m || 0);
  };
  const open = toMin(day.open);
  const close = toMin(day.close);
  return minutes >= open && minutes < close;
}
