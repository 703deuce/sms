import { buildOpenAiLiveSessionStartPayload } from "./live-config";
import { isOpenAiLiveSplitPromptsEnabled } from "./constants";

export {
  isOpenAiLiveDelegationEnabled,
  isOpenAiLiveSplitPromptsEnabled,
} from "./constants";

export function buildOpenAiLiveSplitSessionStartPayload(
  sessionOverrides?: Record<string, unknown>,
): Record<string, unknown> {
  return buildOpenAiLiveSessionStartPayload(sessionOverrides);
}

export function shouldUseSplitLiveSessionStart(): boolean {
  return isOpenAiLiveSplitPromptsEnabled();
}

// Re-export for probes — full call-scoped builder lives in call-bridge.ts
export { buildOpenAiLiveSessionStartPayload } from "./live-config";
