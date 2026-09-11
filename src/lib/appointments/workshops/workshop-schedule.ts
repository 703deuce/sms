/**
 * A workshop is date-driven rather than pattern-driven: it happens on a day,
 * at a time, sometimes across a handful of days. There is no recurrence to
 * expand, so these helpers deal in concrete sessions.
 */

export type WorkshopSessionDraft = {
  date: string;
  startTime: string;
  durationMinutes: number;
};

export type WorkshopSessionRow = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  status: string;
  enrolled?: number;
  remaining?: number;
};

export const EMPTY_SESSION_DRAFT: WorkshopSessionDraft = {
  date: "",
  startTime: "09:00",
  durationMinutes: 180,
};

/** Today in the browser's own calendar, not UTC, so "today" is not yesterday. */
export function todayISODate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseParts(date: string, time: string): Date | null {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const parsed = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A draft turned into the start/end pair the occurrence API expects. */
export function sessionDraftToRange(
  draft: WorkshopSessionDraft,
): { startsAt: string; endsAt: string } | null {
  const start = parseParts(draft.date, draft.startTime);
  if (!start) return null;
  const minutes = Math.max(5, Math.round(draft.durationMinutes || 0));
  const end = new Date(start.getTime() + minutes * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/** The reverse, for editing a session that already exists. */
export function sessionRowToDraft(row: {
  startsAt: string;
  endsAt: string;
}): WorkshopSessionDraft {
  const start = new Date(row.startsAt);
  const end = new Date(row.endsAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = !Number.isNaN(start.getTime());
  return {
    date: valid
      ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
      : "",
    startTime: valid ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : "09:00",
    durationMinutes:
      valid && !Number.isNaN(end.getTime())
        ? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000))
        : 180,
  };
}

/** Sessions that have not happened yet and were not called off. */
export function upcomingSessions(sessions: WorkshopSessionRow[]): WorkshopSessionRow[] {
  const now = Date.now();
  return sessions
    .filter((s) => s.status !== "cancelled" && new Date(s.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/**
 * The session a workshop is "about". A workshop that already ran should still
 * show the day it ran on rather than nothing at all, so this falls back to the
 * first session of any kind.
 */
export function primarySession(sessions: WorkshopSessionRow[]): WorkshopSessionRow | null {
  const upcoming = upcomingSessions(sessions);
  if (upcoming.length > 0) return upcoming[0];
  const live = sessions
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return live[0] ?? sessions[0] ?? null;
}

export type WorkshopDateBlock = { month: string; day: string };

/** The compact OCT / 12 block the event surfaces use. */
export function dateBlock(iso: string): WorkshopDateBlock {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

export function formatSessionDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatSessionTimes(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return "";
  const time = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return Number.isNaN(end.getTime()) ? time(start) : `${time(start)} – ${time(end)}`;
}

/** "Saturday, Oct 12 · 2:00 PM – 5:00 PM", for headers and previews. */
export function formatSessionFull(startsAt: string, endsAt: string): string {
  const day = formatSessionDay(startsAt);
  const times = formatSessionTimes(startsAt, endsAt);
  return day && times ? `${day} · ${times}` : day || times;
}

/**
 * How a multi-day workshop reads in a list: "Oct 12" for one day, "Oct 12–13"
 * when it runs across consecutive dates, "Oct 12 +2" when it is scattered.
 */
export function formatSessionSpan(sessions: WorkshopSessionRow[]): string {
  const live = sessions
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (live.length === 0) return "No date set";

  const first = new Date(live[0].startsAt);
  const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (live.length === 1) return short(first);

  const last = new Date(live[live.length - 1].startsAt);
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000);
  if (days === live.length - 1) {
    const sameMonth = first.getMonth() === last.getMonth();
    return `${short(first)}–${sameMonth ? last.getDate() : short(last)}`;
  }
  return `${short(first)} +${live.length - 1}`;
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}
