import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import { eventSubtitle, eventTitle, formatEventTime, looksLikePhoneOnly } from "./ar-calendar-layout";
import { compactReminderFeedLine, isWorkflowManagedReminder, looksLikeJunkCalendarTitle } from "./reminder-display-copy";

export type CalendarEventEnrichment = {
  nextReminder?: string;
  reminderSecondary?: string;
  reminderStatus?: string;
  responseLabel?: string;
  responseKind?: string;
  attentionIssue?: string;
  attentionReason?: string;
};

export type EventStatusIconKind =
  | "scheduled"
  | "sent"
  | "confirmed"
  | "reply"
  | "attention"
  | "off"
  | "phone";

export type EventVisualTone = "scheduled" | "confirmed" | "attention" | "failed" | "off" | "neutral";

export function customerDisplayName(ev: CalendarApiAppointment): string | null {
  const name = ev.inviteeName?.trim() || "";
  if (name && !looksLikePhoneOnly(name)) return name;
  const sub = eventSubtitle(ev);
  if (sub && !looksLikePhoneOnly(sub)) return sub;
  return null;
}

export function serviceOrTitleLine(ev: CalendarApiAppointment): string {
  const sub = eventSubtitle(ev);
  const title = eventTitle(ev);
  if (sub && !looksLikeJunkCalendarTitle(sub)) return sub;
  if (!looksLikePhoneOnly(title) && !looksLikeJunkCalendarTitle(title)) return title;
  const meta = ev.metadata || {};
  const fromMeta =
    (meta.appointmentTitle as string) ||
    (meta.serviceName as string) ||
    (meta.subject as string) ||
    "";
  if (fromMeta.trim() && !looksLikeJunkCalendarTitle(fromMeta)) return fromMeta.trim();
  const customer = customerDisplayName(ev);
  if (customer) return customer;
  return "Appointment";
}

export function eventMissingSmsRecipient(ev: CalendarApiAppointment): boolean {
  const meta = ev.metadata || {};
  if (meta.remindersSuppressed || (meta.reminderOverride as { suppressed?: boolean })?.suppressed) {
    return false;
  }
  if (meta.emailOnly || meta.smsCapable === false) return false;
  const phone =
    (meta.reminderOverride as { phone?: string })?.phone ||
    ev.inviteePhone ||
    (meta.inviteePhone as string) ||
    "";
  if (!phone?.trim()) return true;
  const reason = meta.reminderSmsIneligibleReason as string | undefined;
  if (reason && /phone|recipient|number|missing/i.test(reason)) return true;
  return false;
}

export function pickEventStatusIcon(
  ev: CalendarApiAppointment,
  enrichment?: CalendarEventEnrichment | null,
): EventStatusIconKind {
  if (eventMissingSmsRecipient(ev)) return "phone";
  const meta = ev.metadata || {};
  if (meta.remindersSuppressed || (meta.reminderOverride as { suppressed?: boolean })?.suppressed) {
    return "off";
  }
  if (
    isWorkflowManagedReminder({
      label: enrichment?.nextReminder,
      attentionReason: enrichment?.attentionReason,
      secondaryLine: enrichment?.reminderSecondary,
    })
  ) {
    return "scheduled";
  }
  if (enrichment?.attentionIssue || meta.reminderSmsIneligibleReason || meta.reminderImportIneligibleReason) {
    return "attention";
  }
  const kind = enrichment?.responseKind || "";
  if (kind === "confirmed") return "confirmed";
  if (enrichment?.responseLabel && kind !== "none") return "reply";
  const st = (enrichment?.reminderStatus || "").toLowerCase();
  if (st === "sent" || st === "delivered") return "sent";
  if (/fail|block/i.test(enrichment?.nextReminder || "")) return "attention";
  return "scheduled";
}

