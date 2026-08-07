/**
 * Caller Amy — exact tool parameter playbook for live phone agents.
 * Single source of truth for Telnyx webhook schemas, descriptions, and system prompts.
 */

import type { AgentRuntimeId } from "./types";
import { stateAwareToolQualifier } from "@/lib/voice/workflow-engine/next-action";

export type CallerToolPlaybookEntry = {
  toolId: string;
  summary: string;
  whenToCall: string;
  /** Exact JSON fields the model must send */
  parameters: Array<{
    name: string;
    required: boolean;
    type: string;
    instruction: string;
    example?: string;
  }>;
  workflow?: string;
  never?: string[];
};

/** @deprecated Not injected into prompts — runtime state machine determines sequence. */
export const BOOKING_TOOL_CHAIN = [
  "DEPRECATED — workflow sequence is determined by runtime state, not a fixed tool chain.",
].join("\n");

/** Permanent workflow authority — injected instead of BOOKING_TOOL_CHAIN. */
export const RUNTIME_WORKFLOW_AUTHORITY = [
  "WORKFLOW ORCHESTRATION (runtime is authoritative):",
  "You interpret what the caller means in natural language.",
  "After every caller turn, call runtime_turn with utterance, interpreted_intent, and extracted_information.",
  "The Transovo runtime decides workflow state, required fields, scheduling, transfers, and hangup.",
  "Never call calendar, booking, field, transfer, or hangup tools — they are not available.",
  "Only say an action completed after runtime_turn returns success.",
  "If runtime_turn returns end_call: true, give a brief closing line and end the conversation.",
].join("\n");

