import type { VoiceToolDefinition } from "./types";
import { updateIntakeTool } from "./update-intake-tool";
import { findAvailabilityTool } from "./find-availability-tool";
import { bookAppointmentTool } from "./book-appointment-tool";
import { findAppointmentTool } from "./find-appointment-tool";
import { cancelAppointmentTool } from "./cancel-appointment-tool";
import { rescheduleAppointmentTool } from "./reschedule-appointment-tool";
import { transferCallTool } from "./transfer-call-tool";
import { endCallTool } from "./end-call-tool";

const tools = new Map<string, VoiceToolDefinition<unknown>>();

function register<T>(def: VoiceToolDefinition<T>): void {
  tools.set(def.name, def as VoiceToolDefinition<unknown>);
}

export function registerVoiceTools(): void {
  if (tools.size > 0) return;
  register(updateIntakeTool);
  register(findAvailabilityTool);
  register(bookAppointmentTool);
  register(findAppointmentTool);
  register(cancelAppointmentTool);
  register(rescheduleAppointmentTool);
  register(transferCallTool);
  register(endCallTool);
}

export function getVoiceTool(name: string): VoiceToolDefinition<unknown> | undefined {
  registerVoiceTools();
  return tools.get(name);
}

export function listVoiceToolDefinitions(): VoiceToolDefinition<unknown>[] {
  registerVoiceTools();
  return [...tools.values()];
}

export function isRegisteredVoiceTool(name: string): boolean {
  registerVoiceTools();
  return tools.has(name);
}
