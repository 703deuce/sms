export type ReminderStepKey = "confirmation" | "reminder24h" | "reminder2h";

export type ReminderItem = {
  id: string;
  stepKey: ReminderStepKey;
  index: number;
  icon: "calendar" | "clock" | "message";
  title: string;
  badge: string;
  description: string;
  channel: ReminderChannel;
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
    }>,
  ) => void;
};
