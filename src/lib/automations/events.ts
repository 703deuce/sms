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
  "popup.submitted": "popup_submitted",
  "message.received": "message_received",
  "customer.field_changed": "customer_field_changed",
  "link.clicked": "general_link_clicked",
  "list.member_added": "customer_added_to_list",
  "list.member_removed": "customer_removed_from_list",
  "inbox.status_changed": "inbox_conversation_status_changed",
  "inbox.tagged": "inbox_conversation_tagged",
  "inbox.untagged": "inbox_conversation_untagged",
  "inbox.assigned": "inbox_conversation_assigned",
  "inbox.unassigned": "inbox_conversation_unassigned",
  "contact.birthday": "contact_birthday",
  "call.created": "inbound_call",
  "call.ringing": "inbound_call",
  "call.answered": "call_answered",
  "call.completed": "call_completed",
  "call.failed": "call_failed",
  "call.missed": "call_missed",
  "call.voicemail_detected": "call_voicemail_detected",
  "call.transferred": "call_transferred",
  "call.transfer_failed": "call_transfer_failed",
  "call.recording_ready": "call_recording_ready",
  "call.transcription_completed": "call_transcription_completed",
  "call.qualified": "call_qualified",
  "call.unqualified": "call_unqualified",
  "call.appointment_booked": "call_appointment_booked",
  "call.follow_up_required": "call_follow_up_required",
  "call.opt_out_requested": "call_opt_out_requested",
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
      sourceType: typeof payload.sourceType === "string" ? payload.sourceType : undefined,
    });
  }

  if (triggerType === "popup_submitted") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      popupId: typeof payload?.popupId === "string" ? payload.popupId : undefined,
      sourceType: "popup",
      formSlug: typeof payload?.formSlug === "string" ? payload.formSlug : undefined,
    });
  }

  if (triggerType === "message_received") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      body: typeof payload?.body === "string" ? payload.body : undefined,
      fromE164: typeof payload?.from === "string" ? payload.from : undefined,
      toE164: typeof payload?.to === "string" ? payload.to : undefined,
      phoneNumberId:
        typeof payload?.phoneNumberId === "string" ? payload.phoneNumberId : undefined,
      messageId: typeof payload?.messageId === "string" ? payload.messageId : undefined,
    });
  }

  if (triggerType === "customer_field_changed") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      field: typeof payload?.field === "string" ? payload.field : undefined,
      previousValue:
        payload?.previousValue != null ? String(payload.previousValue) : undefined,
      newValue: payload?.newValue != null ? String(payload.newValue) : undefined,
    });
  }

  if (triggerType === "general_link_clicked") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      trackingToken:
        typeof payload?.trackingToken === "string" ? payload.trackingToken : undefined,
      messageId: typeof payload?.messageId === "string" ? payload.messageId : undefined,
      destinationUrl:
        typeof payload?.destinationUrl === "string" ? payload.destinationUrl : undefined,
    });
  }

  if (triggerType === "customer_added_to_list" || triggerType === "customer_removed_from_list") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      listId: typeof payload?.listId === "string" ? payload.listId : undefined,
    });
  }

  if (triggerType === "inbox_conversation_status_changed") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      conversationId:
        typeof payload?.conversationId === "string" ? payload.conversationId : undefined,
      fromStatus: typeof payload?.fromStatus === "string" ? payload.fromStatus : undefined,
      toStatus: typeof payload?.toStatus === "string" ? payload.toStatus : undefined,
    });
  }

  if (triggerType === "inbox_conversation_tagged" || triggerType === "inbox_conversation_untagged") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      conversationId:
        typeof payload?.conversationId === "string" ? payload.conversationId : undefined,
      tag: typeof payload?.tag === "string" ? payload.tag : undefined,
    });
  }

  if (triggerType === "inbox_conversation_assigned") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      conversationId:
        typeof payload?.conversationId === "string" ? payload.conversationId : undefined,
      assigneeId: typeof payload?.assigneeId === "string" ? payload.assigneeId : undefined,
      previousAssigneeId:
        typeof payload?.previousAssigneeId === "string"
          ? payload.previousAssigneeId
          : undefined,
    });
  }

  if (triggerType === "inbox_conversation_unassigned") {
    return enrollForTrigger(workspaceId, triggerType, contactId, {
      conversationId:
        typeof payload?.conversationId === "string" ? payload.conversationId : undefined,
      previousAssigneeId:
        typeof payload?.previousAssigneeId === "string"
          ? payload.previousAssigneeId
          : undefined,
    });
  }

  return enrollForTrigger(workspaceId, triggerType, contactId, {
    phoneNumberId:
      typeof payload?.phoneNumberId === "string"
        ? payload.phoneNumberId
        : undefined,
    callId: typeof payload?.callId === "string" ? payload.callId : undefined,
  });
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
