import type { VoiceV3AgentConfig } from "./agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "./booking-agent-config";
import { compileVoiceV3AgentConfig } from "./compile-voice-v3-agent-config";
import type { VoiceV3ProviderConnections } from "./compile-voice-v3-agent-config";
import { applyMandatoryConversationGuardrails } from "@/lib/solutions/appointment-receptionist/conversation-guardrails";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { listVoiceV3AstraToolNamesForConfig } from "../tools/voice-tool-catalog";
import { isVoiceV3ToolAuthorized } from "../tools/authorize-tool-for-config";

export const VOICE_V3_PARITY_TOOL_ORDER = [
  "update_intake",
  "set_scheduling_preference",
  "find_availability",
  "book_appointment",
  "find_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "submit_appointment_request",
  "send_booking_link",
  "transfer_call",
  "request_callback",
  "take_message",
  "search_business_knowledge",
  "report_unwanted_solicitor",
  "end_call",
] as const;

export type ParityToolRow = {
  tool: string;
  certCompiled: boolean;
  wizardCompiled: boolean;
  certAuthorized: boolean;
  wizardAuthorized: boolean;
  notes?: string;
};

export type ParityScenarioId =
  | "wizard_default_request_only"
  | "wizard_microsoft_365_direct"
  | "wizard_send_booking_link"
  | "wizard_booking_disabled"
  | "cert_m365_reference";

export function wizardMicrosoft365DirectFixture(
  overrides: Partial<AppointmentReceptionistWizardState> = {},
): AppointmentReceptionistWizardState {
  const base = applyMandatoryConversationGuardrails(createDefaultWizardState());
  return {
    ...base,
    capabilities: Array.from(
      new Set([
        ...(base.capabilities || []),
        "book_appointments",
        "reschedule",
        "cancel",
        "transfer_calls",
      ]),
    ),
    businessName: "Parity Test Business",
    agentName: "Amy",
    calendarProvider: "microsoft",
    calendarConnected: true,
    calendarEmail: "calendar@example.com",
    bookingStrategy: "MICROSOFT_365",
    appointmentTypes: (base.appointmentTypes || []).map((t) => ({
      ...t,
      enabled: true,
      bookingPermission: "book_directly",
    })),
    transferDestinations: [
      { id: "desk", label: "Front desk", phoneE164: "+15550001111", enabled: true },
    ],
    transferDestinationPhone: "+15550001111",
    connectionGreeting: "none",
    knowledgeItems: (base.knowledgeItems || []).map((k) => ({
      ...k,
      status: k.status === "missing" ? "missing" : k.status,
    })),
    ...overrides,
  };
}

export function compileScenario(
  scenario: ParityScenarioId,
  providerConnections?: VoiceV3ProviderConnections,
): VoiceV3AgentConfig {
  switch (scenario) {
    case "cert_m365_reference":
      return VOICE_V3_BOOKING_AGENT_CONFIG;
    case "wizard_default_request_only":
      return compileVoiceV3AgentConfig({
        wizard: applyMandatoryConversationGuardrails(createDefaultWizardState()),
        providerConnections,
      });
    case "wizard_microsoft_365_direct":
      return compileVoiceV3AgentConfig({
        wizard: wizardMicrosoft365DirectFixture(),
        providerConnections: providerConnections ?? {
          microsoftConnectionId: "conn_parity_test",
          microsoftCalendarIds: ["primary"],
        },
      });
    case "wizard_send_booking_link":
      return compileVoiceV3AgentConfig({
        wizard: wizardMicrosoft365DirectFixture({
          bookingStrategy: "SEND_LINK",
          appointmentTypes: wizardMicrosoft365DirectFixture().appointmentTypes.map((t) => ({
            ...t,
            bookingPermission: "send_booking_link",
          })),
          bookingLinkUrl: "https://book.example.com/schedule",
        }),
        providerConnections,
      });
    case "wizard_booking_disabled":
      return compileVoiceV3AgentConfig({
        wizard: wizardMicrosoft365DirectFixture({
          capabilities: ["answer_questions", "take_messages", "transfer_calls"],
          bookingStrategy: "NONE",
        }),
        providerConnections,
      });
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

export function toolMatrixForConfigs(
  cert: VoiceV3AgentConfig,
  wizard: VoiceV3AgentConfig,
): ParityToolRow[] {
  return VOICE_V3_PARITY_TOOL_ORDER.map((tool) => ({
    tool,
    certCompiled: listVoiceV3AstraToolNamesForConfig(cert).includes(tool),
    wizardCompiled: listVoiceV3AstraToolNamesForConfig(wizard).includes(tool),
    certAuthorized: isVoiceV3ToolAuthorized(cert, tool),
    wizardAuthorized: isVoiceV3ToolAuthorized(wizard, tool),
  }));
}

export function calendarBookingToolSet(): string[] {
  return [
    "set_scheduling_preference",
    "find_availability",
    "book_appointment",
    "find_appointment",
    "reschedule_appointment",
    "cancel_appointment",
  ];
}

export function assertWizardM365MatchesCertCalendarTools(): {
  certTools: string[];
  wizardTools: string[];
} {
  const cert = compileScenario("cert_m365_reference");
  const wizard = compileScenario("wizard_microsoft_365_direct");
  const certTools = listVoiceV3AstraToolNamesForConfig(cert);
  const wizardTools = listVoiceV3AstraToolNamesForConfig(wizard);
  const required = calendarBookingToolSet();
  for (const name of required) {
    if (!certTools.includes(name)) {
      throw new Error(`Cert reference missing expected tool: ${name}`);
    }
    if (!wizardTools.includes(name)) {
      throw new Error(`Wizard M365 compile missing expected tool: ${name}`);
    }
  }
  return { certTools, wizardTools };
}
