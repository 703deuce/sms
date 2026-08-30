/**
 * Canonical AI agent tool catalog.
 *
 * Transovo DB is source of truth for which tools an agent may use.
 * Telnyx receives only the synchronized subset for that assistant.
 * Do not auto-enable every catalog entry on every agent.
 */

import type { VoiceAgentType } from "../types";

export type ToolCategory =
  | "call_control"
  | "communications"
  | "crm"
  | "knowledge"
  | "scheduling"
  | "agent_routing"
  | "advanced";

export type ToolRisk = "low" | "medium" | "high";
export type ToolAccess = "read" | "write" | "control";
export type ToolProvider = "telnyx_native" | "transovo_builtin" | "workspace";

export type CatalogToolDef = {
  key: string;
  name: string;
  description: string;
  category: ToolCategory;
  provider: ToolProvider;
  /** Builtin webhook toolType, or native Telnyx type. */
  toolType: string;
  access: ToolAccess;
  risk: ToolRisk;
  requiresIntegration?: "crm" | "sms" | "calendar" | "sip";
  /** When true, tool may disclose another contact's PII only in internal/test mode. */
  disclosureSensitive?: boolean;
  /** Shown in catalog but not yet synchronized as a native Telnyx tool. */
  comingSoon?: boolean;
};

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  call_control: "Call Control",
  communications: "Communications",
  crm: "CRM",
  knowledge: "Knowledge and Data",
  scheduling: "Scheduling",
  agent_routing: "Agent Routing",
  advanced: "Advanced",
};

export const TOOL_CATEGORY_ORDER: ToolCategory[] = [
  "call_control",
  "communications",
  "crm",
  "knowledge",
  "scheduling",
  "agent_routing",
  "advanced",
];

