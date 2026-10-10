import type { AppointmentPlatformConfig, ReminderStepConfig } from "@/lib/appointments/types";
import type {
  TemplateLibraryCatalog,
  TemplateLibraryEntry,
  TemplateMessageType,
} from "./types";
import { STEP_TO_MESSAGE_TYPE } from "./types";
import catalogJson from "./transovo-reminder-templates.json";

const catalog = catalogJson as TemplateLibraryCatalog;

const byId = new Map<string, TemplateLibraryEntry>();
for (const t of catalog.templates) {
  byId.set(t.id, t);
}

export function getTemplateLibraryCatalog(): TemplateLibraryCatalog {
  return catalog;
}

export function getLibraryTemplate(id: string): TemplateLibraryEntry | undefined {
  return byId.get(id);
}

export function getLibraryTemplateByParts(
  industry: string,
  messageType: TemplateMessageType,
  channel: "sms" | "email",
): TemplateLibraryEntry | undefined {
  return byId.get(`${industry}:${messageType}:${channel}`);
}

export function listLibraryIndustries(): string[] {
  return catalog.industries;
}

export function listMessageTypesForIndustry(industry: string): TemplateMessageType[] {
  const set = new Set<TemplateMessageType>();
  for (const t of catalog.templates) {
    if (t.industry === industry) set.add(t.messageType);
  }
  return [...set];
}

export type TemplateLibrarySummary = {
  id: string;
  industry: string;
  messageType: TemplateMessageType;
  channel: "sms" | "email";
  label: string;
  preview: string;
};

export function listLibraryTemplateSummaries(filters?: {
  industry?: string;
  channel?: "sms" | "email";
  messageType?: TemplateMessageType;
  q?: string;
  limit?: number;
  offset?: number;
}): { rows: TemplateLibrarySummary[]; total: number } {
  const q = filters?.q?.trim().toLowerCase();
  const filtered = catalog.templates.filter((t) => {
    if (filters?.industry && t.industry !== filters.industry) return false;
    if (filters?.channel && t.channel !== filters.channel) return false;
    if (filters?.messageType && t.messageType !== filters.messageType) return false;
    if (q) {
      const hay = `${t.label} ${t.body} ${t.industry} ${t.messageType}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const offset = Math.max(0, filters?.offset ?? 0);
  const limit = Math.min(200, Math.max(1, filters?.limit ?? 50));
  const rows = filtered.slice(offset, offset + limit).map((t) => ({
    id: t.id,
    industry: t.industry,
    messageType: t.messageType,
    channel: t.channel,
    label: t.label,
    preview: t.body.replace(/\s+/g, " ").trim().slice(0, 140),
  }));
  return { rows, total: filtered.length };
}

function patchStepFromLibrary(
  step: ReminderStepConfig,
  industry: string,
  messageType: TemplateMessageType,
): ReminderStepConfig {
  const channel = step.channel || "sms";
  const entry = getLibraryTemplateByParts(industry, messageType, channel);
  if (!entry) return step;
  const next: ReminderStepConfig = {
    ...step,
    template: entry.body,
    libraryMessageType: messageType,
    libraryIndustry: industry,
  };
  if (channel === "email" && entry.subject) {
    next.emailSubject = entry.subject;
  }
  return next;
}

export function applyIndustryTemplatePackToReminders(
  reminders: AppointmentPlatformConfig["reminders"],
  industry: string,
): AppointmentPlatformConfig["reminders"] {
  const next = { ...reminders };
  next.confirmation = patchStepFromLibrary(
    next.confirmation,
    industry,
    STEP_TO_MESSAGE_TYPE.confirmation,
  );
  next.reminder24h = patchStepFromLibrary(next.reminder24h, industry, STEP_TO_MESSAGE_TYPE.reminder24h);
  next.reminder2h = patchStepFromLibrary(next.reminder2h, industry, STEP_TO_MESSAGE_TYPE.reminder2h);

  const dayBeforeSms = getLibraryTemplateByParts(industry, "day_before", "sms");
  const dayBeforeEmail = getLibraryTemplateByParts(industry, "day_before", "email");
  const hasDayBefore = Boolean(dayBeforeSms || dayBeforeEmail);
  if (hasDayBefore) {
    const channel = next.reminder24h.channel || "sms";
    const entry = channel === "email" ? dayBeforeEmail : dayBeforeSms;
    const existing = (next.additionalSteps || []).find((s) => s.libraryMessageType === "day_before");
    if (!existing && entry) {
      next.additionalSteps = [
        ...(next.additionalSteps || []),
        {
          id: `lib_day_before_${industry}`,
          enabled: false,
          channel,
          label: "Day-before reminder",
          minutesBefore: 1440,
          template: entry.body,
          emailSubject: entry.subject || undefined,
          libraryMessageType: "day_before",
          libraryIndustry: industry,
        },
      ];
    }
  }

  return next;
}

export function applyLibraryTemplateToStep(
  step: ReminderStepConfig,
  industry: string,
  messageType: TemplateMessageType,
): ReminderStepConfig {
  return patchStepFromLibrary(step, industry, messageType);
}
