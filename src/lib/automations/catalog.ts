/**
 * Automation block catalog for sidebar and node creation.
 */
import { getAutomationCapabilities, isBlockEnabledForAccount } from "./capabilities";

export type BlockDefinition = {
  blockType: string;
  category: "trigger" | "action" | "logic" | "end" | "integrations";
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  defaultConfig: Record<string, unknown>;
  /** When set, also listed under Integrations sidebar group. */
  integrationGroup?: "crm" | "calendly" | "other";
};

const caps = getAutomationCapabilities();

function block(
  partial: Omit<BlockDefinition, "enabled"> & { enabled?: boolean },
): BlockDefinition {
  const enabled =
    partial.enabled ?? isBlockEnabledForAccount(partial.blockType, caps);
  return { ...partial, enabled };
}

export const AUTOMATION_BLOCKS: BlockDefinition[] = [
  // —— Triggers ——
  block({
    blockType: "customer_added",
    category: "trigger",
    label: "Customer added",
    description: "When a new contact is created",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "review_request_created",
    category: "trigger",
    label: "Review request created",
    description: "When a review request step is queued for a customer",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "review_request_sent",
    category: "trigger",
    label: "Review request sent",
    description: "When a review request SMS is successfully sent",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "review_request_clicked",
    category: "trigger",
    label: "Review link clicked",
    description: "When the customer clicks the review tracking link",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "review_received",
    category: "trigger",
    label: "Review received",
    description: "When a review is recorded for the customer",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "positive_review_received",
    category: "trigger",
    label: "Positive review received",
    description: "When a positive review is received",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "negative_feedback_received",
    category: "trigger",
    label: "Negative feedback received",
    description: "When negative feedback is received",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "customer_no_response",
    category: "trigger",
    label: "Customer has not responded",
    description: "When no reply is detected after a wait period",
    icon: "zap",
    defaultConfig: { withinHours: 48 },
  }),
  block({
    blockType: "manual_enrollment",
    category: "trigger",
    label: "Manual enrollment",
    description: "Enroll via test run or manual action",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "scheduled_datetime",
    category: "trigger",
    label: "Scheduled date/time",
    description: "Run once at a scheduled date and time",
    icon: "zap",
    defaultConfig: { runAt: "", enrollScope: "all_subscribed" },
  }),
  block({
    blockType: "tag_added",
    category: "trigger",
    label: "Tag added",
    description: "When a specific tag is applied to a contact",
    icon: "zap",
    defaultConfig: { tag: "" },
  }),
  block({
    blockType: "form_submitted",
    category: "trigger",
    label: "Form submitted",
    description: "When an opt-in form is submitted",
    icon: "zap",
    defaultConfig: { formSlug: "" },
  }),
  block({
    blockType: "call_completed",
    category: "trigger",
    label: "Call completed",
    description: "When a voice call completes",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "call_missed",
    category: "trigger",
    label: "Missed call",
    description: "When a call is missed, busy, cancelled, or unanswered",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "call_qualified",
    category: "trigger",
    label: "Call qualified",
    description: "When a caller is scored as a qualified lead",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "call_voicemail_detected",
    category: "trigger",
    label: "Voicemail detected",
    description: "When outbound AMD detects voicemail",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "call_appointment_booked",
    category: "trigger",
    label: "Appointment booked",
    description: "When an appointment is booked on a call",
    icon: "zap",
    defaultConfig: {},
  }),
  block({
    blockType: "call_transferred",
    category: "trigger",
    label: "Call transferred",
    description: "When a call is transferred to a person or queue",
    icon: "zap",
    defaultConfig: {},
  }),
  // —— Connected app / CRM / Calendly triggers (also under Integrations) ——
  // NOTE: every CRM-labeled event in INTEGRATION_EVENT_TO_TRIGGER must have a
  // matching block here so the Integrations sidebar can expose it.
  ...(
    [
      // Contacts
      ["integration_contact_created", "CRM contact created", "Salesforce / Zoho / Pipedrive contact created", { provider: "" }, "crm"],
      ["integration_contact_updated", "CRM contact updated", "Contact updated in connected CRM", { provider: "" }, "crm"],
      ["integration_contact_deleted", "CRM contact deleted", "Contact deleted in connected CRM", { provider: "" }, "crm"],
      ["integration_contact_owner_changed", "CRM contact owner changed", "Contact owner/assignee changed", { provider: "", owner: "" }, "crm"],
      ["integration_contact_status_changed", "CRM contact status changed", "Contact status/stage changed", { provider: "", status: "" }, "crm"],
      ["integration_contact_phone_changed", "CRM contact phone changed", "Contact phone number changed", { provider: "", requirePhone: true }, "crm"],
      ["integration_contact_email_changed", "CRM contact email changed", "Contact email address changed", { provider: "", requireEmail: true }, "crm"],
      ["integration_contact_custom_field_changed", "CRM contact field changed", "A mapped contact custom field changed", { provider: "", changedField: "" }, "crm"],
      // Leads
      ["integration_lead_created", "CRM lead created", "Salesforce / Zoho lead created", { provider: "" }, "crm"],
      ["integration_lead_updated", "CRM lead updated", "Lead updated in connected CRM", { provider: "" }, "crm"],
      ["integration_lead_assigned", "CRM lead assigned", "Lead assigned to an owner", { provider: "", owner: "" }, "crm"],
      ["integration_lead_status_changed", "CRM lead status changed", "Lead status changed", { provider: "", status: "" }, "crm"],
      ["integration_lead_source_changed", "CRM lead source changed", "Lead source changed", { provider: "", source: "" }, "crm"],
      ["integration_lead_converted", "CRM lead converted", "Lead converted to contact/deal", { provider: "" }, "crm"],
      ["integration_lead_deleted", "CRM lead deleted", "Lead deleted in connected CRM", { provider: "" }, "crm"],
      ["integration_lead_custom_field_changed", "CRM lead field changed", "A mapped lead custom field changed", { provider: "", changedField: "" }, "crm"],
      // Companies
      ["integration_company_created", "CRM company created", "Company/account created in connected CRM", { provider: "" }, "crm"],
      ["integration_company_updated", "CRM company updated", "Company/account updated in connected CRM", { provider: "" }, "crm"],
      ["integration_company_owner_changed", "CRM company owner changed", "Company/account owner changed", { provider: "", owner: "" }, "crm"],
      ["integration_company_status_changed", "CRM company status changed", "Company/account status changed", { provider: "", status: "" }, "crm"],
      ["integration_company_deleted", "CRM company deleted", "Company/account deleted in connected CRM", { provider: "" }, "crm"],
      ["integration_company_custom_field_changed", "CRM company field changed", "A mapped company custom field changed", { provider: "", changedField: "" }, "crm"],
      // Deals / opportunities
      ["integration_deal_created", "CRM deal created", "Deal/opportunity created in connected CRM", { provider: "" }, "crm"],
      ["integration_deal_updated", "CRM deal updated", "Deal/opportunity updated in connected CRM", { provider: "" }, "crm"],
      ["integration_deal_stage_changed", "CRM deal stage changed", "Deal/opportunity stage changed", { provider: "", stage: "", previousStage: "" }, "crm"],
      ["integration_deal_pipeline_changed", "CRM deal pipeline changed", "Deal/opportunity moved to another pipeline", { provider: "", pipeline: "" }, "crm"],
      ["integration_deal_owner_changed", "CRM deal owner changed", "Deal/opportunity owner changed", { provider: "", owner: "" }, "crm"],
      ["integration_deal_value_changed", "CRM deal value changed", "Deal/opportunity amount changed", { provider: "" }, "crm"],
      ["integration_deal_won", "CRM deal won", "Deal/opportunity marked won", { provider: "" }, "crm"],
      ["integration_deal_lost", "CRM deal lost", "Deal/opportunity marked lost", { provider: "" }, "crm"],
      ["integration_deal_reopened", "CRM deal reopened", "Closed deal/opportunity reopened", { provider: "" }, "crm"],
      ["integration_deal_deleted", "CRM deal deleted", "Deal/opportunity deleted in connected CRM", { provider: "" }, "crm"],
      ["integration_deal_custom_field_changed", "CRM deal field changed", "A mapped deal custom field changed", { provider: "", changedField: "" }, "crm"],
      // Tasks
      ["integration_task_created", "CRM task created", "Task created in connected CRM", { provider: "" }, "crm"],
      ["integration_task_updated", "CRM task updated", "Task updated in connected CRM", { provider: "" }, "crm"],
      ["integration_task_assigned", "CRM task assigned", "Task assigned to an owner", { provider: "", owner: "" }, "crm"],
      ["integration_task_completed", "CRM task completed", "Task completed in connected CRM", { provider: "" }, "crm"],
      ["integration_task_due", "CRM task due", "Reminder fired before a task's due time", { provider: "", minutesBefore: 60 }, "crm"],
      ["integration_task_overdue", "CRM task overdue", "Task passed its due date without completion", { provider: "" }, "crm"],
      // Activities / notes / calls
      ["integration_activity_created", "CRM activity created", "Activity logged in connected CRM", { provider: "" }, "crm"],
      ["integration_activity_updated", "CRM activity updated", "Activity updated in connected CRM", { provider: "" }, "crm"],
      ["integration_note_created", "CRM note created", "Note added in connected CRM", { provider: "" }, "crm"],
      ["integration_call_activity_created", "CRM call logged", "Call activity created in connected CRM", { provider: "" }, "crm"],
      // Calendly
      ["integration_appointment_scheduled", "Calendly booking created", "Calendly appointment booked", { provider: "calendly", eventTypeName: "" }, "calendly"],
      ["integration_appointment_canceled", "Calendly booking canceled", "Calendly appointment canceled", { provider: "calendly" }, "calendly"],
      ["integration_appointment_rescheduled", "Calendly booking rescheduled", "Calendly appointment rescheduled", { provider: "calendly" }, "calendly"],
      ["integration_appointment_starting_soon", "Calendly appointment starting soon", "Scheduled reminder before appointment start", { provider: "calendly", minutesBefore: 60 }, "calendly"],
      ["integration_appointment_completed", "Calendly appointment completed", "Appointment end time passed", { provider: "calendly" }, "calendly"],
      ["integration_appointment_no_show", "Calendly invitee no-show", "Invitee marked as a no-show", { provider: "calendly" }, "calendly"],
      ["integration_event_type_created", "Calendly event type created", "New Calendly event type detected", { provider: "calendly", eventTypeName: "" }, "calendly"],
      ["integration_event_type_updated", "Calendly event type updated", "Calendly event type changed", { provider: "calendly", eventTypeName: "" }, "calendly"],
      ["integration_event_type_activated", "Calendly event type activated", "Calendly event type turned active", { provider: "calendly", eventTypeName: "" }, "calendly"],
      ["integration_event_type_deactivated", "Calendly event type deactivated", "Calendly event type turned inactive", { provider: "calendly", eventTypeName: "" }, "calendly"],
      ["integration_form_submitted", "Form submitted (app)", "Typeform/Jotform submission", { provider: "", formSlug: "" }, "other"],
      ["integration_tag_added", "Tag added (app)", "Tag added in connected marketing/CRM", { provider: "", tag: "" }, "other"],
      ["integration_tag_removed", "Tag removed (app)", "Tag removed in connected app", { provider: "", tag: "" }, "other"],
      ["integration_list_joined", "List joined (app)", "Joined Mailchimp/Klaviyo/AC list", { provider: "" }, "other"],
      ["integration_order_created", "Order created", "WooCommerce order created", { provider: "woocommerce" }, "other"],
      ["integration_order_paid", "Order paid", "WooCommerce order paid", { provider: "woocommerce" }, "other"],
      ["integration_order_updated", "Order status changed", "WooCommerce order status changed", { provider: "woocommerce", orderStatus: "" }, "other"],
      ["integration_order_completed", "Order completed", "WooCommerce order fulfilled", { provider: "woocommerce" }, "other"],
      ["integration_ticket_created", "Ticket created", "Freshdesk ticket created", { provider: "freshdesk" }, "other"],
      ["integration_ticket_updated", "Ticket updated", "Freshdesk ticket updated", { provider: "freshdesk" }, "other"],
      ["integration_ticket_resolved", "Ticket resolved", "Freshdesk ticket solved/closed", { provider: "freshdesk" }, "other"],
      ["integration_consent_changed", "Consent changed", "Mailchimp/Klaviyo consent change", { provider: "" }, "other"],
    ] as Array<[string, string, string, Record<string, unknown>, "crm" | "calendly" | "other"]>
  ).map(([blockType, label, description, defaultConfig, integrationGroup]) =>
    block({
      blockType,
      category: "trigger",
      label,
      description,
      icon: "zap",
      defaultConfig,
      integrationGroup,
    }),
  ),

  // —— Actions ——
  block({
    blockType: "send_review_request",
    category: "action",
    label: "Send review request",
    description: "SMS with review link",
    icon: "message",
    defaultConfig: {
      body: "Hi {{customer.firstName}}, we'd love your feedback! {{reviewLink}}",
      stopOnReply: true,
    },
  }),
  block({
    blockType: "send_sms",
    category: "action",
    label: "Send SMS",
    description: "Send a text message",
    icon: "message",
    defaultConfig: {
      body: "Hi {{customer.firstName}}, thanks for connecting with {{business.name}}!",
      stopOnReply: false,
    },
  }),
  block({
    blockType: "send_email",
    category: "action",
    label: "Send email",
    description: "Send an email to the customer",
    icon: "mail",
    defaultConfig: {
      subject: "Message from {{business.name}}",
      body: "Hi {{customer.firstName}},",
      fromName: "",
      replyTo: "",
    },
  }),
  block({
    blockType: "send_internal_notification",
    category: "action",
    label: "Send internal notification",
    description: "Log an in-app notification for your team",
    icon: "bell",
    defaultConfig: { message: "Automation notification for {{customer.firstName}}" },
  }),
  block({
    blockType: "add_tag",
    category: "action",
    label: "Add tag",
    description: "Add a tag to the customer",
    icon: "tag",
    defaultConfig: { tag: "" },
  }),
  block({
    blockType: "remove_tag",
    category: "action",
    label: "Remove tag",
    description: "Remove a tag from the customer",
    icon: "tag",
    defaultConfig: { tag: "" },
  }),
  block({
    blockType: "update_customer",
    category: "action",
    label: "Update customer",
    description: "Update contact fields",
    icon: "user",
    defaultConfig: { field: "company", value: "" },
  }),
  block({
    blockType: "create_task",
    category: "action",
    label: "Create task",
    description: "Create an internal follow-up task",
    icon: "check",
    defaultConfig: { title: "Follow up with {{customer.firstName}}", dueInDays: 1 },
  }),
  block({
    blockType: "enroll_in_automation",
    category: "action",
    label: "Add to automation",
    description: "Enroll customer in another automation",
    icon: "workflow",
    defaultConfig: { flowId: "" },
  }),
  block({
    blockType: "start_automation",
    category: "action",
    label: "Start automation",
    description: "Start another AutomationFlow with variables from this run",
    icon: "workflow",
    defaultConfig: { automationId: "", variablesJson: "{}" },
  }),
  block({
    blockType: "remove_from_automation",
    category: "action",
    label: "Remove from automation",
    description: "Cancel active runs in another automation",
    icon: "workflow",
    defaultConfig: { flowId: "" },
  }),
  block({
    blockType: "start_ai_call",
    category: "action",
    label: "Start AI call",
    description: "Place an outbound AI voice call using a selected agent",
    icon: "phone",
    defaultConfig: {
      agentId: "",
      purpose: "",
      callerId: "",
      timeoutSeconds: 60,
      retryCount: 0,
      contextJson: "{}",
    },
  }),
  block({
    blockType: "wait_for_call_result",
    category: "logic",
    label: "Wait for call result",
    description: "Pause until the AI/human call completes, then branch on outcome",
    icon: "clock",
    defaultConfig: {
      timeoutMinutes: 30,
      branchField: "outcome",
    },
  }),
  block({
    blockType: "use_ai_agent",
    category: "action",
    label: "Use AI agent",
    description: "Invoke a non-call AI agent action (future)",
    icon: "sparkles",
    defaultConfig: { agentId: "", purpose: "" },
  }),
  block({
    blockType: "send_webhook",
    category: "action",
    label: "Send webhook",
    description: "POST JSON to an external URL",
    icon: "webhook",
    defaultConfig: { url: "", method: "POST" },
  }),
  block({
    blockType: "integration_action",
    category: "action",
    label: "CRM / connected app action",
    description:
      "Run a typed action on Salesforce, Zoho, Pipedrive, Calendly, or another connected app",
    icon: "cloud",
    defaultConfig: {
      provider: "",
      actionId: "contact.upsert",
      paramsJson: "{}",
    },
    integrationGroup: "crm",
  }),
  block({
    blockType: "end_automation",
    category: "end",
    label: "End automation",
    description: "Stop the workflow for this customer",
    icon: "square",
    defaultConfig: {},
  }),

  // —— Logic ——
  block({
    blockType: "wait",
    category: "logic",
    label: "Wait for duration",
    description: "Pause for minutes, hours, days, or weeks",
    icon: "clock",
    defaultConfig: { days: 0, hours: 0, minutes: 1, weeks: 0, respectBusinessHours: false },
  }),
  block({
    blockType: "wait_until_datetime",
    category: "logic",
    label: "Wait until date/time",
    description: "Pause until a specific date and time",
    icon: "clock",
    defaultConfig: { runAt: "", timeOfDay: "09:00", respectBusinessHours: true },
  }),
  block({
    blockType: "condition",
    category: "logic",
    label: "Condition",
    description: "Branch on customer data or activity",
    icon: "branch",
    defaultConfig: { field: "review_received", operator: "equals", value: "true" },
  }),
  block({
    blockType: "condition_customer_field",
    category: "logic",
    label: "Customer field check",
    description: "Branch based on a contact field",
    icon: "branch",
    defaultConfig: { field: "company", operator: "exists", value: "" },
  }),
  block({
    blockType: "condition_review_status",
    category: "logic",
    label: "Review status check",
    description: "Branch on review received state",
    icon: "branch",
    defaultConfig: { field: "review_received", operator: "equals", value: "true" },
  }),
  block({
    blockType: "condition_message_status",
    category: "logic",
    label: "Message status check",
    description: "Branch on delivery or click status",
    icon: "branch",
    defaultConfig: { field: "message_delivered", operator: "equals", value: "true" },
  }),
  block({
    blockType: "condition_tag",
    category: "logic",
    label: "Tag check",
    description: "Branch if customer has a tag",
    icon: "branch",
    defaultConfig: { field: "tag_has", operator: "equals", value: "", tag: "" },
  }),
  block({
    blockType: "condition_has_responded",
    category: "logic",
    label: "Has responded check",
    description: "Branch if customer replied",
    icon: "branch",
    defaultConfig: { field: "customer_replied", operator: "equals", value: "true" },
  }),
];