/** Built-in + native tools customers can enable per agent. */
export const TOOL_CATALOG: CatalogToolDef[] = [
  {
    key: "hangup",
    name: "Hang up",
    description:
      "End the call after a short closing statement when the conversation is complete or the caller asks to hang up.",
    category: "call_control",
    provider: "telnyx_native",
    toolType: "hangup",
    access: "control",
    risk: "low",
  },
  {
    key: "transfer",
    name: "Transfer",
    description:
      "Transfer to a named destination (Front Desk, Sales, Billing). Agent cannot invent phone numbers.",
    category: "call_control",
    provider: "telnyx_native",
    toolType: "transfer",
    access: "control",
    risk: "medium",
  },
  {
    key: "sip_refer",
    name: "SIP Refer",
    description:
      "Transfer through SIP REFER when a SIP URI destination is configured for this agent.",
    category: "call_control",
    provider: "transovo_builtin",
    toolType: "sip_refer",
    access: "control",
    risk: "high",
    requiresIntegration: "sip",
  },
  {
    key: "send_dtmf",
    name: "Send DTMF",
    description: "Send approved DTMF sequences for IVR workflows on the active call.",
    category: "call_control",
    provider: "transovo_builtin",
    toolType: "send_dtmf",
    access: "control",
    risk: "medium",
  },
  {
    key: "end_call",
    name: "End call (webhook)",
    description: "Safely end the call via Transovo when native hangup is unavailable.",
    category: "call_control",
    provider: "transovo_builtin",
    toolType: "end_call",
    access: "control",
    risk: "low",
  },
  {
    key: "send_sms",
    name: "Send SMS",
    description: "Send an approved SMS (links, confirmations, callbacks) to the caller.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "send_sms",
    access: "write",
    risk: "medium",
    requiresIntegration: "sms",
  },
  {
    key: "start_automation",
    name: "Start automation",
    description:
      "Start a linked AutomationFlow for the current caller (follow-up sequences, estimate follow-up, etc.).",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "start_automation",
    access: "write",
    risk: "medium",
  },
  {
    key: "send_email",
    name: "Send email",
    description: "Send an email follow-up to the caller or contact.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "send_email",
    access: "write",
    risk: "medium",
  },
  {
    key: "create_task",
    name: "Create callback task",
    description:
      "Create a follow-up task for the team (and in the connected CRM when available).",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "create_task",
    access: "write",
    risk: "low",
  },
  {
    key: "take_structured_message",
    name: "Take structured message",
    description:
      "Capture a caller message with name, phone, reason, and urgency for the team.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "take_structured_message",
    access: "write",
    risk: "low",
  },
  {
    key: "mark_disposition",
    name: "Mark call disposition",
    description: "Record the call outcome (lead, message, transferred, spam, completed).",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "mark_disposition",
    access: "write",
    risk: "low",
  },
  {
    key: "save_collected_fields",
    name: "Save collected fields",
    description: "Save caller answers by field_id from the runtime manifest.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "save_collected_fields",
    access: "write",
    risk: "medium",
  },
  {
    key: "record_current_field",
    name: "Record current field",
    description:
      "Save the caller's answer for the field the runtime is currently collecting. Only pass value — field_id is determined by workflow state.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "record_current_field",
    access: "write",
    risk: "medium",
  },
  {
    key: "runtime_turn",
    name: "Runtime turn",
    description:
      "Submit caller meaning to the Transovo runtime — the only model-facing business interface.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "runtime_turn",
    access: "write",
    risk: "medium",
  },
  {
    key: "continue_workflow",
    name: "Continue workflow",
    description:
      "Single orchestration entry point — pass the caller's semantic input; the runtime performs the legal next booking action internally.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "continue_workflow",
    access: "write",
    risk: "medium",
  },
  {
    key: "get_workflow_requirements",
    name: "Get workflow requirements",
    description: "Returns fields_to_collect and missing_fields for the current workflow.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "get_workflow_requirements",
    access: "read",
    risk: "low",
  },
  {
    key: "get_runtime_context",
    name: "Get runtime context",
    description:
      "Returns current workflow state, allowed tools, active field, and collected information. Call when unsure what to do next.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "get_runtime_context",
    access: "read",
    risk: "low",
  },
  {
    key: "save_caller_info",
    name: "Save caller information",
    description: "Save collected name, phone, email, and company for the caller.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "save_caller_info",
    access: "write",
    risk: "medium",
  },
  {
    key: "update_contact_tags",
    name: "Save caller tags",
    description: "Add or remove tags on the caller’s contact record.",
    category: "communications",
    provider: "transovo_builtin",
    toolType: "update_contact_tags",
    access: "write",
    risk: "low",
  },
  {
    key: "escalate_human",
    name: "Escalate to human",
    description:
      "Escalate to a human via the named transfer target Agent Handoff / Front Desk.",
    category: "agent_routing",
    provider: "transovo_builtin",
    toolType: "escalate_human",
    access: "control",
    risk: "medium",
  },
  {
    key: "lookup_customer",
    name: "Recognize caller",
    description:
      "Look up the caller by phone/email for recognition and routing. Does not disclose another person’s phone on public inbound calls.",
    category: "crm",
    provider: "transovo_builtin",
    toolType: "lookup_customer",
    access: "read",
    risk: "low",
    requiresIntegration: "crm",
  },
  {
    key: "search_crm_contacts",
    name: "CRM contact search",
    description:
      "Search Salesforce / Zoho / Pipedrive contacts through Transovo. Ambiguous matches require clarification. Phone disclosure limited to internal/browser test mode.",
    category: "crm",
    provider: "transovo_builtin",
    toolType: "search_crm_contacts",
    access: "read",
    risk: "medium",
    requiresIntegration: "crm",
    disclosureSensitive: true,
  },
  {
    key: "create_crm_note",
    name: "Create CRM note",
    description: "Add a note on the matched CRM contact via Transovo’s CRM connection.",
    category: "crm",
    provider: "transovo_builtin",
    toolType: "create_crm_note",
    access: "write",
    risk: "medium",
    requiresIntegration: "crm",
  },
  {
    key: "create_crm_task",
    name: "Create CRM follow-up task",
    description: "Create a follow-up task in the connected CRM for the matched contact.",
    category: "crm",
    provider: "transovo_builtin",
    toolType: "create_crm_task",
    access: "write",
    risk: "medium",
    requiresIntegration: "crm",
  },
  {
    key: "upsert_crm_contact",
    name: "Create/update CRM contact",
    description: "Create or update a CRM contact with collected caller details.",
    category: "crm",
    provider: "transovo_builtin",
    toolType: "upsert_crm_contact",
    access: "write",
    risk: "high",
    requiresIntegration: "crm",
  },
  {
    key: "resolve_datetime",
    name: "Resolve date/time",
    description:
      "Resolve relative dates/times (today, tomorrow, in three hours, this Friday) using the business timezone clock. Call when the caller uses relative timing — do not invent today's date.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "resolve_datetime",
    access: "read",
    risk: "low",
  },
  {
    key: "calendar_availability",
    name: "Check availability",
    description: "Check live calendar availability before offering times.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "calendar_availability",
    access: "read",
    risk: "low",
    requiresIntegration: "calendar",
  },
  {
    key: "book_appointment",
    name: "Book appointment",
    description: "Book an appointment only after availability is confirmed by the system.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "book_appointment",
    access: "write",
    risk: "high",
    requiresIntegration: "calendar",
  },
  {
    key: "hold_appointment_slot",
    name: "Hold appointment slot",
    description:
      "Temporarily reserve a slot (default 3 minutes) while collecting final confirmation details.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "hold_appointment_slot",
    access: "write",
    risk: "medium",
    requiresIntegration: "calendar",
  },
  {
    key: "release_appointment_hold",
    name: "Release appointment hold",
    description: "Release a temporary slot hold if the caller declines or booking fails.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "release_appointment_hold",
    access: "write",
    risk: "low",
    requiresIntegration: "calendar",
  },
  {
    key: "find_appointments",
    name: "Find appointments",
    description:
      "Look up the caller's upcoming appointments by phone. Use before reschedule/cancel when the caller asks what they have booked.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "find_appointments",
    access: "read",
    risk: "low",
    requiresIntegration: "calendar",
  },
  {
    key: "reschedule_appointment",
    name: "Reschedule appointment",
    description: "Reschedule an existing appointment.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "reschedule_appointment",
    access: "write",
    risk: "high",
    requiresIntegration: "calendar",
  },
  {
    key: "cancel_appointment",
    name: "Cancel appointment",
    description: "Cancel an existing appointment.",
    category: "scheduling",
    provider: "transovo_builtin",
    toolType: "cancel_appointment",
    access: "write",
    risk: "high",
    requiresIntegration: "calendar",
  },
  {
    key: "handoff",
    name: "Agent handoff",
    description:
      "Hand the conversation to another configured AI assistant while retaining context.",
    category: "agent_routing",
    provider: "telnyx_native",
    toolType: "handoff",
    access: "control",
    risk: "medium",
  },
];

