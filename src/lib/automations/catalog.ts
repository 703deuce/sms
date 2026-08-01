/**
 * Automation block catalog for sidebar and node creation.
 */
import { getAutomationCapabilities, isBlockEnabledForAccount } from "./capabilities";

export type BlockDefinition = {
  blockType: string;
  category: "trigger" | "action" | "logic" | "end";
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  defaultConfig: Record<string, unknown>;
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
  // —— Connected app triggers ——
  ...[
    ["integration_appointment_scheduled", "Appointment scheduled (app)", "Calendly/HighLevel appointment booked", { provider: "", eventTypeName: "" }],
    ["integration_appointment_canceled", "Appointment canceled (app)", "Integrated appointment canceled", { provider: "calendly" }],
    ["integration_appointment_rescheduled", "Appointment rescheduled (app)", "Integrated appointment rescheduled", { provider: "calendly" }],
    ["integration_form_submitted", "Form submitted (app)", "Typeform/Jotform submission", { provider: "", formSlug: "" }],
    ["integration_tag_added", "Tag added (app)", "Tag added in connected marketing/CRM", { provider: "", tag: "" }],
    ["integration_tag_removed", "Tag removed (app)", "Tag removed in connected app", { provider: "", tag: "" }],
    ["integration_list_joined", "List joined (app)", "Joined Mailchimp/Klaviyo/AC list", { provider: "" }],
    ["integration_order_created", "Order created", "WooCommerce order created", { provider: "woocommerce" }],
    ["integration_order_paid", "Order paid", "WooCommerce order paid", { provider: "woocommerce" }],
    ["integration_order_updated", "Order status changed", "WooCommerce order status changed", { provider: "woocommerce", orderStatus: "" }],
    ["integration_order_completed", "Order completed", "WooCommerce order fulfilled", { provider: "woocommerce" }],
    ["integration_deal_created", "Deal created (app)", "Deal/opportunity created", { provider: "" }],
    ["integration_deal_stage_changed", "Deal stage changed (app)", "Deal stage changed", { provider: "" }],
    ["integration_ticket_created", "Ticket created", "Freshdesk ticket created", { provider: "freshdesk" }],
    ["integration_ticket_updated", "Ticket updated", "Freshdesk ticket updated", { provider: "freshdesk" }],
    ["integration_ticket_resolved", "Ticket resolved", "Freshdesk ticket solved/closed", { provider: "freshdesk" }],
    ["integration_contact_created", "Contact created (app)", "Contact/profile created in connected app", { provider: "" }],
    ["integration_contact_updated", "Contact updated (app)", "Contact/profile updated in connected app", { provider: "" }],
    ["integration_task_created", "Task created (app)", "Close/HighLevel task created", { provider: "" }],
    ["integration_consent_changed", "Consent changed", "Mailchimp/Klaviyo consent change", { provider: "" }],
  ].map(([blockType, label, description, defaultConfig]) =>
    block({
      blockType: String(blockType),
      category: "trigger",
      label: String(label),
      description: String(description),
      icon: "zap",
      defaultConfig: defaultConfig as Record<string, unknown>,
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
    blockType: "remove_from_automation",
    category: "action",
    label: "Remove from automation",
    description: "Cancel active runs in another automation",
    icon: "workflow",
    defaultConfig: { flowId: "" },
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
    label: "Connected app action",
    description: "Run a typed action on a connected integration (tag, ticket, deal, note, …)",
    icon: "cloud",
    defaultConfig: {
      provider: "",
      actionId: "contact.upsert",
      paramsJson: "{}",
    },
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
  };
  return map[blockType] || blockType;
}

export function isConditionBlock(blockType: string): boolean {
  return blockType === "condition" || blockType.startsWith("condition_");
}
