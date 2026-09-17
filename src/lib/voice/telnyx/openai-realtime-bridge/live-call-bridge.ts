import WebSocket from "ws";
import { runTelnyxOpenAiLiveSplitBridge } from "../openai-live-bridge/call-bridge";

/**
 * Production entry for transport `openai_live`.
 * Split prompts + optional Responses delegation: `openai-live-bridge/`.
 * Protocol wiring: `live-minimal-bridge.ts`.
 */
export async function runTelnyxOpenAiLiveBridge(input: {
  claims: import("./stream-token").RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
  await runTelnyxOpenAiLiveSplitBridge(input);
}
