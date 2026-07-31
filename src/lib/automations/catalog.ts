/**
 * Automation block catalog for sidebar and node creation.
 */

export type BlockDefinition = {
  blockType: string;
  category: "trigger" | "action" | "logic" | "end";
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  defaultConfig: Record<string, unknown>;
};

export const AUTOMATION_BLOCKS: BlockDefinition[] = [
  // Triggers
  {
    blockType: "customer_added",
    category: "trigger",
    label: "Customer added",
    description: "When a new contact is created in your account",
    icon: "zap",
    enabled: true,
    defaultConfig: {},
  },
  {
    blockType: "manual_enrollment",
    category: "trigger",
    label: "Manual enrollment",
    description: "Enroll contacts manually or via test run",
    icon: "zap",
    enabled: true,
    defaultConfig: {},
  },
  {
    blockType: "tag_added",
    category: "trigger",
    label: "Tag added",
    description: "When a tag is applied to a contact",
    icon: "zap",
    enabled: true,
    defaultConfig: { tag: "" },
  },
  {
    blockType: "form_submitted",
    category: "trigger",
    label: "Form submitted",
    description: "When an opt-in form is submitted",
    icon: "zap",
    enabled: true,
    defaultConfig: {},
  },
  {
    blockType: "scheduled_datetime",
    category: "trigger",
    label: "Scheduled date/time",
    description: "Run on a specific schedule",
    icon: "zap",
    enabled: false,
    defaultConfig: {},
  },
  // Actions
  {
    blockType: "send_review_request",
    category: "action",
    label: "Send review request",
    description: "Send an SMS asking the customer for a review",
    icon: "message",
    enabled: true,
    defaultConfig: {
      body: "Hi {{customer.firstName}}, we'd love your feedback! Leave a review here: {{reviewLink}}",
      stopOnReply: true,
    },
  },
  {
    blockType: "send_sms",
    category: "action",
    label: "Send SMS",
    description: "Send a text message to the customer",
    icon: "message",
    enabled: true,
    defaultConfig: {
      body: "Hi {{customer.firstName}}, thanks for connecting with {{business.name}}!",
      stopOnReply: false,
    },
  },
  {
    blockType: "send_email",
    category: "action",
    label: "Send email",
    description: "Send an email to the customer",
    icon: "mail",
    enabled: false,
    defaultConfig: {
      subject: "",
      body: "",
      fromName: "",
      replyTo: "",
    },
  },
  {
    blockType: "add_tag",
    category: "action",
    label: "Add tag",
    description: "Add a tag to the customer",
    icon: "tag",
    enabled: true,
    defaultConfig: { tag: "" },
  },
  {
    blockType: "remove_tag",
    category: "action",
    label: "Remove tag",
    description: "Remove a tag from the customer",
    icon: "tag",
    enabled: true,
    defaultConfig: { tag: "" },
  },
  {
    blockType: "send_webhook",
    category: "action",
    label: "Send webhook",
    description: "POST customer data to an external URL",
    icon: "webhook",
    enabled: true,
    defaultConfig: { url: "" },
  },
  {
    blockType: "end_automation",
    category: "end",
    label: "End automation",
    description: "Stop the workflow for this customer",
    icon: "square",
    enabled: true,
    defaultConfig: {},
  },
  // Logic
  {
    blockType: "wait",
    category: "logic",
    label: "Wait",
    description: "Pause for a duration before the next step",
    icon: "clock",
    enabled: true,
    defaultConfig: { days: 0, hours: 0, minutes: 1 },
  },
  {
    blockType: "condition",
    category: "logic",
    label: "Condition",
    description: "Branch based on customer data or activity",
    icon: "branch",
    enabled: true,
    defaultConfig: {
      field: "review_received",
      operator: "equals",
      value: "true",
    },
  },
];

export const MERGE_VARIABLES = [
  { key: "{{customer.firstName}}", label: "First name" },
  { key: "{{customer.lastName}}", label: "Last name" },
  { key: "{{customer.email}}", label: "Email" },
  { key: "{{customer.phone}}", label: "Phone" },
  { key: "{{business.name}}", label: "Business name" },
  { key: "{{reviewLink}}", label: "Review link" },
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
    manual_enrollment: "Manual enrollment",
    tag_added: "Tag added",
    form_submitted: "Form submitted",
    scheduled_datetime: "Scheduled",
  };
  return map[blockType] || blockType;
}
