export type ReminderStepKey = "confirmation" | "reminder24h" | "reminder2h";

export type ReminderItem = {
  id: string;
  stepKey: ReminderStepKey;
  index: number;
  icon: "calendar" | "clock" | "message";
  title: string;
  badge: string;
  description: string;
  template: string;
  preview: string;
  characters: number;
  segments: number;
  enabled: boolean;
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
  onResetTemplate: (stepKey: ReminderStepKey) => void;
  onTestPhoneChange: (phone: string) => void;
  onTestStepChange: (stepKey: ReminderStepKey) => void;
  onSendTest: () => void;
  onRetry: () => void;
};
