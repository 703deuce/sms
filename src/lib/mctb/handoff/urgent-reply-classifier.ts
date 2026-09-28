import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";

export type MctbUrgentReplyClassification = {
  urgent: boolean;
  reason: string;
  summary: string;
};

const SYSTEM = `You classify whether an inbound SMS reply is URGENT for a service business.
The business owner's natural-language instructions define what counts as urgent — not generic keywords alone.
Return JSON only: { "urgent": boolean, "reason": string, "summary": string }
- reason: one concise sentence for the business team
- summary: short neutral summary of the customer's message for notifications
If instructions are empty, use reasonable judgment for life-safety / active property damage only.`;

export async function classifyMctbUrgentReply(input: {
  instructions: string;
  latestMessage: string;
  recentMessages?: string[];
}): Promise<MctbUrgentReplyClassification | null> {
  const latest = input.latestMessage.trim();
  if (!latest) return null;

  const context =
    input.recentMessages?.filter(Boolean).slice(-6).join("\n---\n") || "(no prior messages)";

  const user = JSON.stringify({
    urgent_instructions: input.instructions.trim() || "(none provided — only classify clear emergencies)",
    latest_customer_message: latest,
    recent_conversation_context: context,
  });

  const result = await mctbSemanticStructuredJson<{
    urgent?: boolean;
    reason?: string;
    summary?: string;
  }>({
    system: SYSTEM,
    user,
    temperature: 0.1,
    maxTokens: 400,
  });

  if (!result?.data) return null;

  const urgent = Boolean(result.data.urgent);
  const reason =
    typeof result.data.reason === "string" && result.data.reason.trim()
      ? result.data.reason.trim()
      : urgent
        ? "Classified as urgent"
        : "Not classified as urgent";
  const summary =
    typeof result.data.summary === "string" && result.data.summary.trim()
      ? result.data.summary.trim()
      : latest.slice(0, 240);

  return { urgent, reason, summary };
}
