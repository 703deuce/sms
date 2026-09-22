import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import type { VoiceToolKind } from "./concurrency-policy";
import { buildUpdateIntakeOpenAiTool, updateIntakeTool } from "./update-intake-tool";
import {
  buildSetSchedulingPreferenceOpenAiTool,
  setSchedulingPreferenceTool,
} from "./set-scheduling-preference-tool";
import { buildFindAvailabilityOpenAiTool, findAvailabilityTool } from "./find-availability-tool";
import { buildBookAppointmentOpenAiTool, bookAppointmentTool } from "./book-appointment-tool";
import { buildFindAppointmentOpenAiTool, findAppointmentTool } from "./find-appointment-tool";
import { buildRescheduleAppointmentOpenAiTool, rescheduleAppointmentTool } from "./reschedule-appointment-tool";
import { buildCancelAppointmentOpenAiTool, cancelAppointmentTool } from "./cancel-appointment-tool";
import { buildTransferCallOpenAiTool, transferCallTool } from "./transfer-call-tool";
import { buildEndCallOpenAiTool, endCallTool } from "./end-call-tool";
import {
  buildSendBookingLinkOpenAiTool,
  sendBookingLinkTool,
} from "./send-booking-link-tool";
import {
  buildRequestCallbackOpenAiTool,
  requestCallbackTool,
} from "./request-callback-tool";
import {
  buildSearchBusinessKnowledgeOpenAiTool,
  searchBusinessKnowledgeTool,
} from "./search-business-knowledge-tool";
import {
  buildSubmitAppointmentRequestOpenAiTool,
  submitAppointmentRequestTool,
} from "./submit-appointment-request-tool";
import { buildTakeMessageOpenAiTool, takeMessageTool } from "./take-message-tool";
import { isTakeMessageAuthorized } from "./authorize-tool-for-config";
import {
  isRequestCallbackAuthorized,
  isSendBookingLinkAuthorized,
} from "./authorize-tool-for-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";

export type VoiceToolCatalogEntry = {
  name: string;
  kind: VoiceToolKind;
  telemetryName: string;
  definition: VoiceToolDefinition<unknown>;
  buildOpenAiTool: (config: VoiceV3AgentConfig) => FunctionTool;
};

export const VOICE_TOOL_CATALOG: VoiceToolCatalogEntry[] = [
  {
    name: "update_intake",
    kind: "state_update",
    telemetryName: "update_intake",
    definition: updateIntakeTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildUpdateIntakeOpenAiTool,
  },
  {
    name: "set_scheduling_preference",
    kind: "state_update",
    telemetryName: "set_scheduling_preference",
    definition: setSchedulingPreferenceTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildSetSchedulingPreferenceOpenAiTool,
  },
  {
    name: "find_availability",
    kind: "read",
    telemetryName: "find_availability",
    definition: findAvailabilityTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildFindAvailabilityOpenAiTool,
  },
  {
    name: "book_appointment",
    kind: "mutation",
    telemetryName: "book_appointment",
    definition: bookAppointmentTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildBookAppointmentOpenAiTool,
  },
  {
    name: "find_appointment",
    kind: "read",
    telemetryName: "find_appointment",
    definition: findAppointmentTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildFindAppointmentOpenAiTool,
  },
  {
    name: "reschedule_appointment",
    kind: "mutation",
    telemetryName: "reschedule_appointment",
    definition: rescheduleAppointmentTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildRescheduleAppointmentOpenAiTool,
  },
  {
    name: "cancel_appointment",
    kind: "mutation",
    telemetryName: "cancel_appointment",
    definition: cancelAppointmentTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildCancelAppointmentOpenAiTool,
  },
  {
    name: "transfer_call",
    kind: "lifecycle",
    telemetryName: "transfer_call",
    definition: transferCallTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildTransferCallOpenAiTool,
  },
  {
    name: "end_call",
    kind: "lifecycle",
    telemetryName: "end_call",
    definition: endCallTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildEndCallOpenAiTool,
  },
  {
    name: "send_booking_link",
    kind: "mutation",
    telemetryName: "send_booking_link",
    definition: sendBookingLinkTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildSendBookingLinkOpenAiTool,
  },
  {
    name: "request_callback",
    kind: "mutation",
    telemetryName: "request_callback",
    definition: requestCallbackTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildRequestCallbackOpenAiTool,
  },
  {
    name: "search_business_knowledge",
    kind: "read",
    telemetryName: "search_business_knowledge",
    definition: searchBusinessKnowledgeTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildSearchBusinessKnowledgeOpenAiTool,
  },
  {
    name: "submit_appointment_request",
    kind: "mutation",
    telemetryName: "submit_appointment_request",
    definition: submitAppointmentRequestTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildSubmitAppointmentRequestOpenAiTool,
  },
  {
    name: "take_message",
    kind: "mutation",
    telemetryName: "take_message",
    definition: takeMessageTool as VoiceToolDefinition<unknown>,
    buildOpenAiTool: buildTakeMessageOpenAiTool,
  },
];

function isDirectCalendarStrategy(config: VoiceV3AgentConfig): boolean {
  return isDirectCalendarBookingConfig(config);
}

function isToolEnabledForConfig(entry: VoiceToolCatalogEntry, config: VoiceV3AgentConfig): boolean {
  const caps = config.capabilities;
  if (!caps) {
    return entry.name === "update_intake" || entry.name === "end_call";
  }
  switch (entry.name) {
    case "book_appointment":
      return caps.bookAppointments && isDirectCalendarStrategy(config);
    case "find_availability":
      return caps.checkAvailability && isDirectCalendarStrategy(config);
    case "find_appointment":
      return caps.findAppointments && isDirectCalendarStrategy(config);
    case "reschedule_appointment":
      return caps.rescheduleAppointments && isDirectCalendarStrategy(config);
    case "cancel_appointment":
      return caps.cancelAppointments && isDirectCalendarStrategy(config);
    case "send_booking_link":
      return isSendBookingLinkAuthorized(config);
    case "request_callback":
      return isRequestCallbackAuthorized(config);
    case "set_scheduling_preference":
      return isDirectCalendarStrategy(config);
    case "transfer_call":
      return (
        caps.transferCalls &&
        (config.transfer?.enabled === true ||
          (config.transferDestinations?.some((d) => d.enabled !== false) ?? false))
      );
    case "search_business_knowledge":
      return (
        config.knowledge?.retrieval?.enabled === true &&
        (config.capabilities?.answerQuestions !== false) &&
        (config.knowledge?.retrieval?.openaiVectorStoreIds?.length ?? 0) === 0
      );
    case "submit_appointment_request":
      return config.scheduling?.bookingStrategy === "REQUEST_ONLY";
    case "take_message":
      return isTakeMessageAuthorized(config);
    case "update_intake":
    case "end_call":
      return true;
    default:
      return true;
  }
}

export function buildVoiceV3AstraFunctionToolsFromCatalog(
  config: VoiceV3AgentConfig,
): FunctionTool[] {
  return VOICE_TOOL_CATALOG.filter((entry) => isToolEnabledForConfig(entry, config)).map(
    (entry) => entry.buildOpenAiTool(config),
  );
}

export function listVoiceV3AstraToolNamesForConfig(config: VoiceV3AgentConfig): string[] {
  return VOICE_TOOL_CATALOG.filter((entry) => isToolEnabledForConfig(entry, config)).map(
    (e) => e.name,
  );
}
