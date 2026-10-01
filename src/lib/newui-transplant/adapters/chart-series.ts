import type { ChartWeekRow } from "@/newui-transplant/lib/view-models";

/** Merge parallel daily `{ date, count }` series into newui chart rows. */
export function mergeDailyTrends(input: {
  days: string[];
  calls?: Array<{ date: string; count: number }>;
  missed?: Array<{ date: string; count: number }>;
  texts?: Array<{ date: string; count: number }>;
  replies?: Array<{ date: string; count: number }>;
  booked?: Array<{ date: string; count: number }>;
}): ChartWeekRow[] {
  const byDate = (series?: Array<{ date: string; count: number }>) =>
    new Map((series ?? []).map((p) => [p.date, p.count]));
  const calls = byDate(input.calls);
  const missed = byDate(input.missed);
  const texts = byDate(input.texts);
  const replies = byDate(input.replies);
  const booked = byDate(input.booked);

  return input.days.map((date) => {
    // Fixed locale + UTC so SSR and client hydration match (avoids React #418).
    const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    return {
      day: dayLabel,
      calls: calls.get(date) ?? 0,
      missed: missed.get(date) ?? 0,
      texts: texts.get(date) ?? 0,
      replies: replies.get(date) ?? 0,
      booked: booked.get(date) ?? 0,
    };
  });
}
