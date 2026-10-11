import { mergeTemplate } from "@/lib/messaging/template";

/** Example merge values for settings UI preview (matches server preview shape). */
export function exampleReminderMergeVars(input: {
  businessName: string;
  timezone: string;
  businessPhone?: string;
  location?: string;
  customMergeFields?: Record<string, string>;
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
  const demoBase = "https://example.transovo.app";
  const vars: Record<string, string> = {
    first_name: "Alex",
    last_name: "",
    business_name: input.businessName,
    service: "Consultation",
    appointment_date: dateFmt.format(startsAt),
    appointment_time: timeFmt.format(startsAt),
    location: input.location || "123 Main St",
    business_phone: input.businessPhone || "(555) 555-0100",
    confirm_link: `${demoBase}/appointments/confirm/preview`,
    cancel_link: `${demoBase}/appointments/cancel/preview`,
    reschedule_link: `${demoBase}/appointments/reschedule/preview`,
    manage_link: `${demoBase}/appointments/manage/preview`,
    appointment_link: `${demoBase}/appointments/manage/preview`,
    directions_link: `${demoBase}/directions`,
    meeting_link: "",
    join_meeting_line: "",
  };
  const custom = input.customMergeFields || {};
  return {
    ...vars,
    first_name: custom.first_name?.trim() || vars.first_name,
    last_name: custom.last_name?.trim() || vars.last_name,
    business_name: input.businessName?.trim() || custom.business_name?.trim() || vars.business_name,
    location: input.location?.trim() || custom.location?.trim() || vars.location,
    business_phone: input.businessPhone?.trim() || custom.business_phone?.trim() || vars.business_phone,
    ...Object.fromEntries(
      Object.entries(custom).filter(
        ([k]) => !["first_name", "last_name", "business_name", "location", "business_phone"].includes(k),
      ),
    ),
  };
}

export function renderReminderTemplatePreview(
  template: string,
  vars: Record<string, string>,
): string {
  return mergeTemplate(template, vars);
}