export const MERGE_VARIABLES = [
  { key: "{{customer.firstName}}", label: "First name" },
  { key: "{{customer.lastName}}", label: "Last name" },
  { key: "{{customer.email}}", label: "Email" },
  { key: "{{customer.phone}}", label: "Phone" },
  { key: "{{business.name}}", label: "Business name" },
  { key: "{{reviewLink}}", label: "Review link" },
];

export const CONDITION_FIELDS = [
  { value: "review_received", label: "Review received" },
  { value: "positive_review", label: "Positive review" },
  { value: "negative_feedback", label: "Negative feedback" },
  { value: "customer_replied", label: "Customer replied" },
  { value: "no_response", label: "No response" },
  { value: "link_clicked", label: "Link clicked" },
  { value: "message_delivered", label: "Message delivered" },
  { value: "tag_has", label: "Has tag" },
  { value: "customer_field", label: "Custom field" },
];

export const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Does not exist" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
];

/**
 * Client-safe catalog of `integration_action` operations for the builder config
 * panel. Mirrors CRM_AUTOMATION_ACTIONS (Salesforce/Zoho/Pipedrive) plus the
 * external INTEGRATION_ACTIONS registry — declared here so the UI never imports
 * server-only modules (Prisma, connectors) into the client bundle.
 */
