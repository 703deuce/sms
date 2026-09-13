import type { SendResourceContext } from "./send-resource";

export function resolveSendResourceContext(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  body: Record<string, unknown>;
  callerE164?: string | null;
  calledE164?: string | null;
  conversationId?: string | null;
  callControlId?: string | null;
}): SendResourceContext {
  const args = input.body;
  const consentRaw =
    args.verbal_sms_consent ?? args.verbalSmsConsent ?? args.sms_consent;
  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    resourceType: String(args.resource_type || args.resourceType || ""),
    forceResend: Boolean(args.force_resend || args.resend),
    verbalSmsConsent:
      consentRaw === true || consentRaw === "true"
        ? true
        : consentRaw === false || consentRaw === "false"
          ? false
          : undefined,
    telnyxConversationId:
      input.conversationId ||
      String(args.telnyx_conversation_id || args.conversation_id || "") ||
      null,
    telnyxCallControlId:
      input.callControlId ||
      String(args.call_control_id || args.callControlId || "") ||
      null,
    callerE164:
      input.callerE164 ||
      String(args.from || args.caller || args.caller_e164 || "") ||
      null,
    calledE164:
      input.calledE164 ||
      String(args.to || args.called || args.called_e164 || "") ||
      null,
  };
}
