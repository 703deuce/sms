import { enrollForTrigger, enrollInAutomation } from "./enroll";
import { parseAutomationDefinition, findTriggerNode } from "./types";
import { getPrisma } from "@/lib/db";

const EVENT_TO_TRIGGER: Record<string, string> = {
  "customer.created": "customer_added",
  "contact.created": "customer_added",
  "review_request.created": "review_request_created",
  "review_request.sent": "review_request_sent",
  "review_request.clicked": "review_request_clicked",
  "review.received": "review_received",
  "review.positive": "positive_review_received",
  "feedback.negative": "negative_feedback_received",
  "customer.no_response": "customer_no_response",
  "customer.tag_added": "tag_added",
  "form.submitted": "form_submitted",
};

/** Fire automation triggers for application events. */
export async function emitAutomationEvent(
  workspaceId: string,
  event: string,
  contactId: string,
  payload?: Record<string, unknown>,
) {
  const triggerType = EVENT_TO_TRIGGER[event];
  if (!triggerType) return [];

  if (triggerType === "tag_added" && payload?.tag) {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      tag: String(payload.tag),
    });
  }

  if (triggerType === "form_submitted" && payload?.formSlug) {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      formSlug: String(payload.formSlug),
    });
  }

  return enrollForTrigger(workspaceId, triggerType, contactId);
}

/** Manual enroll API helper. */
export async function enrollContactManually(
  workspaceId: string,
  flowId: string,
  contactId: string,
  testMode = false,
) {
  const flow = await getPrisma().automationFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow) throw new Error("Automation not found");

  const def = parseAutomationDefinition(flow.publishedDefinition ?? flow.definition);
  const trigger = findTriggerNode(def);
  if (trigger?.data.blockType !== "manual_enrollment" && !testMode) {
    // Allow manual enroll even if trigger is customer_added when explicitly requested
  }

  return enrollInAutomation({ workspaceId, flowId, contactId, testMode });
}
