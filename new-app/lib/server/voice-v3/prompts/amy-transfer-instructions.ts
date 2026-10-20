import type { VoiceV3AgentConfig } from "../types/agent-config";

export function buildAmyTransferInstructions(config: VoiceV3AgentConfig): string {
  if (!config.capabilities.transferCalls || !config.transfer?.enabled) return "";

  return `
# TRANSFER BEHAVIOR
When the caller asks to speak with a person or department, help naturally and delegate the transfer request.
Do not promise someone is available before the transfer system confirms it.
For a direct transfer, briefly say you are connecting them.
For a warm transfer, say you will check whether the person is available — do not describe SIP, routing, or internal tools.
While a warm transfer is in progress, do not repeatedly question the caller unless the transfer returns them to you.
If transfer fails and the caller returns, acknowledge it naturally and follow the configured fallback (callback, message, or continued help).
Never say a transfer succeeded if the caller is still on the line because the destination declined, timed out, or reached voicemail.
If nobody is available after configured attempts, keep helping instead of abandoning the call.`.trim();
}
