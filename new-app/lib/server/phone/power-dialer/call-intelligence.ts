/** P27 / M68 — structured conversation intelligence from transcript (no fake AI label on raw excerpt). */

export type ConversationIntelligence = {
  modelDerived: true;
  provider: "transcript_rules_v1";
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  actionItems: string[];
  topics: string[];
  objections: string[];
  keywords: string[];
  qualityScore: number;
};

const TOPIC_RULES: { topic: string; patterns: RegExp[] }[] = [
  { topic: "Pricing", patterns: [/price|cost|afford|budget|expensive/i] },
  { topic: "Scheduling", patterns: [/schedule|appointment|tomorrow|next week|calendar/i] },
  { topic: "Product fit", patterns: [/interested|not interested|looking for|need/i] },
  { topic: "Support", patterns: [/problem|issue|broken|help/i] },
];

function tokenizeKeywords(transcript: string): string[] {
  const words = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

function detectSentiment(transcript: string): ConversationIntelligence["sentiment"] {
  const t = transcript.toLowerCase();
  const pos = [/thank|great|sounds good|yes|perfect|interested/].filter((re) => re.test(t)).length;
  const neg = [/no|not interested|stop|angry|frustrat|never/].filter((re) => re.test(t)).length;
  if (pos > 0 && neg > 0) return "mixed";
  if (neg > pos) return "negative";
  if (pos > 0) return "positive";
  return "neutral";
}

function buildActionItems(transcript: string): string[] {
  const items: string[] = [];
  const t = transcript.toLowerCase();
  if (t.includes("call back") || t.includes("callback")) items.push("Schedule callback at agreed time.");
  if (t.includes("email") || t.includes("send me")) items.push("Send requested information by email.");
  if (t.includes("not interested")) items.push("Mark disposition and respect opt-out if stated.");
  if (t.includes("appointment") || t.includes("book")) items.push("Confirm appointment details in CRM.");
  if (!items.length) items.push("Review transcript and set next disposition.");
  return items.slice(0, 4);
}

function scoreCall(transcript: string, sentiment: ConversationIntelligence["sentiment"]): number {
  const len = transcript.trim().length;
  let score = 50;
  if (len > 200) score += 15;
  if (len > 800) score += 10;
  if (sentiment === "positive") score += 20;
  if (sentiment === "negative") score -= 15;
  if (sentiment === "mixed") score += 5;
  return Math.max(0, Math.min(100, score));
}

export function buildConversationIntelligence(transcript: string): ConversationIntelligence {
  const trimmed = transcript.trim();
  const topics = TOPIC_RULES.filter((r) => r.patterns.some((p) => p.test(trimmed))).map((r) => r.topic);
  const objections: string[] = [];
  if (/not interested/i.test(trimmed)) objections.push("Not interested");
  if (/too expensive/i.test(trimmed)) objections.push("Price objection");
  if (/call me later/i.test(trimmed)) objections.push("Timing objection");
  if (/already have/i.test(trimmed)) objections.push("Incumbent vendor");
  if (/don't call/i.test(trimmed)) objections.push("Do not call");
  const sentiment = detectSentiment(trimmed);
  const actionItems = buildActionItems(trimmed);
  const keywords = tokenizeKeywords(trimmed);
  const summaryParts = [
    topics.length ? `Topics: ${topics.join(", ")}.` : null,
    objections.length ? `Objections detected.` : null,
    `Sentiment: ${sentiment}.`,
    trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed,
  ].filter(Boolean);
  return {
    modelDerived: true,
    provider: "transcript_rules_v1",
    summary: summaryParts.join(" "),
    sentiment,
    actionItems,
    topics,
    objections,
    keywords,
    qualityScore: scoreCall(trimmed, sentiment),
  };
}

export function serializeIntelligenceForStorage(intel: ConversationIntelligence): string {
  return JSON.stringify(intel);
}

export function parseStoredIntelligence(raw: string | null): ConversationIntelligence | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as ConversationIntelligence;
    if (j && j.modelDerived && j.summary) return j;
  } catch {
    return null;
  }
  return null;
}
