import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { buildBookAppointmentOpenAiTool } from "./book-appointment-tool";
import { buildCancelAppointmentOpenAiTool } from "./cancel-appointment-tool";
import { buildEndCallOpenAiTool } from "./end-call-tool";
import { buildFindAppointmentOpenAiTool } from "./find-appointment-tool";
import { buildFindAvailabilityOpenAiTool } from "./find-availability-tool";
import { buildRescheduleAppointmentOpenAiTool } from "./reschedule-appointment-tool";
import { buildTransferCallOpenAiTool } from "./transfer-call-tool";
import { buildUpdateIntakeOpenAiTool } from "./update-intake-tool";

export function buildVoiceV3AstraFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  return [
    buildUpdateIntakeOpenAiTool(config),
    buildFindAvailabilityOpenAiTool(config),
    buildBookAppointmentOpenAiTool(config),
    buildFindAppointmentOpenAiTool(config),
    buildRescheduleAppointmentOpenAiTool(config),
    buildCancelAppointmentOpenAiTool(config),
    buildTransferCallOpenAiTool(config),
    buildEndCallOpenAiTool(config),
  ];
}
