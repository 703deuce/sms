/**
 * Machine-readable block catalog for the Workflow Architect LLM.
 * Extends the approved registry with rich metadata for tool selection.
 */

import {
  APPOINTMENT_WORKFLOW_BLOCKS,
  getAppointmentWorkflowBlock,
  type WorkflowBlockDefinition as RegistryBlock,
} from "@/lib/agents/appointment-booking/workflow-blocks";

export type ArchitectBlockCategory =
  | "trigger"
  | "conversation"
  | "condition"
  | "delay"
  | "tool"
  | "handoff"
  | "outcome";

export type ArchitectBlockDefinition = {
  type: string;
  version: number;
  label: string;
  description: string;
  category: ArchitectBlockCategory;
  available: boolean;
  useWhen: string[];
  doNotUseWhen: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  configSchema: Record<string, unknown>;
  allowedAgentTypes: string[];
  requiredResources: string[];
  requiredPermissions: string[];
  sideEffect: "none" | "communication" | "booking" | "routing";
  riskLevel: "read" | "low" | "medium" | "high";
  validPredecessors?: string[];
  validSuccessors?: string[];
  terminal?: boolean;
  retryPolicy?: string;
  commonFailureModes?: string[];
  requiredFallback?: string;
};

const CATEGORY_MAP: Record<RegistryBlock["category"], ArchitectBlockCategory> = {
  trigger: "trigger",
  conversation: "conversation",
  logic: "condition",
  tool: "tool",
  outcome: "outcome",
};

const ENRICHMENT: Record<string, Partial<ArchitectBlockDefinition>> = {
  inbound_call: {
    description: "Starts when a caller reaches the assigned phone number.",
    useWhen: ["Standard business-hours inbound routing."],
    doNotUseWhen: ["After-hours-only flows — use after_hours_call."],
    sideEffect: "routing",
  },
  after_hours_call: {
    description: "Starts when a call arrives outside configured business hours.",
    useWhen: ["After-hours emergency or on-call routing."],
    doNotUseWhen: ["Standard daytime booking-only flows."],
    sideEffect: "routing",
  },
  overflow_call: {
    description: "Starts when the line is busy or unanswered.",
    useWhen: ["Overflow or missed-call handling."],
    sideEffect: "routing",
  },
  transferred_call: {
    description: "Starts when a call is transferred into this agent.",
    useWhen: ["Handling warm transfers from another line."],
    sideEffect: "routing",
  },
  callback_request: {
    description: "Starts a scheduled callback workflow.",
    useWhen: ["Owner requests callback task creation."],
    sideEffect: "routing",
  },
  greet_caller: {
    description: "Plays the approved opening greeting.",
    useWhen: ["Every inbound conversation path."],
    sideEffect: "none",
  },
  identify_intent: {
    description: "Classifies caller intent (book, emergency, transfer, etc.).",
    useWhen: ["Before branching on intent."],
    requiredResources: ["allowed_intents config"],
    sideEffect: "none",
  },
  collect_field: {
    description: "Collects a structured caller field (name, address, symptoms).",
    useWhen: ["Required information before booking or transfer."],
    doNotUseWhen: ["Ad-hoc prompt-only fields — use approved collection fields."],
    sideEffect: "none",
  },
  confirm_field: {
    description: "Reads back and confirms collected values with the caller.",
    useWhen: ["Before booking or sending consequential messages."],
    sideEffect: "none",
  },
  offer_slots: {
    description: "Offers up to three appointment time slots.",
    useWhen: ["After availability check during booking."],
    configSchema: { maxSlots: { type: "number", minimum: 1, maximum: 3 } },
    sideEffect: "none",
  },
  check_business_hours: {
    description: "Branches based on whether the call is inside business hours.",
    useWhen: ["After-hours vs business-hours routing."],
    sideEffect: "none",
  },
  branch: {
    description: "Routes to different paths based on intent or condition.",
    useWhen: ["Emergency vs normal service, booked vs not booked."],
    sideEffect: "none",
  },
  delay: {
    description: "Waits for a configured duration before continuing.",
    useWhen: ["Follow-up SMS after failed booking (e.g. ten minutes)."],
    configSchema: { delayMinutes: { type: "number" } },
    sideEffect: "none",
  },
  fallback: {
    description: "Safe fallback when a tool or transfer fails.",
    useWhen: ["After any consequential tool failure."],
    requiredFallback: "Must connect to take_message or appointment_requested.",
    sideEffect: "routing",
  },
  check_availability: {
    description: "Checks calendar availability for requested times.",
    useWhen: ["Before offering slots."],
    sideEffect: "booking",
    commonFailureModes: ["calendar_timeout", "provider_unavailable"],
    requiredFallback: "fallback or take_message",
  },
  hold_appointment_slot: {
    description: "Temporarily holds a slot while confirming details.",
    useWhen: ["Between confirmation and create_appointment."],
    sideEffect: "booking",
  },
  create_appointment: {
    description: "Creates the appointment after confirmation.",
    useWhen: ["All required fields collected and caller confirmed."],
    doNotUseWhen: ["Before confirm_field and availability check."],
    sideEffect: "booking",
    riskLevel: "high",
  },
  send_confirmation_sms: {
    description: "Sends booking confirmation SMS after verified booking.",
    useWhen: ["After create_appointment succeeds and policy permits."],
    doNotUseWhen: ["Before booking verification or when caller opted out."],
    sideEffect: "communication",
    riskLevel: "medium",
  },
  send_booking_link: {
    description: "Sends an approved booking link via SMS.",
    useWhen: ["Caller did not book during the call."],
    doNotUseWhen: ["Caller already booked or opted out."],
    sideEffect: "communication",
    riskLevel: "medium",
  },
  transfer_call: {
    description: "Transfers the live call to a staff destination.",
    useWhen: ["Emergency routing, on-call handoff."],
    requiredResources: ["transfer_destination_id"],
    sideEffect: "routing",
    commonFailureModes: ["no_answer", "busy"],
    requiredFallback: "use_fallback_transfer or take_message",
  },
  use_fallback_transfer: {
    description: "Transfers to backup destination when primary transfer fails.",
    useWhen: ["After transfer_call no-answer or busy."],
    sideEffect: "routing",
  },
  take_message: {
    description: "Collects a structured message from the caller.",
    useWhen: ["Transfer failed or booking unavailable."],
    sideEffect: "communication",
  },
  notify_staff: {
    description: "Notifies staff via SMS or internal alert.",
    useWhen: ["Urgent on-call notification after failed transfer."],
    sideEffect: "communication",
  },
  create_callback_task: {
    description: "Schedules a callback task for staff at a specified time.",
    useWhen: ["Owner requests callback at 7 AM or similar."],
    configSchema: { scheduledAt: { type: "string" }, assigneeId: { type: "string" } },
    sideEffect: "communication",
    riskLevel: "medium",
  },
  appointment_booked: { description: "Terminal: appointment successfully booked.", terminal: true, sideEffect: "none" },
  appointment_requested: { description: "Terminal: request captured, not yet booked.", terminal: true, sideEffect: "none" },
  transferred: { description: "Terminal: call transferred.", terminal: true, sideEffect: "none" },
  message_taken: { description: "Terminal: message captured.", terminal: true, sideEffect: "none" },
  caller_abandoned: { description: "Terminal: caller hung up.", terminal: true, sideEffect: "none" },
  tool_failure: { description: "Terminal: safe failure outcome.", terminal: true, sideEffect: "none" },
};

