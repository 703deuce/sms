import type { VoiceToolDefinition } from "./types";
import { VOICE_TOOL_CATALOG } from "./voice-tool-catalog";

const tools = new Map<string, VoiceToolDefinition<unknown>>();

export function registerVoiceTools(): void {
  if (tools.size > 0) return;
  for (const entry of VOICE_TOOL_CATALOG) {
    tools.set(entry.name, entry.definition);
  }
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
