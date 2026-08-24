export type BusinessCallbackInitiationMethod =
  | "call_in_pin"
  | "dashboard_ringout"
  | "employee_link"
  | "last_caller"
  | "recent_caller"
  | "call_again";

export type BusinessCallbackSourceType =
  | "manual"
  | "routing_activity"
  | "missed_call"
  | "conversation"
  | "voicemail"
  | "callback_request";

export type InitiateBusinessCallbackInput = {
  workspaceId: string;
  authorizedCallerId: string;
  destinationE164: string;
  employeeCallbackE164?: string | null;
  businessCallerIdE164?: string | null;
  sourceType: BusinessCallbackSourceType;
  sourceId?: string | null;
  initiationMethod: BusinessCallbackInitiationMethod;
  originalInboundSessionId?: string | null;
  initiatedByUserId?: string | null;
  destinationContactName?: string | null;
  previousOutboundCallId?: string | null;
};

export function mapContextTypeFromSource(sourceType: BusinessCallbackSourceType) {
  switch (sourceType) {
    case "routing_activity":
      return "activity" as const;
    case "missed_call":
      return "missed_call" as const;
    case "conversation":
      return "conversation" as const;
    case "voicemail":
      return "voicemail" as const;
    case "callback_request":
      return "callback_request" as const;
    default:
      return "manual" as const;
  }
}
