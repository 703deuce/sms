import type { CapabilityId } from "./types";
import type { ReceptionistAdvancedSettings } from "./advanced-types";
import { actionPermissionsFromCapabilities, createDefaultAdvancedSettings } from "./advanced-defaults";

/** Full demo/production Harbor Home HVAC wizard content for smoke tests and 866 line. */
export const HARBOR_HOME_CAPABILITIES: CapabilityId[] = [
  "answer_questions",
  "take_messages",
  "collect_info",
  "book_appointments",
  "transfer_calls",
];

export const HARBOR_HOME_WIZARD_CONTENT = {
  agentName: "Amy",
  businessName: "Harbor Home HVAC",
  industry: "HVAC Services",
  businessDescription:
    "Harbor Home HVAC is a licensed residential heating and cooling company serving Arlington, Fairfax, and Falls Church. We repair furnaces, heat pumps, and central AC, perform seasonal tune-ups, and offer 24/7 no-heat and no-cool emergency dispatch. License VA-HVAC-8842. Standard diagnostic visit is $89; after-hours emergency dispatch starts at $149.",
  agentPersonalityNotes:
    "You are Amy, the receptionist for Harbor Home HVAC. You sound warm, calm, and competent — never robotic. You keep calls efficient without rushing callers. You vary acknowledgments naturally and write for spoken delivery. You confirm spellings for names and repeat callback numbers clearly, digit by digit.",
  agentJobInstructions:
    "Answer every incoming call for Harbor Home HVAC.\n" +
    "- For heating or cooling problems, determine whether it is no-heat, no-cool, weak airflow, strange noise, or routine maintenance.\n" +
    "- Collect full name, callback number, service address, and a clear description of the problem.\n" +
    "- Collect system type (furnace, heat pump, or central AC) and any access notes when scheduling service.\n" +
    "- Explain the $89 diagnostic fee for standard visits and $149 after-hours emergency dispatch. Never quote exact repair prices without an on-site diagnosis.\n" +
    "- Offer to schedule a technician visit when the caller wants service.\n" +
    "- Take detailed messages when they prefer a callback.\n" +
    "- Transfer true emergencies per policy when the caller needs immediate human help.",
  additionalInstructions:
    "Operations:\n" +
    "- No same-day emergency bookings after 5 PM — take a message for the on-call manager instead.\n" +
    "- Never promise exact arrival times; say a technician will call back within 30 minutes for emergencies.\n" +
    "- Do not transfer landlord or condo authorization questions; take a message for the office manager.\n" +
    "- If the caller mentions an active maintenance plan, note it and tell them the office will confirm benefits.\n" +
    "- Spanish-speaking callers: offer to take a detailed message if no bilingual staff is available.\n" +
    "- Do not schedule commercial generator work — we only service residential HVAC.",
  businessHours:
    "Monday–Friday 7:00 AM – 7:00 PM. Saturday 9:00 AM – 3:00 PM (emergency only). Closed Sunday.",
  serviceArea: "Arlington County, Fairfax County, Falls Church, and McLean.",
  coreServices:
    "AC repair, furnace repair, heat pump service, seasonal tune-ups, duct cleaning, thermostat installation, emergency no-heat and no-cool dispatch.",
  pricingNotes:
    "$89 standard diagnostic visit. $149 after-hours emergency dispatch. Repair quotes only after on-site diagnosis.",
  importantFacts:
    "License VA-HVAC-8842. We do not service commercial generators. Maintenance plan members receive priority scheduling.",
  businessAddress: "4201 Wilson Blvd, Arlington, VA 22203",
  greeting: "Hi, thanks for calling Harbor Home HVAC. This is Amy — how can I help you today?",
};

export function buildHarborHomeAdvancedSettings(): ReceptionistAdvancedSettings {
  const base = createDefaultAdvancedSettings();
  const callerFields = [
    { ...base.callerFields.find((f) => f.id === "name")!, enabled: true, required: true },
    { ...base.callerFields.find((f) => f.id === "phone")!, enabled: true, required: true },
    {
      ...base.callerFields.find((f) => f.id === "reason")!,
      enabled: true,
      required: true,
      askWhen: "every_caller" as const,
    },
    {
      ...base.callerFields.find((f) => f.id === "address")!,
      enabled: true,
      required: true,
      askWhen: "service_inquiry" as const,
    },
    { ...base.callerFields.find((f) => f.id === "email")!, enabled: true, required: false, askWhen: "when_booking" as const },
    {
      id: "custom_issue_category",
      label: "Issue category",
      question:
        "Is this a no-heat situation, no-cool, weak airflow, strange noise, or routine maintenance?",
      required: true,
      askWhen: "service_inquiry" as const,
      confirm: false,
      enabled: true,
    },
    {
      id: "custom_system_type",
      label: "System type",
      question: "What type of system is it — furnace, heat pump, or central AC?",
      required: true,
      askWhen: "service_inquiry" as const,
      confirm: false,
      enabled: true,
    },
    {
      id: "custom_access_notes",
      label: "Access notes",
      question:
        "Is there anything our technician should know about getting to the equipment or gate codes?",
      required: false,
      askWhen: "service_inquiry" as const,
      confirm: false,
      enabled: true,
    },
  ];

  return {
    ...base,
    callerFields,
    actionPermissions: actionPermissionsFromCapabilities(HARBOR_HOME_CAPABILITIES, base.actionPermissions),
    bookingPolicy: {
      ...base.bookingPolicy,
      askPreferredDayFirst: true,
      confirmDateTimeVerbally: true,
      slotsToOffer: 3,
      minimumNoticeHours: 2,
    },
    transferPolicy: {
      ...base.transferPolicy,
      whenToTransfer: "certain_calls",
      transferInstructions:
        "Transfer no-heat or no-cool emergencies when the caller needs immediate help. Take a message for billing and landlord authorization questions.",
      destinationE164: process.env.HARBOR_HOME_TRANSFER_E164 || "",
      emergencyDestinationE164: process.env.HARBOR_HOME_EMERGENCY_E164 || "",
    },
    knowledgePolicy: {
      approvedKnowledgeOnly: true,
      allowGeneralAnswers: false,
      whenUncertain: "take_message",
    },
    fallbackPolicy: {
      ...base.fallbackPolicy,
      onMisunderstand: "take_message",
      onBookingFail: "take_message",
      onTransferFail: "take_message",
    },
    notifications: {
      ...base.notifications,
      messageEmail: process.env.HARBOR_HOME_MESSAGE_EMAIL || undefined,
    },
  };
}