const BY_KEY = new Map(TOOL_CATALOG.map((t) => [t.key, t]));

export function getCatalogTool(key: string): CatalogToolDef | undefined {
  return BY_KEY.get(key);
}

export function catalogByCategory(): Array<{
  category: ToolCategory;
  label: string;
  tools: CatalogToolDef[];
}> {
  return TOOL_CATEGORY_ORDER.map((category) => ({
    category,
    label: TOOL_CATEGORY_LABELS[category],
    tools: TOOL_CATALOG.filter((t) => t.category === category),
  })).filter((g) => g.tools.length > 0);
}

/** Safe defaults when an agent has never configured tools. */
/** Full production receptionist set used for live phone agents. */
export const FULL_RECEPTIONIST_TOOLS = [
  "transfer",
  "escalate_human",
  "hangup",
  "send_dtmf",
  "send_sms",
  "create_task",
  "take_structured_message",
  "mark_disposition",
  "save_collected_fields",
  "record_current_field",
  "continue_workflow",
  "get_workflow_requirements",
  "get_runtime_context",
  "update_contact_tags",
  "lookup_customer",
  "search_crm_contacts",
  "create_crm_note",
  "create_crm_task",
  "upsert_crm_contact",
  "resolve_datetime",
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "find_appointments",
  "reschedule_appointment",
] as const;

export const SAFE_DEFAULT_BUILTIN_TOOLS = [
  "hangup",
  "escalate_human",
  "create_task",
  "take_structured_message",
  "mark_disposition",
  "update_contact_tags",
  "send_sms",
  "lookup_customer",
  "search_crm_contacts",
] as const;

