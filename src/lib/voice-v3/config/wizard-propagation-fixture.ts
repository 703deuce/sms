import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** Rich wizard baseline for propagation tests (Microsoft booking + custom intake). */
export function wizardPropagationBaseline(): AppointmentReceptionistWizardState {
  const base = createDefaultWizardState();
  return {
    ...base,
    capabilities: [
      "answer_questions",
      "book_appointments",
      "transfer_calls",
      "take_messages",
    ],
    solutionName: "Propagation Cert Agent",
    businessName: "Johnson Home Remodeling",
    agentName: "Jessica",
    openingGreeting:
      "Thanks for calling Johnson Home Remodeling. This is Jessica. How can I help you today?",
    calendarProvider: "microsoft",
    calendarConnected: true,
    calendarEmail: "calendar@example.com",
    bookingStrategy: "MICROSOFT_365",
    voiceId: "marin",
    voiceLabel: "Marin",
    timezone: "America/Chicago",
    operatingMaturity: {
      ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG,
      revision: "propagation-fixture",
      businessSchedule: {
        ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule,
        timezone: "America/Chicago",
        weekly: {
          ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule.weekly,
          tuesday: { closed: false, ranges: [{ start: "10:00", end: "16:00" }] },
        },
      },
    },
    appointmentTypes: [
      {
        id: "consultation",
        name: "Consultation",
        durationMin: 30,
        calendar: "Main Calendar",
        status: "ready",
        enabled: true,
        requiredFields: ["full_name", "phone"],
        bookingPermission: "book_directly",
      },
      {
        id: "estimate",
        name: "Estimate",
        durationMin: 60,
        calendar: "Main Calendar",
        status: "ready",
        enabled: true,
        requiredFields: ["full_name", "phone"],
        bookingPermission: "book_directly",
      },
    ],
    selectedAppointmentTypeId: "consultation",
    collectFields: [
      { id: "full_name", label: "Name", required: true, enabled: true },
      { id: "phone", label: "Phone", required: true, enabled: true },
      { id: "email", label: "Email", required: false, enabled: true },
      {
        id: "custom_project_type",
        label: "Project Type",
        required: true,
        enabled: true,
      },
      { id: "zip_code", label: "ZIP Code", required: false, enabled: true },
    ],
    transferDestinations: [
      { id: "desk", label: "Front desk", phoneE164: "+15550001111", enabled: true },
    ],
    defaultTransferPlanId: "plan_desk",
    transferPlanSteps: [
      {
        order: 1,
        destinationId: "desk",
        transferMode: "BASIC",
        timeoutSeconds: 30,
      },
    ],
    qualificationRules: [
      {
        id: "rule_zip",
        fieldKey: "zip_code",
        operator: "equals",
        value: "20151",
        resultStatus: "qualified",
        reasonCode: "in_area",
        reasonLabel: "In service area",
      },
    ],
    urgencyRules: [
      {
        id: "urgent_water",
        label: "Water leak",
        fieldKey: "project_type",
        operator: "contains",
        value: "leak",
        severity: "urgent",
        action: "CALLBACK",
        transferPlanId: null,
        fallbackAction: "TAKE_MESSAGE",
      },
    ],
    knowledgeItems: base.knowledgeItems.map((item) =>
      item.id === "hours"
        ? {
            ...item,
            summary: "Tue–Thu 10am–4pm (cert fixture)",
            status: "complete" as const,
          }
        : item,
    ),
  };
}