export type IntegrationActionOption = {
  id: string;
  label: string;
  providers: string[];
  samplePayload: Record<string, unknown>;
};

export const INTEGRATION_ACTION_OPTIONS: IntegrationActionOption[] = [
  {
    id: "contact.upsert",
    label: "Create / update contact",
    providers: [
      "salesforce",
      "zoho",
      "pipedrive",
      "activecampaign",
      "mailchimp",
      "highlevel",
      "close",
      "freshdesk",
      "klaviyo",
      "woocommerce",
    ],
    samplePayload: {
      firstName: "{{customer.firstName}}",
      lastName: "{{customer.lastName}}",
      email: "{{customer.email}}",
      phone: "{{customer.phone}}",
      company: "",
    },
  },
  {
    id: "lead.upsert",
    label: "Create / update CRM lead",
    providers: ["salesforce", "zoho"],
    samplePayload: {
      firstName: "{{customer.firstName}}",
      lastName: "{{customer.lastName}}",
      email: "{{customer.email}}",
      phone: "{{customer.phone}}",
      status: "New",
      source: "Transovo",
    },
  },
  {
    id: "deal.upsert",
    label: "Create / update deal / opportunity",
    providers: ["salesforce", "zoho", "pipedrive", "activecampaign", "highlevel", "close"],
    samplePayload: { title: "New opportunity", value: 0, stage: "", pipeline: "" },
  },
  {
    id: "task.create",
    label: "Create task",
    providers: ["salesforce", "zoho", "pipedrive", "highlevel", "close"],
    samplePayload: { title: "Follow up with {{customer.firstName}}", description: "", dueAt: "" },
  },
  {
    id: "note.create",
    label: "Add note",
    providers: ["salesforce", "zoho", "pipedrive", "activecampaign", "highlevel", "close"],
    samplePayload: { body: "Logged from Transovo automation" },
  },
  {
    id: "call.log",
    label: "Log call activity",
    providers: ["salesforce", "zoho", "pipedrive"],
    samplePayload: {
      direction: "outbound",
      disposition: "connected",
      durationSeconds: 0,
      recordingUrl: "",
      notes: "",
    },
  },
  {
    id: "sms.log",
    label: "Log SMS activity",
    providers: ["salesforce", "zoho", "pipedrive"],
    samplePayload: { direction: "outbound", body: "" },
  },
  {
    id: "contact.add_tag",
    label: "Add tag",
    providers: ["activecampaign", "mailchimp", "highlevel"],
    samplePayload: { externalContactId: "", tag: "Hot Lead" },
  },
  {
    id: "contact.remove_tag",
    label: "Remove tag",
    providers: ["activecampaign", "mailchimp", "highlevel"],
    samplePayload: { externalContactId: "", tag: "Hot Lead" },
  },
  {
    id: "contact.add_to_list",
    label: "Add to list / audience",
    providers: ["activecampaign", "mailchimp", "klaviyo"],
    samplePayload: { externalContactId: "", listId: "" },
  },
  {
    id: "ticket.create",
    label: "Create support ticket",
    providers: ["freshdesk"],
    samplePayload: { subject: "New request", requesterEmail: "{{customer.email}}", priority: "medium" },
  },
  {
    id: "ticket.add_private_note",
    label: "Add private ticket note",
    providers: ["freshdesk"],
    samplePayload: { ticketId: "", body: "Internal note" },
  },
  {
    id: "order.add_note",
    label: "Add order note",
    providers: ["woocommerce"],
    samplePayload: { orderId: "", note: "Order note" },
  },
  // —— Calendly appointment actions ——
  // These run through job `integration_action` → executeIntegrationAction
  // (same path as AI supervised actions). Prefer API booking over browser UI.
  {
    id: "appointment.list_available_times",
    label: "List available appointment times",
    providers: ["calendly"],
    samplePayload: { eventTypeUri: "", startTime: "", endTime: "" },
  },
  {
    id: "appointment.book",
    label: "Book appointment (Scheduling API)",
    providers: ["calendly"],
    samplePayload: {
      name: "{{customer.firstName}} {{customer.lastName}}",
      email: "{{customer.email}}",
      startTime: "",
      eventTypeUri: "",
      timezone: "America/New_York",
      phone: "{{customer.phone}}",
    },
  },
  {
    id: "appointment.get_scheduling_link",
    label: "Get scheduling link",
    providers: ["calendly"],
    samplePayload: { eventTypeUri: "" },
  },
  {
    id: "appointment.create_single_use_link",
    label: "Create single-use scheduling link",
    providers: ["calendly"],
    samplePayload: { eventTypeUri: "", ownerUri: "" },
  },
  {
    id: "appointment.send_scheduling_link",
    label: "Send scheduling link (SMS)",
    providers: ["calendly"],
    samplePayload: {
      phone: "{{customer.phone}}",
      message: "Hi {{customer.firstName}}, book a time here: {{scheduling_link}}",
      eventTypeUri: "",
      singleUse: false,
    },
  },
  {
    id: "appointment.retrieve",
    label: "Retrieve appointment",
    providers: ["calendly"],
    samplePayload: { eventUri: "", eventUuid: "" },
  },
  {
    id: "appointment.cancel",
    label: "Cancel appointment",
    providers: ["calendly"],
    samplePayload: { eventUri: "", eventUuid: "", reason: "" },
  },
  {
    id: "appointment.get_cancel_url",
    label: "Get cancel URL",
    providers: ["calendly"],
    samplePayload: { eventUri: "", eventUuid: "" },
  },
  {
    id: "appointment.get_reschedule_url",
    label: "Get reschedule URL",
    providers: ["calendly"],
    samplePayload: { eventUri: "", eventUuid: "" },
  },
];

