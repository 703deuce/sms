import type { PrebuiltWorkflowTemplate } from "@/lib/appointment-workflows/templates";
import type {
  AppointmentWorkflowChannel,
  AppointmentWorkflowRecord,
  AppointmentWorkflowStep,
  AppointmentWorkflowTrigger,
  WorkflowStepAction,
  WorkflowStepTiming,
} from "@/lib/appointment-workflows/types";
import type {
  Channel,
  PrebuiltTemplate,
  WorkflowRecord,
  WorkflowStep,
} from "@/components/appointments/kimi-ui/workflows/types";

const TEMPLATE_CATEGORIES: Record<string, PrebuiltTemplate["category"]> = {
  standard_reminders: "Reminders",
  confirmation_required: "Confirmations",
  high_value_appointment: "Reminders",
  last_minute_reminders: "Reminders",
  post_appointment_follow_up: "Follow-up",
  review_request: "Follow-up",
  reschedule_follow_up: "Recovery",
  no_show_recovery: "Recovery",
  re_engagement: "Follow-up",
  payment_follow_up: "Payments",
  rapid_flow_test: "Reminders",
};

const API_TO_KIMI_ACTION: Partial<Record<WorkflowStepAction, string>> = {
  make_voice_call: "send_voice_reminder",
  send_payment_link: "create_payment_link",
};

const KIMI_TO_API_ACTION: Record<string, WorkflowStepAction> = {
  send_voice_reminder: "make_voice_call",
  create_payment_link: "send_payment_link",
};

function kimiChannelFromApiStep(step: AppointmentWorkflowStep): Channel {
  if (step.action === "make_voice_call") return "voice";
  if (step.action === "send_webhook") return "webhook";
  if (step.action === "send_payment_link") return "payment_link";
  if (step.channel === "email") return "email";
  if (step.channel === "both") return "sms";
  return "sms";
}

function apiChannelFromKimiStep(step: WorkflowStep): AppointmentWorkflowChannel {
  if (step.channel === "email") return "email";
  if (step.channel === "voice") return "sms";
  return "sms";
}

function apiChannelsFromKimi(channels: Channel[]): AppointmentWorkflowChannel[] {
  const hasSms = channels.includes("sms") || channels.includes("voice") || channels.includes("payment_link");
  const hasEmail = channels.includes("email");
  if (hasSms && hasEmail) return ["both"];
  if (hasEmail) return ["email"];
  return ["sms"];
}

export function mapPrebuiltTemplate(template: PrebuiltWorkflowTemplate): PrebuiltTemplate {
  const channels = new Set<Channel>(template.channels);
  if (template.defaultSteps.some((s) => s.action === "make_voice_call")) {
    channels.add("voice");
  }
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    trigger: template.trigger,
    channels: Array.from(channels),
    stepCount: template.defaultSteps.length,
    category: TEMPLATE_CATEGORIES[template.id] || "Reminders",
  };
}

export function mapApiWorkflowToKimi(record: AppointmentWorkflowRecord): WorkflowRecord {
  const channels: Channel[] = [];
  for (const channel of record.channels) {
    if (channel === "both") {
      channels.push("sms", "email");
    } else {
      channels.push(channel);
    }
  }
  for (const step of record.steps) {
    const kimiChannel = kimiChannelFromApiStep(step);
    if (!channels.includes(kimiChannel)) channels.push(kimiChannel);
  }

  return {
    id: record.id,
    name: record.name,
    trigger: record.trigger,
    channels,
    steps: record.steps.map(mapApiStepToKimi),
    active: record.active,
    status: record.status,
    sourceType: record.sourceType,
    templateId: record.templateId ?? undefined,
    updatedAt: record.updatedAt,
    executions30d: 0,
    appointmentTypeScope: record.appointmentTypeScope,
  };
}

export function mapApiStepToKimi(step: AppointmentWorkflowStep): WorkflowStep {
  const action = API_TO_KIMI_ACTION[step.action] || step.action;
  const channel = kimiChannelFromApiStep(step);
  return {
    id: step.id,
    name: step.name,
    timing: step.timing.kind === "time_of_day"
      ? { kind: "immediate" }
      : step.timing,
    action,
    channel,
    messageTemplate: step.messageTemplate || "",
    enabled: step.enabled !== false,
    voiceReminderTemplateId: step.voiceReminderTemplateId,
    webhook: step.webhookUrl
      ? { url: step.webhookUrl, headers: "", payload: "" }
      : undefined,
    paymentLink: step.action === "send_payment_link"
      ? { amountSource: "balance", memo: "" }
      : undefined,
    conditions: undefined,
  };
}

export function mapKimiWorkflowToApiPayload(
  wf: WorkflowRecord,
  extras?: {
    mode?: "create" | "edit";
    templateId?: string;
    initial?: AppointmentWorkflowRecord;
  },
) {
  const scope = wf.appointmentTypeScope || extras?.initial?.appointmentTypeScope || { mode: "all" as const };
  const channels = apiChannelsFromKimi(wf.channels.length ? wf.channels : ["sms"]);
  const steps = wf.steps.map(mapKimiStepToApi);

  return {
    name: wf.name.trim(),
    sourceType: extras?.templateId ? "template" : extras?.initial?.sourceType || wf.sourceType || "custom",
    templateId: extras?.templateId || extras?.initial?.templateId || wf.templateId || null,
    trigger: wf.trigger as AppointmentWorkflowTrigger,
    channels,
    active: wf.active,
    status: wf.active ? "active" : wf.status === "draft" ? "draft" : "paused",
    appointmentTypeScope: scope,
    steps,
    conditions: extras?.initial?.conditions ?? null,
  };
}

export function mapKimiStepToApi(step: WorkflowStep): AppointmentWorkflowStep {
  const action = (KIMI_TO_API_ACTION[step.action] || step.action) as WorkflowStepAction;
  return {
    id: step.id,
    name: step.name,
    timing: step.timing as WorkflowStepTiming,
    action,
    channel: apiChannelFromKimiStep(step),
    messageTemplate: step.messageTemplate || undefined,
    enabled: step.enabled,
    voiceReminderTemplateId: step.voiceReminderTemplateId,
    webhookUrl: step.webhook?.url || undefined,
    webhookSecret: undefined,
  };
}
