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
];

export function buildVoiceV3AstraFunctionToolsFromCatalog(
  config: VoiceV3AgentConfig,
): FunctionTool[] {
  return VOICE_TOOL_CATALOG.map((entry) => entry.buildOpenAiTool(config));
}