export function integrationActionsForProvider(provider: string): IntegrationActionOption[] {
  if (!provider) return INTEGRATION_ACTION_OPTIONS;
  return INTEGRATION_ACTION_OPTIONS.filter((a) => a.providers.includes(provider));
}

export function getBlock(blockType: string): BlockDefinition | undefined {
  return AUTOMATION_BLOCKS.find((b) => b.blockType === blockType);
}

export function blocksByCategory(category: BlockDefinition["category"]) {
  return AUTOMATION_BLOCKS.filter((b) => b.category === category);
}

export function triggerFromBlockType(blockType: string): string {
  const map: Record<string, string> = {
    customer_added: "Customer added",
    review_request_created: "Review request created",
    review_request_sent: "Review request sent",
    review_request_clicked: "Review link clicked",
    review_received: "Review received",
    positive_review_received: "Positive review received",
    negative_feedback_received: "Negative feedback received",
    customer_no_response: "Customer has not responded",
    manual_enrollment: "Manual enrollment",
    scheduled_datetime: "Scheduled",
    tag_added: "Tag added",
    form_submitted: "Form submitted",
    call_completed: "Call completed",
    call_missed: "Missed call",
    call_qualified: "Call qualified",
    call_voicemail_detected: "Voicemail detected",
    call_appointment_booked: "Appointment booked",
    call_transferred: "Call transferred",
  };
  return map[blockType] || blockType;
}

export function isConditionBlock(blockType: string): boolean {
  return blockType === "condition" || blockType.startsWith("condition_");
}
