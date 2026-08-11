import type { RealtorProductConfig } from "@/lib/realtor/types";
import type { CompileValidationIssue, CompileValidationResult } from "./types";

function error(code: string, message: string, path?: string): CompileValidationIssue {
  return { level: "error", code, message, path };
}

function warning(code: string, message: string, path?: string): CompileValidationIssue {
  return { level: "warning", code, message, path };
}

export function validateRealtorProductConfig(
  config: RealtorProductConfig,
): CompileValidationResult {
  const errors: CompileValidationIssue[] = [];
  const warnings: CompileValidationIssue[] = [];

  if (!config.business.teamName?.trim() && !config.business.brokerage?.trim()) {
    warnings.push(
      warning(
        "missing_business_name",
        "Add a team or brokerage name so Amy can introduce your business.",
        "business.teamName",
      ),
    );
  }

  if (config.amyMode === "front_desk" || config.amyMode === "both") {
    const enabledIntents = Object.values(config.frontDesk).filter((i) => i.enabled);
    if (!enabledIntents.length) {
      errors.push(
        error(
          "no_front_desk_intents",
          "Enable at least one Front Desk caller type.",
          "frontDesk",
        ),
      );
    }

    const bookingIntents = enabledIntents.filter((i) => i.qualifiedOutcome === "book");
    if (bookingIntents.length && !config.appointmentTypes?.length) {
      errors.push(
        error(
          "booking_no_appointment_types",
          "Booking is enabled but no appointment types are configured.",
          "appointmentTypes",
        ),
      );
    }

    const transferIntents = enabledIntents.filter((i) => i.qualifiedOutcome === "transfer");
    if (transferIntents.length && !config.phone.transferNumber?.trim()) {
      errors.push(
        error(
          "transfer_no_destination",
          "Transfer is configured for one or more intents but no transfer number is set.",
          "phone.transferNumber",
        ),
      );
    }

    for (const [key, intent] of Object.entries(config.frontDesk)) {
      if (!intent.enabled) continue;
      for (const field of intent.fields) {
        if (field.enabled && field.custom && !field.label?.trim()) {
          errors.push(
            error(
              "invalid_custom_field",
              `Custom field "${field.fieldId}" on ${key} needs a label.`,
              `frontDesk.${key}.fields`,
            ),
          );
        }
      }
    }
  }

  if (config.amyMode === "speed_to_lead" || config.amyMode === "both") {
    if (!config.speedToLead.buyerQualification && !config.speedToLead.sellerQualification) {
      errors.push(
        error(
          "no_lead_types",
          "Enable buyer and/or seller qualification for Speed-to-Lead.",
          "speedToLead",
        ),
      );
    }

    if (
      config.speedToLead.qualifiedOutcome === "book" &&
      !config.appointmentTypes?.length
    ) {
      errors.push(
        error(
          "outbound_booking_no_calendar",
          "Speed-to-Lead booking is enabled but no appointment types are configured.",
          "appointmentTypes",
        ),
      );
    }

    if (!config.phone.outboundNumberE164?.trim()) {
      warnings.push(
        warning(
          "no_outbound_number",
          "No outbound calling number configured — deploy will use workspace default.",
          "phone.outboundNumberE164",
        ),
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertPublishableConfig(config: RealtorProductConfig): CompileValidationResult {
  const result = validateRealtorProductConfig(config);
  if (!result.ok) {
    const messages = result.errors.map((e) => e.message).join("; ");
    throw new Error(`Configuration cannot be published: ${messages}`);
  }
  return result;
}
