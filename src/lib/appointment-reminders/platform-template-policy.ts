import "server-only";

import {
  DEFAULT_REMINDER_TEMPLATES,
  type AppointmentPlatformConfig,
  type ReminderStepConfig,
} from "@/lib/appointments/types";
import { resolveAppointmentOutboundSmsRoute } from "@/lib/appointments/sms-sender";
import { listReminderStepIds, resolveReminderStep } from "@/lib/appointments/reminders/reminders-config";
import { getLibraryTemplateByParts } from "@/lib/appointment-reminders/template-library/catalog";
import {
  STEP_TO_MESSAGE_TYPE,
  type TemplateMessageType,
} from "@/lib/appointment-reminders/template-library/types";

/** Merge tags allowed for platform-sender Appointment Reminders (calendar-import product). */
export const PLATFORM_AR_ALLOWED_MERGE_TAGS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{service}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{business_name}}",
  "{{location}}",
  "{{business_phone}}",
  "{{meeting_link}}",
  "{{join_meeting_line}}",
  "{{appointment_link}}",
  "{{directions_link}}",
];

export async function usesPlatformAppointmentSmsSender(workspaceId: string): Promise<boolean> {
  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  return Boolean(route);
}

function defaultTemplateForKey(stepKey: string): string {
  if (stepKey === "confirmation") return DEFAULT_REMINDER_TEMPLATES.confirmation;
  if (stepKey === "reminder24h") return DEFAULT_REMINDER_TEMPLATES.reminder24h;
  if (stepKey === "reminder2h") return DEFAULT_REMINDER_TEMPLATES.reminder2h;
  return DEFAULT_REMINDER_TEMPLATES.reminder2h;
}

function stripDisallowedMergeTags(template: string): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) => {
    const tag = `{{${key}}}`;
    const allowed = PLATFORM_AR_ALLOWED_MERGE_TAGS.some(
      (t) => t.replace(/\s/g, "") === tag.replace(/\s/g, ""),
    );
    return allowed ? match : "";
  });
}

function librarySmsBody(step: ReminderStepConfig, stepKey: string): string | null {
  const industry = step.libraryIndustry;
  const messageType = (step.libraryMessageType ||
    STEP_TO_MESSAGE_TYPE[stepKey]) as TemplateMessageType | undefined;
  if (!industry || !messageType) return null;
  const entry = getLibraryTemplateByParts(industry, messageType, "sms");
  return entry?.body?.trim() || null;
}

function lockStepTemplate(step: ReminderStepConfig, stepKey: string): ReminderStepConfig {
  const isSms = step.channel === "sms";
  const approvedSms = isSms ? librarySmsBody(step, stepKey) : null;
  const base =
    approvedSms ||
    (step.template?.trim() ? step.template : defaultTemplateForKey(stepKey));
  return {
    ...step,
    template: isSms ? stripDisallowedMergeTags(base) : step.template,
    emailSubject: step.emailSubject
      ? stripDisallowedMergeTags(step.emailSubject)
      : step.emailSubject,
  };
}

function enforceStepTemplates(
  platform: AppointmentPlatformConfig,
  incoming: AppointmentPlatformConfig["reminders"],
): AppointmentPlatformConfig["reminders"] {
  const mergedPlatform = { ...platform, reminders: incoming };
  const keys = listReminderStepIds(mergedPlatform);
  const next = { ...incoming };

  for (const key of keys) {
    const step = resolveReminderStep(mergedPlatform, key);
    if (!step) continue;
    const patched = lockStepTemplate(step, key);
    if (key === "confirmation") next.confirmation = patched;
    else if (key === "reminder24h") next.reminder24h = patched;
    else if (key === "reminder2h") next.reminder2h = patched;
    else {
      next.additionalSteps = (next.additionalSteps || []).map((s) =>
        s.id === key ? { ...s, ...patched } : s,
      );
    }
  }
  return next;
}

/**
 * Platform sender: timing/toggles may change; message bodies are locked to approved templates.
 */
/** Runtime send path: lock body to approved platform template (timing may still vary). */
export function resolvePlatformLockedReminderTemplate(
  stepKey: string,
  incomingStep: ReminderStepConfig,
): ReminderStepConfig {
  return lockStepTemplate(incomingStep, stepKey);
}

export async function applyAppointmentRemindersPlatformTemplatePolicy(
  workspaceId: string,
  patch: Partial<AppointmentPlatformConfig>,
): Promise<Partial<AppointmentPlatformConfig>> {
  const platformSender = await usesPlatformAppointmentSmsSender(workspaceId);
  if (!platformSender) return patch;

  if (patch.reminderPreferences?.customMergeFields) {
    patch = {
      ...patch,
      reminderPreferences: {
        ...patch.reminderPreferences,
        customMergeFields: {},
      },
    };
  }

  if (!patch.reminders) return patch;

  const { loadAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
  const current = await loadAppointmentPlatformConfig(workspaceId);
  const mergedReminders = {
    ...current.reminders,
    ...patch.reminders,
    confirmation: { ...current.reminders.confirmation, ...(patch.reminders.confirmation || {}) },
    reminder24h: { ...current.reminders.reminder24h, ...(patch.reminders.reminder24h || {}) },
    reminder2h: { ...current.reminders.reminder2h, ...(patch.reminders.reminder2h || {}) },
    additionalSteps: patch.reminders.additionalSteps ?? current.reminders.additionalSteps,
  };

  return {
    ...patch,
    reminders: enforceStepTemplates({ ...current, reminders: mergedReminders }, mergedReminders),
  };
}
