import "server-only";

import {
  defaultVoiceReminderTemplate,
  parseVoiceReminderTemplates,
  type VoiceReminderTemplate,
  type VoiceRemindersPlatformConfig,
} from "./types";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";

export async function loadVoiceRemindersConfig(
  workspaceId: string,
): Promise<VoiceRemindersPlatformConfig> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const raw = platform.voiceReminders;
  const templates = parseVoiceReminderTemplates(raw?.templates);
  const defaultTemplateId =
    raw?.defaultTemplateId || templates.find((t) => t.isDefault)?.id || templates[0]?.id;
  return {
    enabled: raw?.enabled ?? true,
    defaultTemplateId,
    templates,
    provisionedPhoneNumberId: raw?.provisionedPhoneNumberId,
  };
}

export async function saveVoiceRemindersConfig(
  workspaceId: string,
  patch: Partial<VoiceRemindersPlatformConfig>,
): Promise<VoiceRemindersPlatformConfig> {
  const current = await loadVoiceRemindersConfig(workspaceId);
  const next: VoiceRemindersPlatformConfig = {
    ...current,
    ...patch,
    templates: patch.templates ?? current.templates,
  };
  if (!next.defaultTemplateId && next.templates[0]) {
    next.defaultTemplateId = next.templates[0].id;
  }
  await saveAppointmentPlatformConfig(workspaceId, { voiceReminders: next });
  return next;
}

export function resolveVoiceReminderTemplate(
  config: VoiceRemindersPlatformConfig,
  templateId?: string | null,
): VoiceReminderTemplate {
  if (templateId) {
    const found = config.templates.find((t) => t.id === templateId);
    if (found) return found;
  }
  if (config.defaultTemplateId) {
    const found = config.templates.find((t) => t.id === config.defaultTemplateId);
    if (found) return found;
  }
  return config.templates[0] || defaultVoiceReminderTemplate();
}
