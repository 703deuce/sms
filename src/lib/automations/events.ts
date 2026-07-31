import { enrollForTrigger } from "./enroll";

/** Fire automation triggers for application events. */
export async function emitAutomationEvent(
  workspaceId: string,
  event: string,
  contactId: string,
  payload?: Record<string, unknown>,
) {
  const eventToTrigger: Record<string, string> = {
    "customer.created": "customer_added",
    "contact.created": "customer_added",
    "form.submitted": "form_submitted",
    "tag.added": "tag_added",
  };

  const triggerType = eventToTrigger[event];
  if (!triggerType) return [];

  if (triggerType === "tag_added" && payload?.tag) {
    // Future: match tag-specific triggers
  }

  return enrollForTrigger(workspaceId, triggerType, contactId);
}
