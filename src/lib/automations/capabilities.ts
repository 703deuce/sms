/**
 * Account capabilities for automation block availability.
 */
export type AutomationCapabilities = {
  sms: boolean;
  email: boolean;
  webhooks: boolean;
  automations: boolean;
  scheduledTriggers: boolean;
};

export function getAutomationCapabilities(): AutomationCapabilities {
  const email = Boolean(process.env.BREVO_API_KEY?.trim());
  const paused =
    process.env.MESSAGING_OUTBOUND_PAUSED === "1" ||
    process.env.MESSAGING_OUTBOUND_PAUSED === "true";

  return {
    sms: !paused,
    email: email && !paused,
    webhooks: true,
    automations: true,
    scheduledTriggers: true,
  };
}

export function isBlockEnabledForAccount(blockType: string, caps: AutomationCapabilities): boolean {
  if (blockType === "send_email") return caps.email;
  if (blockType === "send_sms" || blockType === "send_review_request") return caps.sms;
  if (blockType === "scheduled_datetime") return caps.scheduledTriggers;
  if (blockType === "send_webhook") return caps.webhooks;
  return true;
}
