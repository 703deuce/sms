import type { ReminderChannel } from "@/lib/appointments/types";
import type { ReminderStepId } from "@/lib/appointments/reminders/reminders-config";

export type ReminderStepKey = ReminderStepId;

export type ReminderItem = {
  id: string;
  stepKey: ReminderStepKey;
  index: number;
  icon: "calendar" | "clock" | "message";
  title: string;
  badge: string;
  description: string;
  channel: ReminderChannel;
  emailSubject?: string;
  template: string;
  preview: string;
  characters: number;
  segments: number;
  enabled: boolean;
  voiceReminderTemplateId?: string;
  timeOfDayAt?: string;
  timeOfDayDaysBefore?: number;
  skipWeekends?: boolean;
  skipOffHours?: boolean;
  skipClosedDays?: boolean;
  stopOnReply?: boolean;
  attachIcs?: boolean;
  minutesBefore?: number;
  isCustom?: boolean;
  libraryMessageType?: string;
};

export type ReminderTestOption = {
  key: ReminderStepKey;
  label: string;
};

export type RemindersPageModel = {
  reminders: ReminderItem[];
  mergeTags: string[];
  testStepOptions: ReminderTestOption[];
  smsSenderLabel: string;
};

export type RemindersPageActions = {
  onSave: () => void;
  onToggle: (stepKey: ReminderStepKey) => void;
  onTemplateChange: (stepKey: ReminderStepKey, template: string) => void;
  onChannelChange: (stepKey: ReminderStepKey, channel: ReminderChannel) => void;
  onResetTemplate: (stepKey: ReminderStepKey) => void;
  onMinutesBeforeChange: (stepKey: ReminderStepKey, minutes: number) => void;
  onAddStep: () => void;
  onRemoveStep: (stepKey: ReminderStepKey) => void;
  onTestPhoneChange: (phone: string) => void;
  onTestStepChange: (stepKey: ReminderStepKey) => void;
  onSendTest: () => void;
  onRetry: () => void;
  onAdvancedChange: (
    stepKey: ReminderStepKey,
    patch: Partial<{
      timeOfDayAt: string;
      timeOfDayDaysBefore: number;
      skipWeekends: boolean;
      skipOffHours: boolean;
      stopOnReply: boolean;
      attachIcs: boolean;
      label: string;
    }>,
  ) => void;
};

export type RemindersSectionId =
  | "overview"
  | "sequence"
  | "assignment"
  | "templates"
  | "activity"
  | "settings";
