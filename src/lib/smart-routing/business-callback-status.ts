import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type BusinessCallbackUiStatus =
  | "initiated"
  | "calling_employee"
  | "awaiting_confirmation"
  | "calling_customer"
  | "connected"
  | "completed"
  | "employee_no_answer"
  | "employee_confirmation_timeout"
  | "employee_rejected"
  | "customer_no_answer"
  | "customer_busy"
  | "customer_rejected"
  | "failed"
  | "cancelled"
  | "mock";

export function resolveAuthorizedCallerCallbackPhone(caller: {
  phoneE164: string;
  preferredCallbackPhoneE164?: string | null;
}): string {
  const preferred = caller.preferredCallbackPhoneE164?.trim();
  if (preferred) return normalizeE164(preferred);
  return normalizeE164(caller.phoneE164);
}

export function formatCallbackPromptDestination(destinationE164: string, contactName?: string | null) {
  const phone = fmtPhoneDisplay(destinationE164);
  if (contactName?.trim()) {
    return `${contactName.trim()} at ${phone}`;
  }
  return phone;
}

export function mapOutboundResultToUiStatus(
  result: string | null | undefined,
  bridgedAt?: Date | null,
  endedAt?: Date | null,
): BusinessCallbackUiStatus {
  if (!result) return "initiated";
  const r = result.toLowerCase();
  if (r === "mock") return "mock";
  if (r === "initiated" || r === "employee_ringing") return "calling_employee";
  if (r === "awaiting_confirmation") return "awaiting_confirmation";
  if (r === "customer_ringing") return "calling_customer";
  if (r === "bridged" && !endedAt) return "connected";
  if (r === "bridged" || r === "completed") return endedAt ? "completed" : "connected";
  if (
    r === "employee_no_answer" ||
    r === "employee_confirmation_timeout" ||
    r === "employee_rejected"
  ) {
    return r as BusinessCallbackUiStatus;
  }
  if (r === "customer_no_answer" || r === "customer_busy" || r === "customer_rejected") {
    return r as BusinessCallbackUiStatus;
  }
  if (r === "cancelled") return "cancelled";
  if (r === "failed") return "failed";
  if (bridgedAt && endedAt) return "completed";
  return "initiated";
}

export function businessCallbackStatusLabel(status: BusinessCallbackUiStatus): string {
  switch (status) {
    case "calling_employee":
      return "Calling your phone…";
    case "awaiting_confirmation":
      return "Waiting for you to press 1…";
    case "calling_customer":
      return "Calling customer…";
    case "connected":
      return "Connected";
    case "completed":
      return "Completed";
    case "employee_no_answer":
      return "You did not answer";
    case "employee_confirmation_timeout":
      return "Confirmation timed out";
    case "employee_rejected":
      return "Call not confirmed";
    case "customer_no_answer":
      return "Customer did not answer";
    case "customer_busy":
      return "Customer line busy";
    case "customer_rejected":
      return "Customer declined the call";
    case "failed":
      return "Call failed";
    case "cancelled":
      return "Cancelled";
    case "mock":
      return "Simulated (Telnyx not configured)";
    default:
      return "Starting call…";
  }
}
