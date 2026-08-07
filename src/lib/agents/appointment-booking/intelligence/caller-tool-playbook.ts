/**
 * Caller Amy — exact tool parameter playbook for live phone agents.
 * Single source of truth for Telnyx webhook schemas, descriptions, and system prompts.
 */

import type { AgentRuntimeId } from "./types";

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

/** Booking chain every caller agent must follow for appointments. */
export const BOOKING_TOOL_CHAIN = [
  "1. resolve_datetime — when caller uses relative timing (tomorrow, Friday, in 3 hours).",
  "2. calendar_availability — pass resolvedIso as from/to OR a day window; read slots[].startsAt.",
  "3. Offer ONLY times from slots[].startsAt — never convert clock times yourself.",
  "4. get_workflow_requirements — see fields_to_collect + missing_fields for this business (runtime manifest).",
  "5. save_collected_fields — after each answer, save ONE OR MORE fields by field_id (incremental).",
  "6. hold_appointment_slot (optional) — while confirming; startsAt from slots.",
  "7. book_appointment — startsAt + serviceName only; customer data comes from workflow session.",
].join("\n");

export const CALLER_AMY_TOOL_PLAYBOOK: CallerToolPlaybookEntry[] = [
  {
    toolId: "resolve_datetime",
    summary: "Resolve spoken relative dates to concrete ISO datetimes.",
    whenToCall:
      "Caller says today, tomorrow, this Friday, in three hours, next week, etc. Never guess today's date.",
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
      "Use resolvedIso from the response as calendar_availability from/to (point-in-time is OK).",
    never: ["Invent today's date or weekday", "Skip this for absolute dates the caller already gave in full"],
  },
  {
    toolId: "calendar_availability",
    summary: "Check live Calendly availability; returns slots[].startsAt ISO values.",
    whenToCall: "Before offering or booking any appointment time.",
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
      "Only after get_workflow_requirements shows complete=true and calendar_availability returned slots.",
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
    workflow: BOOKING_TOOL_CHAIN,
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
    whenToCall: "Caller picked a slot from calendar_availability and you are collecting final confirmation.",
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
    whenToCall: "Caller declines or booking cannot complete.",
    parameters: [
      { name: "holdId", required: false, type: "string", instruction: "From hold_appointment_slot response." },
      { name: "startsAt", required: false, type: "string", instruction: "Slot to release if no holdId." },
    ],
  },
  {
    toolId: "find_appointments",
    summary: "Look up caller's existing appointments.",
    whenToCall: "Before reschedule or cancel; when caller asks what they have booked.",
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
    whenToCall: "After find_appointments and new slot from calendar_availability.",
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
    whenToCall: "Caller confirms they want to cancel.",
    parameters: [
      { name: "appointmentId", required: true, type: "string", instruction: "From find_appointments." },
      { name: "reason", required: false, type: "string", instruction: "Optional cancellation reason." },
    ],
  },
  {
    toolId: "save_collected_fields",
    summary: "THE generic field save tool — submit values by field_id from the runtime manifest.",
    whenToCall:
      "Immediately after the caller answers ANY field from fields_to_collect or missing_fields. Save incrementally — one field per answer is fine.",
    parameters: [
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
    "TOOL PARAMETER PLAYBOOK — follow exactly; these are the only tools you may use:",
    "",
    BOOKING_TOOL_CHAIN,
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
  return `${entry.summary} WHEN: ${entry.whenToCall} REQUIRED FIELDS: ${params}.${never}`;
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