const TEMPLATE_DEFAULTS: Record<string, readonly string[]> = {
  receptionist: [...FULL_RECEPTIONIST_TOOLS],
  lead_qualification: [
    "hangup",
    "transfer",
    "escalate_human",
    "create_task",
    "take_structured_message",
    "mark_disposition",
    "send_sms",
    "lookup_customer",
    "search_crm_contacts",
    "create_crm_note",
    "create_crm_task",
    "upsert_crm_contact",
    "resolve_datetime",
    "calendar_availability",
    "book_appointment",
    "end_call",
  ],
  appointment_booking: [
    "hangup",
    "end_call",
    "get_runtime_context",
    "record_current_field",
    "continue_workflow",
    "lookup_customer",
    "take_structured_message",
    "escalate_human",
    "create_task",
    "resolve_datetime",
    "calendar_availability",
    "hold_appointment_slot",
    "release_appointment_hold",
    "book_appointment",
    "find_appointments",
    "reschedule_appointment",
    "cancel_appointment",
    "save_collected_fields",
    "get_workflow_requirements",
    "send_sms",
  ],
  customer_support: [
    "hangup",
    "transfer",
    "handoff",
    "escalate_human",
    "create_task",
    "take_structured_message",
    "send_sms",
    "lookup_customer",
    "search_crm_contacts",
    "create_crm_note",
    "end_call",
  ],
  outbound_follow_up: [
    "hangup",
    "create_task",
    "send_sms",
    "lookup_customer",
    "create_crm_note",
    "resolve_datetime",
    "calendar_availability",
    "book_appointment",
    "end_call",
  ],
  collections: ["hangup", "create_task", "send_sms", "lookup_customer", "end_call"],
  survey: ["hangup", "create_task", "update_contact_tags", "mark_disposition", "end_call"],
  sales: [
    "hangup",
    "transfer",
    "escalate_human",
    "create_task",
    "send_sms",
    "lookup_customer",
    "search_crm_contacts",
    "create_crm_note",
    "create_crm_task",
    "upsert_crm_contact",
    "resolve_datetime",
    "calendar_availability",
    "book_appointment",
    "end_call",
  ],
  custom: [...SAFE_DEFAULT_BUILTIN_TOOLS],
};

export function defaultBuiltinToolsForAgentType(
  agentType?: VoiceAgentType | string | null,
): string[] {
  const key = String(agentType || "custom");
  return [...(TEMPLATE_DEFAULTS[key] || SAFE_DEFAULT_BUILTIN_TOOLS)];
}

/**
 * Resolve enabled catalog keys for an agent.
 * Explicit config wins; otherwise template/safe defaults (never “all tools”).
 */
export function resolveEnabledBuiltinTools(input: {
  enabledBuiltinTools?: string[] | null;
  agentType?: string | null;
}): string[] {
  if (Array.isArray(input.enabledBuiltinTools)) {
    return input.enabledBuiltinTools.filter((k) => BY_KEY.has(k));
  }
  return defaultBuiltinToolsForAgentType(input.agentType);
}

export function isBuiltinToolEnabled(
  enabledKeys: string[],
  toolTypeOrKey: string,
): boolean {
  if (enabledKeys.includes(toolTypeOrKey)) return true;
  const def = TOOL_CATALOG.find((t) => t.toolType === toolTypeOrKey);
  return Boolean(def && enabledKeys.includes(def.key));
}

/** Webhook body schemas for Transovo builtins attached to Telnyx. */
export const BUILTIN_WEBHOOK_BODIES: Record<
  string,
  {
    name: string;
    toolType: string;
    description: string;
    body: Record<string, unknown>;
  }
