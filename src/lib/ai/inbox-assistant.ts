/**
 * Inbox thread analysis and reply suggestions.
 *
 * Env:
 *   OPENAI_API_KEY — when set, uses OpenAI Chat Completions for analysis
 *   OPENAI_MODEL   — optional model name (default gpt-5-nano)
 */

import { openAiChatCompletion } from "@/lib/ai/openai";

type ThreadMessage = {
  direction: "inbound" | "outbound" | "note";
  body: string;
  at?: string;
};

export type InboxAssistResult = {
  summary: string;
  suggestedReply: string;
  intent: string;
  urgency: string;
  suggestedTags: string[];
  suggestedNextAction: string;
  optOutRisk: boolean;
  unansweredQuestions: string[];
  mode?: "openai" | "heuristic";
};

function heuristicAnalyze(messages: ThreadMessage[], contactName?: string): InboxAssistResult {
  const inbound = messages.filter((m) => m.direction === "inbound");
  const lastInbound = inbound[inbound.length - 1]?.body || "";
  const name = contactName?.trim() || "there";

  const angry = /\b(angry|upset|terrible|awful|lawsuit|refund now)\b/i.test(lastInbound);
  const urgent = /\b(urgent|asap|emergency|today|right now)\b/i.test(lastInbound);
  const optOutRisk = /\b(stop|unsubscribe|remove me|don't text)\b/i.test(lastInbound);
  const booking = /\b(book|schedule|appointment|estimate|quote)\b/i.test(lastInbound);
  const question = lastInbound.includes("?");

  let suggestedReply = `Hi ${name}, thanks for reaching out. How can we help you today?`;
  if (booking) {
    suggestedReply = `Hi ${name}, we'd be happy to help schedule that. What day and time works best for you?`;
  } else if (urgent) {
    suggestedReply = `Hi ${name}, we received your message and will prioritize this. Someone will follow up shortly.`;
  } else if (angry) {
    suggestedReply = `Hi ${name}, I'm sorry for the trouble. I'd like to understand what happened and make this right.`;
  } else if (question) {
    suggestedReply = `Hi ${name}, thanks for your question. Let me get you a clear answer — could you share a bit more detail?`;
  }

  const summary =
    inbound.length === 0
      ? "No inbound messages yet."
      : `Customer sent ${inbound.length} message(s). Latest: "${lastInbound.slice(0, 120)}${lastInbound.length > 120 ? "…" : ""}"`;

  const suggestedTags: string[] = [];
  if (booking) suggestedTags.push("booking-intent");
  if (urgent) suggestedTags.push("urgent");
  if (angry) suggestedTags.push("needs-attention");
  if (optOutRisk) suggestedTags.push("opt-out-risk");

  return {
    summary,
    suggestedReply,
    intent: booking ? "booking" : urgent ? "urgent" : angry ? "complaint" : "general",
    urgency: urgent || angry ? "high" : "normal",
    suggestedTags,
    suggestedNextAction: optOutRisk
      ? "Review consent status before replying"
      : booking
        ? "Offer scheduling link or book appointment"
        : "Send suggested reply",
    optOutRisk,
    unansweredQuestions: question ? [lastInbound] : [],
    mode: "heuristic",
  };
}

export async function analyzeInboxThread(
  messages: ThreadMessage[],
  contactName?: string,
): Promise<InboxAssistResult> {
  const heuristic = heuristicAnalyze(messages, contactName);

  const threadText = messages
    .map((m) => `[${m.direction}] ${m.body}`)
    .join("\n");

  const llm = await openAiChatCompletion(
    "You assist SMS inbox agents. Return valid JSON with keys: summary, suggestedReply, intent, urgency (high|normal), suggestedTags (array), suggestedNextAction, optOutRisk (boolean), unansweredQuestions (array). Be concise and professional.",
    `Contact name: ${contactName || "Customer"}\n\nThread:\n${threadText}`,
    { temperature: 0.4, maxTokens: 700 },
  );

  if (!llm) return heuristic;

  try {
    const parsed = JSON.parse(llm) as Partial<InboxAssistResult>;
    return {
      summary: String(parsed.summary || heuristic.summary),
      suggestedReply: String(parsed.suggestedReply || heuristic.suggestedReply),
      intent: String(parsed.intent || heuristic.intent),
      urgency: String(parsed.urgency || heuristic.urgency),
      suggestedTags: Array.isArray(parsed.suggestedTags)
        ? parsed.suggestedTags.map(String)
        : heuristic.suggestedTags,
      suggestedNextAction: String(parsed.suggestedNextAction || heuristic.suggestedNextAction),
      optOutRisk: Boolean(parsed.optOutRisk ?? heuristic.optOutRisk),
      unansweredQuestions: Array.isArray(parsed.unansweredQuestions)
        ? parsed.unansweredQuestions.map(String)
        : heuristic.unansweredQuestions,
      mode: "openai",
    };
  } catch {
    return {
      ...heuristic,
      summary: llm.slice(0, 200),
      mode: "openai",
    };
  }
}
