/**
 * Optional CRM / Calendly starter automation templates.
 * Never auto-activate — users must create/edit from Templates UI.
 */

export type IntegrationAutomationTemplate = {
  id: string;
  title: string;
  description: string;
  group: "crm" | "calendly" | "voice_sms";
  triggerBlockType: string;
  providerHint?: string;
  suggestedActions: Array<{ blockType: string; label: string; config?: Record<string, unknown> }>;
};

export const INTEGRATION_AUTOMATION_TEMPLATES: IntegrationAutomationTemplate[] = [
  {
    id: "crm-lead-followup",
    title: "New CRM lead follow-up",
    description: "When a CRM lead/contact is created with a phone, SMS and create a CRM task.",
    group: "crm",
    triggerBlockType: "integration_lead_created",
    providerHint: "salesforce",
    suggestedActions: [
      { blockType: "send_sms", label: "Send SMS", config: { body: "Hi {{customer.firstName}}, thanks for reaching out — we'll be in touch shortly." } },
      {
        blockType: "integration_action",
        label: "Create CRM task",
        config: { provider: "salesforce", actionId: "task.create", paramsJson: '{"title":"Follow up with new lead"}' },
      },
    ],
  },
  {
    id: "missed-call-crm",
    title: "Missed-call CRM follow-up",
    description: "On missed call: SMS, log to CRM, create CRM task.",
    group: "voice_sms",
    triggerBlockType: "call_completed",
    suggestedActions: [
      { blockType: "send_sms", label: "Missed-call SMS", config: { body: "Sorry we missed your call — reply here and we'll get back to you." } },
      {
        blockType: "integration_action",
        label: "Log call in CRM",
        config: { provider: "salesforce", actionId: "call.log", paramsJson: '{"direction":"missed"}' },
      },
    ],
  },
  {
    id: "calendly-booking",
    title: "Calendly booking confirmation",
    description: "On Calendly booking: confirm SMS, upsert CRM contact, create CRM task.",
    group: "calendly",
    triggerBlockType: "integration_appointment_scheduled",
    providerHint: "calendly",
    suggestedActions: [
      { blockType: "send_sms", label: "Confirmation SMS", config: { body: "You're booked! Reply if you need to reschedule." } },
      {
        blockType: "integration_action",
        label: "Upsert CRM contact",
        config: { provider: "salesforce", actionId: "contact.upsert", paramsJson: "{}" },
      },
      {
        blockType: "integration_action",
        label: "Create CRM task",
        config: { provider: "salesforce", actionId: "task.create", paramsJson: '{"title":"Prepare for upcoming appointment"}' },
      },
    ],
  },
  {
    id: "calendly-cancel",
    title: "Calendly cancellation follow-up",
    description: "On booking cancel: acknowledge SMS and create CRM follow-up task.",
    group: "calendly",
    triggerBlockType: "integration_appointment_canceled",
    providerHint: "calendly",
    suggestedActions: [
      { blockType: "send_sms", label: "Cancellation SMS", config: { body: "Your appointment was canceled. Reply if you'd like to rebook." } },
      {
        blockType: "integration_action",
        label: "Create CRM task",
        config: { provider: "zoho", actionId: "task.create", paramsJson: '{"title":"Re-engage after canceled booking"}' },
      },
    ],
  },
  {
    id: "deal-won-thanks",
    title: "Deal won thank-you",
    description: "When a CRM deal is marked won: thank-you SMS and Transovo tag.",
    group: "crm",
    triggerBlockType: "integration_deal_won",
    suggestedActions: [
      { blockType: "send_sms", label: "Thank-you SMS", config: { body: "Thanks for choosing us, {{customer.firstName}}!" } },
      { blockType: "add_tag", label: "Add tag", config: { tag: "customer-won" } },
    ],
  },
  {
    id: "inbound-sms-crm",
    title: "New inbound SMS → CRM",
    description: "On customer reply: ensure CRM contact exists and log SMS.",
    group: "voice_sms",
    triggerBlockType: "customer_added",
    suggestedActions: [
      {
        blockType: "integration_action",
        label: "Upsert CRM contact",
        config: { provider: "pipedrive", actionId: "contact.upsert", paramsJson: "{}" },
      },
      {
        blockType: "integration_action",
        label: "Log SMS",
        config: { provider: "pipedrive", actionId: "sms.log", paramsJson: '{"direction":"inbound"}' },
      },
    ],
  },
];