> = {
  runtime_turn: {
    name: "runtime_turn",
    toolType: "runtime_turn",
    description:
      "Submit the caller's meaning to the Transovo runtime. The runtime is authoritative for workflow state, field collection, scheduling, transfers, and ending the call. Always call this after understanding what the caller said.",
    body: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "What the caller said, in natural language.",
        },
        interpreted_intent: {
          type: "string",
          description:
            "Your interpretation: book_appointment, take_message, transfer, end_call, provide_information, etc.",
        },
        extracted_information: {
          type: "object",
          description: "Structured facts extracted from the caller's words.",
          additionalProperties: true,
        },
        confirm: {
          type: "boolean",
          description: "True only when the caller explicitly confirmed a booking.",
        },
      },
      required: ["utterance"],
    },
  },
  lookup_customer: {
    name: "lookup_customer",
    toolType: "lookup_customer",
    description:
      "Look up the caller or a contact by phone/email in Transovo and connected CRM. Use for recognition and routing. Do not read another person’s phone number aloud to an unknown caller.",
    body: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        query: { type: "string", description: "Optional name query" },
      },
      required: [],
    },
  },
  search_crm_contacts: {
    name: "search_crm_contacts",
    toolType: "search_crm_contacts",
    description:
      "Search Transovo + connected CRM (Salesforce/Zoho/Pipedrive) for contacts by name, phone, or email. If multiple matches, ask the caller to clarify. Never invent IDs or phone numbers. On production inbound calls, use results for recognition/routing — do not disclose another contact’s phone unless this is an internal/browser test.",
    body: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name or free-text query" },
        phone: { type: "string" },
        email: { type: "string" },
        match_type: {
          type: "string",
          description: "auto | name | phone | email",
        },
        limit: { type: "number", description: "Max matches (server caps at 5)" },
      },
      required: [],
    },
  },
  update_contact_tags: {
    name: "update_contact_tags",
    toolType: "update_contact_tags",
    description: "Add or remove tags on a contact.",
    body: {
      type: "object",
      properties: {
        phone: { type: "string" },
        addTags: { type: "array", items: { type: "string" } },
        removeTags: { type: "array", items: { type: "string" } },
      },
      required: ["phone"],
    },
  },
  create_task: {
    name: "create_task",
    toolType: "create_task",
    description: "Create a follow-up task for the team.",
    body: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string" },
        notes: { type: "string" },
        phone: { type: "string" },
      },
      required: ["title"],
    },
  },
  send_email: {
    name: "send_email",
    toolType: "send_email",
    description: "Send an email follow-up to the caller or contact.",
    body: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  resolve_datetime: {
    name: "resolve_datetime",
    toolType: "resolve_datetime",
    description:
      "Resolve relative dates/times using the live business timezone clock. Call when the caller says today, tomorrow, this Friday, in three hours, etc. Do NOT invent today's date. You may keep talking while this runs; use the result before offering or booking slots.",
    body: {
      type: "object",
      properties: {
        spoken: {
          type: "string",
          description:
            "Caller phrase to resolve, e.g. 'tomorrow at 2pm', 'in three hours', 'this Friday morning'",
        },
        timezone: {
          type: "string",
          description: "Optional IANA timezone override; defaults to business timezone",
        },
      },
      required: ["spoken"],
    },
  },
  calendar_availability: {
    name: "calendar_availability",
    toolType: "calendar_availability",
    description:
      "Check live calendar availability before offering times. After resolve_datetime, pass from=resolvedIso and to=resolvedIso (same value OK). Read slots[].startsAt and offer ONLY those times. Keep daysAhead ≤ 3.",
    body: {
      type: "object",
      properties: {
        serviceName: { type: "string", description: "Appointment type / service name (required)" },
        service: { type: "string" },
        resolvedIso: {
          type: "string",
          description: "From resolve_datetime.resolvedIso — use as from/to for point-in-time checks",
        },
        from: { type: "string", description: "ISO UTC window start (use resolvedIso)" },
        to: { type: "string", description: "ISO UTC window end (can equal from)" },
        startTime: { type: "string", description: "ISO datetime window start" },
        endTime: { type: "string", description: "ISO datetime window end" },
        daysAhead: { type: "number", description: "Widen search 1–3 days if needed" },
      },
      required: ["serviceName"],
    },
  },
  book_appointment: {
    name: "book_appointment",
    toolType: "book_appointment",
    description:
      "Book ONLY after calendar_availability returned slots and get_workflow_requirements complete=true. Copy startsAt EXACTLY from slots. Customer data is on the workflow session — do not pass customer fields here.",
    body: {
      type: "object",
      properties: {
        startsAt: {
          type: "string",
          description: "EXACT copy from calendar_availability.slots[].startsAt (UTC ISO)",
        },
        startAt: { type: "string", description: "Alias for startsAt" },
        serviceName: { type: "string", description: "Appointment type name" },
        workflow_session_id: { type: "string", description: "Optional session id (defaults to call)" },
        timezone: { type: "string", description: "IANA timezone" },
      },
      required: ["startsAt", "serviceName"],
    },
  },
  hold_appointment_slot: {
    name: "hold_appointment_slot",
    toolType: "hold_appointment_slot",
    description:
      "Temporarily reserve a calendar slot (default 180s) while collecting final confirmation. Call before book_appointment when the caller is confirming details. Never invent a time — use startsAt from calendar_availability.",
    body: {
      type: "object",
      properties: {
        startsAt: { type: "string" },
        startAt: { type: "string" },
        serviceName: { type: "string" },
        phone: { type: "string" },
        durationMinutes: { type: "number" },
        expiresInSeconds: { type: "number" },
      },
      required: ["startsAt"],
    },
  },
  release_appointment_hold: {
    name: "release_appointment_hold",
    toolType: "release_appointment_hold",
    description: "Release a temporary slot hold if the caller declines or booking cannot complete.",
    body: {
      type: "object",
      properties: {
        holdId: { type: "string" },
        startsAt: { type: "string" },
      },
      required: [],
    },
  },
  find_appointments: {
    name: "find_appointments",
    toolType: "find_appointments",
    description:
      "Find the caller's upcoming appointments by phone. Call this when they ask what they have booked, or before reschedule/cancel. Returns appointmentId values to pass to reschedule_appointment or cancel_appointment.",
    body: {
      type: "object",
      properties: {
        phone: { type: "string", description: "Caller phone (E.164 preferred)" },
        customerPhone: { type: "string" },
        contactId: { type: "string" },
        includePast: { type: "boolean" },
      },
      required: [],
    },
  },
  reschedule_appointment: {
    name: "reschedule_appointment",
    toolType: "reschedule_appointment",
    description:
      "Reschedule an existing appointment. Pass appointmentId from find_appointments and newStartAt from calendar_availability.slots[].startsAt.",
    body: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        newStartAt: {
          type: "string",
          description: "ISO start from calendar_availability.slots[].startsAt",
        },
        startsAt: { type: "string" },
      },
      required: ["appointmentId", "newStartAt"],
    },
  },
  cancel_appointment: {
    name: "cancel_appointment",
    toolType: "cancel_appointment",
    description: "Cancel an existing appointment.",
    body: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["appointmentId"],
    },
  },
  send_sms: {
    name: "send_sms",
    toolType: "send_sms",
    description: "Send an SMS to the caller or another number.",
    body: {
      type: "object",
      properties: {
        to: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "body"],
    },
  },
  send_dtmf: {
    name: "send_dtmf",
    toolType: "send_dtmf",
    description:
      "Send DTMF digits on the active call (extensions, IVR menus). Digits: 0-9 A-D * # w (wait) , (pause).",
    body: {
      type: "object",
      properties: {
        digits: { type: "string", description: "DTMF sequence up to 32 chars" },
      },
      required: ["digits"],
    },
  },
  end_call: {
    name: "end_call",
    toolType: "end_call",
    description: "End the call safely when the conversation is complete.",
    body: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      required: [],
    },
  },
  take_structured_message: {
    name: "take_structured_message",
    toolType: "take_structured_message",
    description:
      "Save a structured message from the caller. Confirm details before calling. Never invent a phone number.",
    body: {
      type: "object",
      properties: {
        caller_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        reason: { type: "string" },
        urgency: { type: "string", description: "low | normal | high" },
        preferred_callback: { type: "string" },
        notes: { type: "string" },
      },
      required: ["reason"],
    },
  },
  mark_disposition: {
    name: "mark_disposition",
    toolType: "mark_disposition",
    description: "Record the call disposition/outcome.",
    body: {
      type: "object",
      properties: {
        disposition: {
          type: "string",
          description:
            "lead | message_taken | transferred | completed | spam | callback_requested | no_action",
        },
        notes: { type: "string" },
      },
      required: ["disposition"],
    },
  },
  save_collected_fields: {
    name: "save_collected_fields",
    toolType: "save_collected_fields",
    description:
      "Save caller answers by field_id from the runtime manifest. Pass fields:[{field_id, value}]. Save incrementally after each answer.",
    body: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Workflow session id (defaults to call id)" },
        fields: {
          type: "array",
          description: "Array of {field_id, value} objects from fields_to_collect / missing_fields",
          items: {
            type: "object",
            properties: {
              field_id: { type: "string" },
              value: { type: "string" },
            },
            required: ["field_id", "value"],
          },
        },
        active_field: { type: "string", description: "field_id just collected" },
        workflow: { type: "string", description: "book_appointment | general | etc." },
        serviceName: { type: "string" },
      },
      required: ["fields"],
    },
  },
  record_current_field: {
    name: "record_current_field",
    toolType: "record_current_field",
    description:
      "Save the caller's answer for the CURRENT required field. The runtime already knows which field is active — only pass value. USE when workflow state is COLLECTING_FIELDS and current_field is set. DO NOT USE when no active field or when saving multiple fields at once.",
    body: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "The caller's answer for the current required field.",
        },
        workflow: { type: "string", description: "book_appointment | general | etc." },
        serviceName: { type: "string" },
      },
      required: ["value"],
    },
  },
  continue_workflow: {
    name: "continue_workflow",
    toolType: "continue_workflow",
    description:
      "Pass the caller's semantic input; the runtime decides and performs the legal booking action. USE for preferred times, slot selection, and booking confirmation — never call calendar or booking tools directly.",
    body: {
      type: "object",
      properties: {
        user_input: {
          type: "string",
          description: "Caller's words: preferred time, chosen slot, or other booking-related input.",
        },
        confirm: {
          type: "boolean",
          description: "Set true only after the caller explicitly confirms booking.",
        },
        serviceName: { type: "string", description: "Appointment type if known." },
        startsAt: {
          type: "string",
          description: "Optional exact ISO slot when caller picked a specific offered time.",
        },
        workflow: { type: "string", description: "book_appointment | general" },
      },
    },
  },
  get_workflow_requirements: {
    name: "get_workflow_requirements",
    toolType: "get_workflow_requirements",
    description:
      "Returns fields_to_collect and missing_fields for the current workflow. Ask only for missing fields.",
    body: {
      type: "object",
      properties: {
        workflow: { type: "string", description: "book_appointment | request_quote | leave_message | general" },
        serviceName: { type: "string" },
      },
      required: ["workflow"],
    },
  },
  get_runtime_context: {
    name: "get_runtime_context",
    toolType: "get_runtime_context",
    description:
      "Returns current workflow state, allowed tools, active field, known information, and next steps. USE when unsure what action is permitted. DO NOT invent state — trust this response.",
    body: {
      type: "object",
      properties: {
        workflow: { type: "string", description: "book_appointment | general | etc." },
        serviceName: { type: "string" },
      },
    },
  },
  save_caller_info: {
    name: "save_caller_info",
    toolType: "save_caller_info",
    description: "Deprecated — prefer save_collected_fields with fields:[{field_id,value}].",
    body: {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: { field_id: { type: "string" }, value: { type: "string" } },
          },
        },
      },
    },
  },
  create_crm_note: {
    name: "create_crm_note",
    toolType: "create_crm_note",
    description:
      "Create a CRM note on the matched contact. Wait for success before telling the caller it was saved.",
    body: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
      required: ["body"],
    },
  },
  create_crm_task: {
    name: "create_crm_task",
    toolType: "create_crm_task",
    description:
      "Create a CRM follow-up task. Wait for success before confirming to the caller.",
    body: {
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        dueAt: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
      required: ["title"],
    },
  },
  upsert_crm_contact: {
    name: "upsert_crm_contact",
    toolType: "upsert_crm_contact",
    description: "Create or update a CRM contact with confirmed caller details.",
    body: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
      },
      required: ["phone"],
    },
  },
  escalate_human: {
    name: "escalate_human",
    toolType: "escalate_human",
    description:
      "Transfer the caller to a named human phone destination (default Agent Handoff). Call once. If ok=true, say you are connecting them and stay silent — do not claim failure while ringing. Never invent a phone number.",
    body: {
      type: "object",
      properties: {
        target_name: {
          type: "string",
          description: "Named transfer target, default Agent Handoff",
        },
        reason: { type: "string" },
        summary: { type: "string" },
      },
      required: ["reason"],
    },
  },
  sip_refer: {
    name: "sip_refer",
    toolType: "sip_refer",
    description:
      "Transfer the call with SIP REFER to a configured SIP URI destination. Only use when a SIP destination exists.",
    body: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Named target or sip: URI" },
        reason: { type: "string" },
      },
      required: ["destination"],
    },
  },
};
