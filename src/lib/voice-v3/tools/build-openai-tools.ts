import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { buildBookAppointmentOpenAiTool } from "./book-appointment-tool";
import { buildFindAvailabilityOpenAiTool } from "./find-availability-tool";
import { buildUpdateIntakeOpenAiTool } from "./update-intake-tool";

export function buildVoiceV3AstraFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  return [
    buildUpdateIntakeOpenAiTool(config),
    buildFindAvailabilityOpenAiTool(config),
    buildBookAppointmentOpenAiTool(config),
  ];
}