/** Blocks documented but not yet in the executable registry. */
const PLANNED_UNAVAILABLE: ArchitectBlockDefinition[] = [
  {
    type: "call_ended",
    version: 1,
    label: "Call ended",
    description: "Event trigger when a call completes — planned, not yet available.",
    category: "trigger",
    available: false,
    useWhen: [],
    doNotUseWhen: ["All current drafts — use inbound_call + branch instead."],
    inputSchema: {},
    outputSchema: {},
    configSchema: {},
    allowedAgentTypes: ["appointment_booking"],
    requiredResources: [],
    requiredPermissions: [],
    sideEffect: "none",
    riskLevel: "read",
  },
  {
    type: "booking_not_completed",
    version: 1,
    label: "Booking not completed",
    description: "Condition when caller leaves without booking — use branch on outcome instead.",
    category: "condition",
    available: false,
    useWhen: [],
    doNotUseWhen: ["Until event trigger ships — model branch + delay + send_booking_link."],
    inputSchema: {},
    outputSchema: {},
    configSchema: {},
    allowedAgentTypes: ["appointment_booking"],
    requiredResources: [],
    requiredPermissions: [],
    sideEffect: "none",
    riskLevel: "read",
  },
];

function mapRegistryBlock(block: RegistryBlock): ArchitectBlockDefinition {
  const extra = ENRICHMENT[block.type] || {};
  const category = extra.category || CATEGORY_MAP[block.category] || "tool";
  return {
    type: block.type,
    version: block.version,
    label: block.label,
    description: extra.description || block.label,
    category,
    available: true,
    useWhen: extra.useWhen || [`Use for ${block.label.toLowerCase()} steps.`],
    doNotUseWhen: extra.doNotUseWhen || [],
    inputSchema: {},
    outputSchema: {},
    configSchema: extra.configSchema || {},
    allowedAgentTypes: block.allowedAgentRoles,
    requiredResources: extra.requiredResources || [],
    requiredPermissions: [],
    sideEffect: extra.sideEffect || (block.category === "tool" ? "booking" : "none"),
    riskLevel: extra.riskLevel || block.riskLevel,
    terminal: extra.terminal,
    commonFailureModes: extra.commonFailureModes,
    requiredFallback: extra.requiredFallback,
    retryPolicy: block.type === "retry" ? "max_one" : undefined,
  };
}

export const WORKFLOW_BLOCK_CATALOG: ArchitectBlockDefinition[] = [
  ...APPOINTMENT_WORKFLOW_BLOCKS.map(mapRegistryBlock),
  ...PLANNED_UNAVAILABLE,
];

export const WORKFLOW_BLOCK_CATALOG_VERSION = "2026.08.07.1";

export function getWorkflowBlockDefinition(type: string): ArchitectBlockDefinition | null {
  return WORKFLOW_BLOCK_CATALOG.find((b) => b.type === type) || null;
}

export function getAvailableWorkflowBlocks(): ArchitectBlockDefinition[] {
  return WORKFLOW_BLOCK_CATALOG.filter((b) => b.available);
}

export function blockCatalogSummaryForPrompt(): string {
  return getAvailableWorkflowBlocks()
    .map(
      (b) =>
        `- ${b.type} (${b.category}, risk=${b.riskLevel}): ${b.description}`,
    )
    .join("\n");
}

export function isBlockAvailable(type: string): boolean {
  const def = getWorkflowBlockDefinition(type);
  return Boolean(def?.available && getAppointmentWorkflowBlock(type));
}
