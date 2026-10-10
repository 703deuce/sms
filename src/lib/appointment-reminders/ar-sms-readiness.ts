import "server-only";

import { resolveAppointmentOutboundSmsRoute } from "@/lib/appointments/sms-sender";
import { shouldMeterAppointmentRemindersSms } from "@/lib/appointment-reminders/ar-sms-usage";
import { resolveArMonthlySmsLimit } from "@/lib/appointment-reminders/ar-commercial-entitlements";

export type ArSmsOutboundReadiness = {
  /** Platform toll-free sender route is configured and authorized for outbound SMS. */
  senderReady: boolean;
  senderDetail: string;
  /** When platform metering is active, a non-zero monthly limit is configured (commercial pass may set plans). */
  commercialAllowanceConfigured: boolean;
  commercialAllowanceDetail: string;
};

/**
 * Appointment Reminders SMS readiness — sender route (Telnyx platform sender) is separate from
 * commercial SMS allowance (plans/limits). Activation gates on sender only when SMS steps are enabled.
 */
export async function evaluateArSmsOutboundReadiness(
  workspaceId: string,
): Promise<ArSmsOutboundReadiness> {
  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  if (!route) {
    return {
      senderReady: false,
      senderDetail:
        "Transovo’s platform SMS sender is not available yet. Appointment reminders send from the same toll-free number as Missed Call Text Back — contact support if this persists.",
      commercialAllowanceConfigured: false,
      commercialAllowanceDetail: "Message allowance is configured with your plan (not required to finish setup).",
    };
  }

  const meteringActive = await shouldMeterAppointmentRemindersSms(workspaceId);
  let commercialAllowanceConfigured = true;
  let commercialAllowanceDetail =
    "SMS sending uses Transovo’s platform sender. Monthly message limits are set when you choose a plan.";

  if (meteringActive) {
    const { limit, source } = await resolveArMonthlySmsLimit(workspaceId);
    commercialAllowanceConfigured = limit > 0;
    if (!commercialAllowanceConfigured) {
      commercialAllowanceDetail =
        source === "unconfigured"
          ? "No monthly SMS allowance is configured for this workspace yet. Reminders may not send until a plan or trial limit is assigned (commercial setup)."
          : "Monthly SMS allowance is set to zero. Reminders may not send until your plan includes messages.";
    } else {
      commercialAllowanceDetail = `Platform sender ready. Monthly SMS allowance: ${limit} (${source}).`;
    }
  }

  return {
    senderReady: true,
    senderDetail: `SMS reminders send from ${route.fromE164} (Transovo platform sender).`,
    commercialAllowanceConfigured,
    commercialAllowanceDetail,
  };
}
