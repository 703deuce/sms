/**
 * Pure recurring date generation (no DB) — used for preview and tests.
 */
export type RecurringFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly"
  | "monthly_weekday";

export type RecurringScheduleInput = {
  startsAt: string;
  frequency: RecurringFrequency;
  occurrences: number;
  /** 0=Sun … 6=Sat — when set, only these weekdays are kept (weekly family) */
  weekdays?: number[];
};

export function generateRecurringOccurrences(input: RecurringScheduleInput): string[] {
  const max = Math.min(Math.max(input.occurrences, 1), 52);
  const dates: string[] = [];
  let current = new Date(input.startsAt);

  const matchesWeekday = (d: Date) => {
    if (!input.weekdays?.length) return true;
    return input.weekdays.includes(d.getDay());
  };

  let guard = 0;
  while (dates.length < max && guard < 400) {
    guard++;
    if (matchesWeekday(current)) {
      dates.push(current.toISOString());
    }
    current = advanceOccurrence(current, input.frequency);
  }

  return dates;
}

function advanceOccurrence(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "triweekly":
      next.setDate(next.getDate() + 21);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "monthly_weekday": {
      const weekday = date.getDay();
      const weekOfMonth = Math.ceil(date.getDate() / 7);
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      while (next.getDay() !== weekday) next.setDate(next.getDate() + 1);
      next.setDate(next.getDate() + (weekOfMonth - 1) * 7);
      break;
    }
  }
  return next;
}
