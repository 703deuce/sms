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
  "save_caller_info",
  "update_contact_tags",
  "lookup_customer",
  "search_crm_contacts",
  "create_crm_note",
  "create_crm_task",
  "upsert_crm_contact",
  "calendar_availability",
  "book_appointment",
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
    "calendar_availability",
    "book_appointment",
    "end_call",
  ],
  appointment_booking: [
    "hangup",
    "transfer",
    "escalate_human",
    "send_sms",
    "lookup_customer",
    "take_structured_message",
    "save_caller_info",
    "create_task",
    "mark_disposition",
    "calendar_availability",
    "book_appointment",
    "reschedule_appointment",
    "cancel_appointment",
    "end_call",
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
  calendar_availability: {
    name: "calendar_availability",
    toolType: "calendar_availability",
    description: "Check live calendar availability before offering times.",
    body: {
      type: "object",
      properties: {
        serviceId: { type: "string" },
        serviceName: { type: "string", description: "Appointment type / service name" },
        service: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        daysAhead: { type: "number" },
      },
      required: [],
    },
  },
  book_appointment: {
    name: "book_appointment",
    toolType: "book_appointment",
    description:
      "Book an appointment. NEVER tell the caller they are booked until this returns success.",
    body: {
      type: "object",
      properties: {
        startAt: { type: "string", description: "ISO start time (alias: startsAt)" },
        startsAt: { type: "string" },
        startTime: { type: "string" },
        serviceId: { type: "string" },
        serviceName: { type: "string", description: "Appointment type name" },
        service: { type: "string" },
        staffId: { type: "string" },
        customerName: { type: "string" },
        name: { type: "string" },
        full_name: { type: "string" },
        customerPhone: { type: "string" },
        phone: { type: "string" },
        customerEmail: { type: "string" },
        email: { type: "string" },
      },
      required: ["startAt", "customerPhone"],
    },
  },
  reschedule_appointment: {
    name: "reschedule_appointment",
    toolType: "reschedule_appointment",
    description: "Reschedule an existing appointment.",
    body: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        newStartAt: { type: "string" },
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
  save_caller_info: {
    name: "save_caller_info",
    toolType: "save_caller_info",
    description: "Save the caller’s name, phone, email, and company locally and in CRM when connected.",
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
