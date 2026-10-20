import type { VoiceV3CallContext } from "../state/call-context";

const HANDOFF_FIELD_KEYS = new Set([
  "name",
  "phone",
  "email",
  "service_reason",
  "notes",
]);

/**
 * Concise warm-transfer briefing for the human agent — not a full intake dump.
 */
export function buildWarmTransferHandoffInstructions(input: {
  businessName: string;
  agentName: string;
  reason: string | null;
  callContext: VoiceV3CallContext;
}): string {
  const lines: string[] = [];
  lines.push(
    `You are ${input.agentName} with ${input.businessName}. Briefly summarize the caller for the human agent.`,
  );
  lines.push("Keep it to 2–4 short sentences. Do not mention tools, software, or internal IDs.");
  lines.push("Ask whether they are available to take the call, then use connect_to_caller if they accept.");

  const intake = input.callContext.intake?.values ?? {};
  const facts: string[] = [];
  for (const [key, row] of Object.entries(intake)) {
    if (!HANDOFF_FIELD_KEYS.has(key)) continue;
    const val = row?.value?.trim();
    if (!val) continue;
    facts.push(`${key.replace(/_/g, " ")}: ${val}`);
  }
  const ani = input.callContext.telephony?.inboundCallerE164?.trim();
  if (ani && !facts.some((f) => f.startsWith("phone:"))) {
    facts.push(`caller phone: ${ani}`);
  }
  if (input.reason?.trim()) {
    facts.push(`transfer reason: ${input.reason.trim()}`);
  }
  if (facts.length) {
    lines.push("Known caller context:");
    for (const f of facts) lines.push(`- ${f}`);
  }
  return lines.join("\n");
}
