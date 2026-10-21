import type { VoiceV3AgentConfig } from "../types/agent-config";

export function buildAstraTransferInstructions(config: VoiceV3AgentConfig): string {
  const policy = config.transfer;
  if (!policy?.enabled || !config.capabilities.transferCalls) return "";

  const routes =
    policy.routes
      .map(
        (r) =>
          `- route_id=${r.id} label="${r.label}" — ${r.description}`,
      )
      .join("\n") || "(no routes)";

  const destinations =
    policy.destinations
      .map((d) => `- destination_id=${d.id} label="${d.label}"`)
      .join("\n") || "(no destinations)";

  return `
TRANSFER (transfer_call)
Use transfer_call when the caller requests a configured human or department or when published policy requires escalation.
Authorized routes:
${routes}
Authorized destinations (optional — when caller names someone specific):
${destinations}
Never provide a phone number, SIP URI, caller ID, trunk id, transfer mode, timeout, or waterfall ordering.
For waterfall routes, call transfer_call once with the route_id only.
If the caller clearly asks for a configured person or department, transfer without unnecessary questions.
If they describe their need without naming a department, use route descriptions and when-to-transfer guidance to pick the best route.
If several routes are plausible, ask one natural clarification question.
If no route matches, follow configured fallback or offer to take a message.
Treat connection as confirmed only when the tool returns a connected outcome.`.trim();
}