export const CALLER_AMY_TOOL_PLAYBOOK: CallerToolPlaybookEntry[] = [
  {
    toolId: "resolve_datetime",
    summary: "Resolve spoken relative dates to concrete ISO datetimes.",
    whenToCall:
      "USE ONLY when workflow_state is CHECKING_AVAILABILITY or SELECTING_SLOT and this tool is in allowed_tools. Caller uses relative timing (today, tomorrow, Friday). Never guess today's date.",
    parameters: [
      {
        name: "spoken",
        required: true,
        type: "string",
        instruction: "Exact caller phrase, e.g. 'tomorrow at 5pm', 'this Friday morning'.",
        example: "tomorrow at 5 o'clock",
      },
      {
        name: "timezone",
        required: false,
        type: "string",
        instruction: "IANA timezone; omit to use business timezone.",
        example: "America/New_York",
      },
    ],
    workflow:
      "Pass resolvedIso to calendar_availability only when runtime permits scheduling tools.",
    never: ["Invent today's date or weekday", "Skip this for absolute dates the caller already gave in full"],
  },
  {
    toolId: "calendar_availability",
    summary: "Check live Calendly availability; returns slots[].startsAt ISO values.",
    whenToCall:
      "USE ONLY when workflow_state is CHECKING_AVAILABILITY or SELECTING_SLOT and this tool is in allowed_tools. DO NOT USE while required fields remain incomplete. Do not infer readiness from conversation alone.",
    parameters: [
      {
        name: "serviceName",
        required: true,
        type: "string",
        instruction: "Appointment type name, e.g. Service Visit.",
        example: "Service Visit",
      },
      {
        name: "from",
        required: false,
        type: "string",
        instruction:
          "ISO UTC window start. After resolve_datetime, set from=resolvedIso and to=resolvedIso (same value OK).",
        example: "2026-08-07T21:00:00.000Z",
      },
      {
        name: "to",
        required: false,
        type: "string",
        instruction: "ISO UTC window end. Can equal from for a point-in-time check.",
        example: "2026-08-07T21:00:00.000Z",
      },
      {
        name: "resolvedIso",
        required: false,
        type: "string",
        instruction: "Alternative: pass resolvedIso from resolve_datetime directly.",
        example: "2026-08-07T21:00:00.000Z",
      },
      {
        name: "daysAhead",
        required: false,
        type: "number",
        instruction: "Widen search to full day if point-in-time returns empty slots (1–3).",
        example: "1",
      },
    ],
    workflow:
      "If first check returns empty slots for requested time, widen window (e.g. from noon to evening same day) and offer returned slots[].startsAt only.",
    never: [
      "Invent slot times",
      "Pass bare clock times like 17:00 without a full ISO date",
      "Book a time not returned in slots",
    ],
  },
  {
    toolId: "book_appointment",
    summary:
      "Book after caller confirms time. Customer fields are already on the workflow session — do NOT pass name/phone/email here.",
    whenToCall:
      "USE ONLY when workflow_state is READY_TO_BOOK and this tool is in allowed_tools. Requires workflow_complete=true and a selected slot. Do not infer readiness from conversation alone.",
    parameters: [
      {
        name: "startsAt",
        required: true,
        type: "string",
        instruction:
          "COPY EXACTLY from calendar_availability.slots[].startsAt (UTC ISO). Never convert 5pm yourself.",
        example: "2026-08-07T13:00:00.000Z",
      },
      {
        name: "serviceName",
        required: true,
        type: "string",
        instruction: "Same service name used in calendar_availability.",
        example: "Service Visit",
      },
      {
        name: "workflow_session_id",
        required: false,
        type: "string",
        instruction: "Optional — defaults to call session_id from get_workflow_requirements.",
      },
    ],
    workflow:
      "Copy startsAt exactly from calendar_availability.slots[].startsAt. Wait for runtime confirmation before telling caller they are booked.",
    never: [
      "Invent or convert startsAt — only use slots[].startsAt",
      "Pass customerName/customerPhone/customerEmail — use save_collected_fields instead",
      "Book before get_workflow_requirements complete=true",
      "Tell caller they are booked before success=true and status=confirmed",
    ],
  },
  {
    toolId: "hold_appointment_slot",
    summary: "Temporarily reserve a slot while confirming details.",
    whenToCall:
      "USE ONLY when workflow_state is SELECTING_SLOT or READY_TO_BOOK and this tool is in allowed_tools.",
    parameters: [
      {
        name: "startsAt",
        required: true,
        type: "string",
        instruction: "Exact copy from calendar_availability.slots[].startsAt.",
      },
      {
        name: "serviceName",
        required: true,
        type: "string",
        instruction: "Appointment type name.",
      },
      {
        name: "phone",
        required: false,
        type: "string",
        instruction: "Caller phone if known.",
      },
    ],
    never: ["Invent a time not from slots"],
  },
  {
    toolId: "release_appointment_hold",
    summary: "Release a temporary hold.",
    whenToCall:
      "USE ONLY when workflow_state is SELECTING_SLOT or READY_TO_BOOK and this tool is in allowed_tools. Caller declines or booking cannot complete.",
    parameters: [
      { name: "holdId", required: false, type: "string", instruction: "From hold_appointment_slot response." },
      { name: "startsAt", required: false, type: "string", instruction: "Slot to release if no holdId." },
    ],
  },
  {
    toolId: "find_appointments",
    summary: "Look up caller's existing appointments.",
    whenToCall:
      "USE ONLY when workflow_state is COMPLETE or GENERAL and this tool is in allowed_tools. Caller asks about an existing booking.",
    parameters: [
      {
        name: "customerPhone",
        required: true,
        type: "string",
        instruction: "Phone number appointments are under.",
        example: "+15714776175",
      },
    ],
  },
  {
    toolId: "reschedule_appointment",
    summary: "Move an existing appointment.",
    whenToCall:
      "USE ONLY when workflow_state is COMPLETE and this tool is in allowed_tools. After find_appointments returns an appointmentId.",
    parameters: [
      { name: "appointmentId", required: true, type: "string", instruction: "From find_appointments." },
      {
        name: "newStartAt",
        required: true,
        type: "string",
        instruction: "Exact copy from calendar_availability.slots[].startsAt.",
      },
    ],
  },
  {
    toolId: "cancel_appointment",
    summary: "Cancel an existing appointment.",
    whenToCall:
      "USE ONLY when workflow_state is COMPLETE and this tool is in allowed_tools. Caller confirms they want to cancel.",
    parameters: [
      { name: "appointmentId", required: true, type: "string", instruction: "From find_appointments." },
      { name: "reason", required: false, type: "string", instruction: "Optional cancellation reason." },
    ],
  },
  {
    toolId: "save_collected_fields",
    summary: "Generic field save — submit values by field_id from the runtime manifest.",
    whenToCall:
      "When saving multiple fields at once or when record_current_field is not available. Prefer record_current_field during COLLECTING_FIELDS.",
    parameters: [
      {
        name: "session_id",
        required: false,
        type: "string",
        instruction: "Workflow session id — defaults to call id from get_workflow_requirements.",
      },
      {
        name: "fields",
        required: true,
        type: "array",
        instruction:
          'Array of {field_id, value}. Example: [{field_id:"fld_car", value:"2021 Toyota Camry"}]. Use field_id from get_workflow_requirements / workflow_field_manifest_json.',
        example: '[{"field_id":"sys_name","value":"John Smith"}]',
      },
      {
        name: "active_field",
        required: false,
        type: "string",
        instruction: "field_id you just asked about — helps backend associate the answer.",
      },
      {
        name: "workflow",
        required: false,
        type: "string",
        instruction: "book_appointment | request_quote | leave_message | general",
        example: "book_appointment",
      },
      {
        name: "serviceName",
        required: false,
        type: "string",
        instruction: "Appointment type when workflow=book_appointment.",
      },
    ],
    workflow:
      "After save, response includes missing_fields and active_field for the next question. Never invent field_ids — only use ids from the runtime manifest.",
    never: [
      "Use name/phone/email top-level parameters — always use fields[] with field_id",
      "Wait until end of call to save — save each answer as you get it",
      "Invent field_ids not in fields_to_collect",
    ],
  },
  {
    toolId: "record_current_field",
    summary: "Preferred field save — submit ONLY the caller's answer; runtime knows which field is active.",
    whenToCall:
      "Immediately after the caller answers the CURRENT required field during COLLECTING_FIELDS. Use when current_required_field_json or active_field is set.",
    parameters: [
      {
        name: "value",
        required: true,
        type: "string",
        instruction: "The caller's exact answer for the field the runtime is collecting right now.",
        example: "2022 Honda Accord",
      },
      {
        name: "workflow",
        required: false,
        type: "string",
        instruction: "book_appointment | general — defaults to book_appointment.",
      },
      {
        name: "serviceName",
        required: false,
        type: "string",
        instruction: "Appointment type when workflow=book_appointment.",
      },
    ],
    workflow:
      "Response includes next_field with label/instruction for the following question. Never pass field_id — the backend resolves it from workflow state.",
    never: [
      "Pass field_id — the runtime already knows the active field",
      "Use when no active field is set — call get_runtime_context first",
      "Use for multiple fields at once — use continue_workflow only after collection is complete",
    ],
  },
  {
    toolId: "continue_workflow",
    summary:
      "Single orchestration entry — pass what the caller said; runtime performs scheduling/booking internally.",
    whenToCall:
      "After workflow_complete=true: pass preferred time (CHECKING_AVAILABILITY), chosen slot (SELECTING_SLOT), or confirm:true after explicit booking confirmation (READY_TO_BOOK). During COLLECTING_FIELDS use record_current_field instead.",
    parameters: [
      {
        name: "user_input",
        required: false,
        type: "string",
        instruction: "Caller's words: preferred day/time, or chosen slot from offered times.",
        example: "tomorrow afternoon",
      },
      {
        name: "confirm",
        required: false,
        type: "boolean",
        instruction: "true only after caller explicitly confirms booking.",
        example: "true",
      },
      {
        name: "startsAt",
        required: false,
        type: "string",
        instruction: "Exact ISO slot if caller picked a specific offered time.",
      },
      {
        name: "serviceName",
        required: false,
        type: "string",
        instruction: "Appointment type when known.",
      },
    ],
    workflow:
      "Response includes workflow_state, next_action, speak, and data (e.g. slots). Trust next_action — do not call calendar or book tools directly.",
    never: [
      "Use during COLLECTING_FIELDS — use record_current_field",
      "Set confirm=true without explicit caller confirmation",
      "Invent slot times not returned in data.slots",
    ],
  },
  {
    toolId: "get_workflow_requirements",
    summary: "Get current field manifest + what is still missing for this workflow.",
    whenToCall:
      "At start of booking flow, after each save_collected_fields, or before book_appointment.",
    parameters: [
      {
        name: "workflow",
        required: true,
        type: "string",
        instruction: "book_appointment | request_quote | leave_message | emergency_service | general",
        example: "book_appointment",
      },
      {
        name: "serviceName",
        required: false,
        type: "string",
        instruction: "Refines required fields for this appointment type.",
      },
    ],
    workflow:
      "Read fields_to_collect for labels/instructions. Ask only for missing_fields. When complete=true, proceed to book_appointment.",
  },
  {
    toolId: "get_runtime_context",
    summary: "Full runtime snapshot — state, allowed tools, active field, known info.",
    whenToCall:
      "When unsure what step you are on, which tools are permitted, or what field to collect next. Trust this over conversation memory.",
    parameters: [
      {
        name: "workflow",
        required: false,
        type: "string",
        instruction: "book_appointment | general — defaults to book_appointment.",
      },
      {
        name: "serviceName",
        required: false,
        type: "string",
        instruction: "Appointment type.",
      },
    ],
    workflow:
      "Response.state tells the current phase. Response.allowed_tools lists permitted actions. Response.current_field has the active collection target.",
    never: [
      "Guess workflow state from conversation history",
      "Call tools not listed in allowed_tools",
    ],
  },
  {
    toolId: "save_caller_info",
    summary: "DEPRECATED — use save_collected_fields with field_id. Legacy shim only.",
    whenToCall: "Avoid — prefer save_collected_fields.",
    parameters: [
      { name: "fields", required: false, type: "array", instruction: "Preferred: [{field_id, value}]" },
    ],
  },
  {
    toolId: "save_customer_info",
    summary: "DEPRECATED — alias for save_collected_fields.",
    whenToCall: "Avoid — prefer save_collected_fields.",
    parameters: [
      { name: "fields", required: true, type: "array", instruction: "[{field_id, value}]" },
    ],
  },
  {
    toolId: "check_customer_fields",
    summary: "Alias for get_workflow_requirements.",
    whenToCall: "Same as get_workflow_requirements.",
    parameters: [
      { name: "workflow", required: true, type: "string", instruction: "book_appointment etc." },
      { name: "serviceName", required: false, type: "string", instruction: "Service name." },
    ],
  },
  {
    toolId: "take_structured_message",
    summary: "Save a callback/message when booking or transfer fails.",
    whenToCall: "Cannot book, transfer, or answer; caller wants a callback.",
    parameters: [
      { name: "reason", required: true, type: "string", instruction: "Why they called / message body." },
      { name: "caller_name", required: true, type: "string", instruction: "Caller name." },
      { name: "phone", required: true, type: "string", instruction: "Callback phone." },
      { name: "urgency", required: false, type: "string", instruction: "normal | high | urgent" },
    ],
  },
  {
    toolId: "lookup_customer",
    summary: "Find existing contact by phone or name.",
    whenToCall: "Recognizing returning callers before booking.",
    parameters: [
      { name: "phone", required: false, type: "string", instruction: "Caller phone." },
      { name: "query", required: false, type: "string", instruction: "Name search." },
    ],
  },
  {
    toolId: "send_sms",
    summary: "Send SMS to caller.",
    whenToCall: "When policy allows SMS confirmation or follow-up.",
    parameters: [
      { name: "to", required: true, type: "string", instruction: "E.164 phone." },
      { name: "body", required: true, type: "string", instruction: "SMS text." },
    ],
  },
  {
    toolId: "escalate_human",
    summary: "Transfer to a human phone destination.",
    whenToCall: "Caller asks for a person; policy requires human handoff.",
    parameters: [
      {
        name: "target_name",
        required: true,
        type: "string",
        instruction: "Configured destination name, e.g. Agent Handoff or Front Desk.",
      },
      { name: "reason", required: false, type: "string", instruction: "Brief summary for staff." },
    ],
    never: ["Invent a phone number", "Call twice while transfer is ringing"],
  },
];

