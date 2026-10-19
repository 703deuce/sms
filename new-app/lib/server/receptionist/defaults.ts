import { DEFAULT_AGENT, type AgentConfig } from "@/lib/agent";

/** Server-side defaults for a workspace with no persisted receptionist yet. */
export function defaultReceptionistEditorConfig(): AgentConfig {
  return JSON.parse(JSON.stringify(DEFAULT_AGENT)) as AgentConfig;
}
