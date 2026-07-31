type ThreadMessage = {
  direction: "inbound" | "outbound" | "note";
  body: string;
  at?: string;
};

export function analyzeInboxThread(messages: ThreadMessage[], contactName?: string) {
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
  };
}
