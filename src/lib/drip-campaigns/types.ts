export const DRIP_CAMPAIGN_TRIGGERS = [
  "tag_added",
  "list_join",
  "contact_added",
  "form_submitted",
] as const;

export type DripCampaignTriggerType = (typeof DRIP_CAMPAIGN_TRIGGERS)[number];

export type DripDelayUnit = "immediate" | "minutes" | "hours" | "days";

export type DripStepChannel = "sms" | "voice";

export type DripStep = {
  id: string;
  delayAmount: number;
  delayUnit: DripDelayUnit;
  channel?: DripStepChannel;
  message: string;
  mediaUrls?: string[];
  voiceReminderTemplateId?: string;
};

export type DripTriggerConfig = {
  listId?: string;
  listName?: string;
  tagId?: string;
  tagName?: string;
  formId?: string;
  formName?: string;
  exclusionListId?: string;
  exclusionSegmentId?: string;
};

export type DripCampaignRecord = {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: DripCampaignTriggerType;
  triggerConfig: DripTriggerConfig;
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  status: "active" | "paused" | "draft";
  steps: DripStep[];
  triggeredCount: number;
  messagesSent: number;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DripEnrollmentRecord = {
  id: string;
  dripCampaignId: string;
  workspaceId: string;
  contactId: string;
  status: "active" | "completed" | "opted_out" | "paused";
  currentStepIndex: number;
  nextRunAt: string | null;
  startedAt: string;
  completedAt: string | null;
  lastSentAt: string | null;
  replied: boolean;
  opened: boolean;
  contactName: string;
  contactPhone: string;
};

export function dripTriggerLabel(
  triggerType: string,
  config: DripTriggerConfig,
): string {
  switch (triggerType) {
    case "tag_added":
      return config.tagName ? `Tag '${config.tagName}' added` : "Contact tag added";
    case "list_join":
      return config.listName ? `Contact joins ${config.listName}` : "Contact joins a list";
    case "contact_added":
      return "New contact created (not list membership)";
    case "form_submitted":
      return config.formName ? `${config.formName} submitted` : "Form is submitted";
    default:
      return triggerType;
  }
}

export function parseDripSteps(raw: unknown): DripStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const channel = (o.channel === "voice" ? "voice" : "sms") as DripStepChannel;
      const message = typeof o.message === "string" ? o.message : "";
      const voiceReminderTemplateId =
        typeof o.voiceReminderTemplateId === "string" ? o.voiceReminderTemplateId : undefined;
      if (!message.trim() && channel === "sms") return null;
      if (channel === "voice" && !message.trim() && !voiceReminderTemplateId) return null;
      return {
        id: typeof o.id === "string" ? o.id : `step_${index + 1}`,
        delayAmount: Number(o.delayAmount ?? 0),
        delayUnit: (["immediate", "minutes", "hours", "days"].includes(String(o.delayUnit))
          ? o.delayUnit
          : index === 0
            ? "immediate"
            : "days") as DripDelayUnit,
        channel,
        message,
        voiceReminderTemplateId,
        mediaUrls: Array.isArray(o.mediaUrls)
          ? o.mediaUrls.filter((u): u is string => typeof u === "string")
          : undefined,
      };
    })
    .filter(Boolean) as DripStep[];
}

export function delayLabel(step: DripStep, index: number): string {
  if (step.delayUnit === "immediate") {
    return index === 0 ? "When triggered" : "Immediately after previous";
  }
  const amount = step.delayAmount || 1;
  const unit =
    step.delayUnit === "minutes"
      ? amount === 1
        ? "minute"
        : "minutes"
      : step.delayUnit === "hours"
        ? amount === 1
          ? "hour"
          : "hours"
        : amount === 1
          ? "day"
          : "days";
  return index === 0
    ? `${amount} ${unit} after trigger`
    : `${amount} ${unit} after previous message`;
}

export function delayToMs(step: DripStep): number {
  if (step.delayUnit === "immediate") return 0;
  const amount = Math.max(1, step.delayAmount || 1);
  switch (step.delayUnit) {
    case "minutes":
      return amount * 60_000;
    case "hours":
      return amount * 3_600_000;
    case "days":
    default:
      return amount * 86_400_000;
  }
}

export function newDripStep(index: number): DripStep {
  return {
    id: `step_${Date.now()}_${index}`,
    delayAmount: index === 0 ? 0 : 1,
    delayUnit: index === 0 ? "immediate" : "days",
    channel: "sms",
    message: "",
  };
}
