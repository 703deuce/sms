export const AUTO_REPLY_TRIGGERS = [
  "list_join",
  "contact_added",
  "form_submitted",
  "after_hours",
  "tag_added",
] as const;

export type AutoReplyTriggerType = (typeof AUTO_REPLY_TRIGGERS)[number];

export type AutoReplyRules = {
  oncePerContact: boolean;
  excludeUnsubscribed: boolean;
  respectQuietHours: boolean;
};

export type AutoReplyTriggerConfig = {
  listId?: string;
  listName?: string;
  tagId?: string;
  tagName?: string;
  formId?: string;
  formName?: string;
};

export type AutoReplyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: AutoReplyTriggerType;
  triggerConfig: AutoReplyTriggerConfig;
  message: string;
  mediaUrls: string[];
  status: "active" | "paused";
  rules: AutoReplyRules;
  sendCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_AUTO_REPLY_RULES: AutoReplyRules = {
  oncePerContact: true,
  excludeUnsubscribed: true,
  respectQuietHours: true,
};

export function autoReplyTriggerLabel(
  triggerType: string,
  config: AutoReplyTriggerConfig,
): string {
  switch (triggerType) {
    case "list_join":
      return config.listName
        ? `Contact joins ${config.listName}`
        : "Contact joins a list";
    case "contact_added":
      return "New contact is added";
    case "form_submitted":
      return config.formName
        ? `${config.formName} submitted`
        : "Form is submitted";
    case "after_hours":
      return "Message received after hours";
    case "tag_added":
      return config.tagName ? `Tag ${config.tagName} added` : "Tag is added";
    default:
      return triggerType;
  }
}