export function eventVisualTone(
  ev: CalendarApiAppointment,
  enrichment?: CalendarEventEnrichment | null,
): EventVisualTone {
  const meta = ev.metadata || {};
  if (meta.remindersSuppressed || (meta.reminderOverride as { suppressed?: boolean })?.suppressed) {
    return "off";
  }
  if (
    isWorkflowManagedReminder({
      label: enrichment?.nextReminder,
      status: enrichment?.reminderStatus,
      attentionReason: enrichment?.attentionReason,
      secondaryLine: enrichment?.reminderSecondary,
    })
  ) {
    return "neutral";
  }
  if (enrichment?.attentionIssue || meta.reminderSmsIneligibleReason || meta.reminderImportIneligibleReason) {
    return "attention";
  }
  const kind = enrichment?.responseKind || "";
  if (kind === "confirmed") return "confirmed";
  if (/fail|block/i.test(enrichment?.nextReminder || "")) return "failed";
  if (meta.reminderSmsIneligibleReason) return "attention";
  return "scheduled";
}

export function eventToneClasses(tone: EventVisualTone): string {
  switch (tone) {
    case "confirmed":
      return "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15";
    case "attention":
      return "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15";
    case "failed":
      return "border-destructive/35 bg-destructive/10 hover:bg-destructive/15";
    case "off":
      return "border-border/80 bg-muted/50 text-muted-foreground hover:bg-muted/60";
    case "scheduled":
      return "border-primary/30 bg-primary/10 hover:bg-primary/15";
    default:
      return "border-border/80 bg-muted/30 hover:bg-muted/40";
  }
}

export function eventStatusLine(
  ev: CalendarApiAppointment,
  enrichment?: CalendarEventEnrichment | null,
): string | null {
  if (eventMissingSmsRecipient(ev)) return "Missing phone";
  if (enrichment?.responseLabel) return enrichment.responseLabel;
  if (
    isWorkflowManagedReminder({
      label: enrichment?.nextReminder,
      status: enrichment?.reminderStatus,
      attentionReason: enrichment?.attentionReason,
      secondaryLine: enrichment?.reminderSecondary,
    })
  ) {
    return compactReminderFeedLine({
      label: enrichment?.nextReminder,
      secondaryLine: enrichment?.reminderSecondary,
      attentionReason: enrichment?.attentionReason,
    });
  }
  if (enrichment?.reminderSecondary) {
    return compactReminderFeedLine({
      label: enrichment?.nextReminder,
      secondaryLine: enrichment.reminderSecondary,
      status: enrichment.reminderStatus,
    });
  }
  if (enrichment?.nextReminder && !/^reminders?$/i.test(enrichment.nextReminder)) {
    return enrichment.nextReminder;
  }
  if (enrichment?.attentionIssue) return enrichment.attentionIssue;
  const meta = ev.metadata || {};
  if (meta.remindersSuppressed) return "Reminders off";
  if (meta.reminderSmsIneligibleReason) return String(meta.reminderSmsIneligibleReason);
  return null;
}

export type EventBlockLayout = "large" | "medium" | "compact";

export function pickEventBlockLayout(heightPx: number, widthHint?: "narrow" | "wide"): EventBlockLayout {
  if (heightPx >= 56 && widthHint !== "narrow") return "large";
  if (heightPx >= 40) return "medium";
  return "compact";
}

export function formatEventBlockLines(
  ev: CalendarApiAppointment,
  timeZone: string,
  layout: EventBlockLayout,
  enrichment?: CalendarEventEnrichment | null,
) {
  const time = formatEventTime(ev.startsAt, timeZone);
  const customer = customerDisplayName(ev);
  const service = serviceOrTitleLine(ev);
  const status = eventStatusLine(ev, enrichment);

  if (layout === "compact") {
    const primary = customer || service;
    return {
      line1: `${time} · ${primary}`,
      line2: null as string | null,
      line3: null as string | null,
    };
  }
  if (layout === "medium") {
    return {
      line1: `${time} · ${service}`,
      line2: customer,
      line3: status,
    };
  }
  return {
    line1: `${time} · ${service}`,
    line2: customer,
    line3: status,
  };
}

export function eventTooltipTitle(ev: CalendarApiAppointment, timeZone: string, enrichment?: CalendarEventEnrichment | null) {
  const customer = customerDisplayName(ev) || "—";
  const service = serviceOrTitleLine(ev);
  const when = new Date(ev.startsAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  const status = eventStatusLine(ev, enrichment);
  return { customer, service, when, status };
}