const PLAYBOOK_BY_ID = new Map(
  CALLER_AMY_TOOL_PLAYBOOK.map((e) => [e.toolId, e]),
);

export function getCallerToolPlaybook(toolId: string): CallerToolPlaybookEntry | undefined {
  return PLAYBOOK_BY_ID.get(toolId);
}

function formatParameterBlock(entry: CallerToolPlaybookEntry): string {
  const params = entry.parameters
    .map((p) => {
      const req = p.required ? "REQUIRED" : "optional";
      const ex = p.example ? ` Example: ${p.example}.` : "";
      return `  - ${p.name} (${p.type}, ${req}): ${p.instruction}${ex}`;
    })
    .join("\n");
  const never = entry.never?.length
    ? `\nNEVER: ${entry.never.join("; ")}.`
    : "";
  const workflow = entry.workflow ? `\nWORKFLOW:\n${entry.workflow}` : "";
  return `${entry.summary}\nWHEN: ${entry.whenToCall}\nPARAMETERS:\n${params}${workflow}${never}`;
}

/** Full playbook section for system prompt (enabled tools only). */
export function compileCallerToolPlaybookForPrompt(enabledToolIds: string[]): string {
  const lines = [
    "TOOL PARAMETER PLAYBOOK — follow exactly:",
    "",
    RUNTIME_WORKFLOW_AUTHORITY,
    "",
  ];
  for (const id of enabledToolIds) {
    const entry = PLAYBOOK_BY_ID.get(id);
    if (!entry) continue;
    lines.push(`### ${entry.toolId}`);
    lines.push(formatParameterBlock(entry));
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Telnyx webhook description override — appended to catalog description. */
export function callerToolWebhookDescription(toolId: string): string | null {
  const entry = PLAYBOOK_BY_ID.get(toolId);
  if (!entry) return null;
  const params = entry.parameters
    .filter((p) => p.required)
    .map((p) => p.name)
    .join(", ");
  const never = entry.never?.length ? ` NEVER: ${entry.never.join("; ")}.` : "";
  const stateGate = stateAwareToolQualifier(toolId);
  const gateSuffix = stateGate ? ` ${stateGate}` : "";
  return `${entry.summary} WHEN: ${entry.whenToCall} REQUIRED FIELDS: ${params}.${never}${gateSuffix}`;
}

/** Build JSON-schema body for Telnyx from playbook (required fields enforced). */
export function callerToolWebhookBody(toolId: string): Record<string, unknown> | null {
  const entry = PLAYBOOK_BY_ID.get(toolId);
  if (!entry) return null;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of entry.parameters) {
    properties[p.name] = {
      type: p.type,
      description: p.instruction + (p.example ? ` Example: ${p.example}` : ""),
    };
    if (p.required) required.push(p.name);
  }
  // Accept common aliases the backend normalizes
  if (toolId === "book_appointment") {
    properties.startsAt = properties.startsAt || {
      type: "string",
      description: "Same as startsAt — copy from calendar_availability.slots[].startsAt",
    };
    properties.startAt = { type: "string", description: "Alias for startsAt" };
    properties.name = { type: "string", description: "Alias for customerName" };
    properties.email = { type: "string", description: "Alias for customerEmail" };
    properties.phone = { type: "string", description: "Alias for customerPhone" };
    properties.full_name = { type: "string", description: "Alias for customerName" };
  }
  if (toolId === "calendar_availability") {
    properties.from = { type: "string", description: "ISO UTC start; use resolvedIso from resolve_datetime" };
    properties.to = { type: "string", description: "ISO UTC end; can equal from" };
    properties.resolvedIso = { type: "string", description: "From resolve_datetime.resolvedIso" };
    properties.service = { type: "string", description: "Alias for serviceName" };
  }
  if (toolId === "find_appointments") {
    properties.phone = { type: "string", description: "Alias for customerPhone" };
  }
  if (toolId === "hold_appointment_slot") {
    properties.startAt = { type: "string", description: "Alias for startsAt" };
  }
  return { type: "object", properties, required };
}

export function callerAmyRuntimeToolIds(): string[] {
  return CALLER_AMY_TOOL_PLAYBOOK.map((e) => e.toolId);
}

export function shouldInjectCallerPlaybook(
  runtimeId: AgentRuntimeId | string | undefined,
  enabledTools: string[],
): boolean {
  if (runtimeId === "caller_amy") return true;
  return enabledTools.some((t) => PLAYBOOK_BY_ID.has(t));
}
