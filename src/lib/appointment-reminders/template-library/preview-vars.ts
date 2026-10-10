import { mergeTemplate } from "@/lib/messaging/template";

/** Example merge values for settings UI preview (matches server preview shape). */
export function exampleReminderMergeVars(input: {
  businessName: string;
  timezone: string;
  businessPhone?: string;
  location?: string;
}): Record<string, string> {
  const startsAt = new Date(Date.now() + 86400000);
  const tz = input.timezone || "America/New_York";
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const base = "https://example.transovo.app";
  return {
    first_name: "Alex",
    last_name: "",
    business_name: input.businessName,
    service: "Consultation",
    appointment_date: dateFmt.format(startsAt),
    appointment_time: timeFmt.format(startsAt),
    location: input.location || "123 Main St",
    business_phone: input.businessPhone || "(555) 555-0100",
    confirm_link: `${base}/appointments/confirm/preview`,
    cancel_link: `${base}/appointments/cancel/preview`,
    reschedule_link: `${base}/appointments/reschedule/preview`,
    manage_link: `${base}/appointments/manage/preview`,
    appointment_link: `${base}/appointments/manage/preview`,
    directions_link: `${base}/directions`,
    meeting_link: "",
    join_meeting_line: "",
  };
}

export function renderReminderTemplatePreview(
  template: string,
  vars: Record<string, string>,
): string {
  return mergeTemplate(template, vars);
}
