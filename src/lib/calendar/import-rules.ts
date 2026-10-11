import type { CalendarConfig } from "@/lib/calendar/providers";
import { defaultImportRules, mergeImportRules, type CalendarImportRules } from "@/lib/calendar/eligibility";

export function resolveImportRulesForCalendar(
  config: CalendarConfig,
  calendarId?: string | null,
): CalendarImportRules {
  const base = mergeImportRules(config);
  if (!calendarId) return base;
  const byCal = config.importRulesByCalendarId?.[calendarId];
  if (!byCal) return base;
  return {
    ...defaultImportRules(),
    ...base,
    ...byCal,
  };
}
