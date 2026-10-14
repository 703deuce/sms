import { logProviderRun } from "@/lib/providers/dataforseo";
import { wrapUntrustedContext } from "@/lib/security/prompt-guard";

const BASE_URL = "https://api.deepseek.com/v1";

export interface ReputationAiOutput {
  summary: string;
  top_findings: string[];
  keyword_gaps: string[];
  competitor_insights: string[];
  tasks: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    evidence: string;
  }>;
}

export async function generateReputationAnalysis(params: {
  payload: Record<string, unknown>;
  organizationId?: string;
}): Promise<ReputationAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO reputation strategist. Analyze review momentum, review keywords, competitor review gaps, and response gaps.
Use only the provided data. Do not invent reviews or metrics. Return JSON only with shape:
{"summary":"...","top_findings":["..."],"keyword_gaps":["..."],"competitor_insights":["..."],"tasks":[{"title":"...","description":"...","priority":"low|medium|high","impact":"low|medium|high","effort":"low|medium|high","evidence":"..."}]}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(params.payload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await res.json();

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "reputation",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ReputationAiOutput;
  } catch {
    return null;
  }
}

export async function generateReviewResponseDraft(params: {
  businessName: string;
  reviewText: string;
  rating: number | null;
  serviceKeywords?: string[];
  organizationId?: string;
}): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const systemPrompt = `You write professional Google review replies for a local business. Keep responses short, natural, and specific.
Do not make claims not present in the review. Do not offer discounts. Do not sound robotic.
Return JSON only: {"draft_text":"..."}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              businessName: params.businessName,
              reviewText: wrapUntrustedContext("REVIEW_TEXT", params.reviewText),
              rating: params.rating,
              serviceKeywords: params.serviceKeywords ?? [],
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    const data = await res.json();
    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { draft_text?: string };
    return parsed.draft_text ?? null;
  } catch {
    return null;
  }
}

export function fallbackReputationTasks(params: {
  reviewGap: number;
  weeklyTarget: number;
  unanswered: number;
  keywordGaps: string[];
}): ReputationAiOutput {
  const tasks: ReputationAiOutput["tasks"] = [
    {
      title: `Get ${params.weeklyTarget} reviews this week`,
      description: `You need ${params.reviewGap} more reviews in the last 30 days to match top competitors.`,
      priority: "high",
      impact: "high",
      effort: "medium",
      evidence: `Review gap: ${params.reviewGap}`,
    },
  ];
  if (params.unanswered > 0) {
    tasks.push({
      title: `Respond to ${params.unanswered} unanswered reviews`,
      description: "Reply to recent reviews to improve trust and response rate.",
      priority: "high",
      impact: "medium",
      effort: "low",
      evidence: `${params.unanswered} reviews without owner response`,
    });
  }
  for (const kw of params.keywordGaps.slice(0, 2)) {
    tasks.push({
      title: `Ask customers to mention "${kw}" in reviews`,
      description: `Competitors use this theme more often in their review text.`,
      priority: "medium",
      impact: "medium",
      effort: "low",
      evidence: `Keyword gap: ${kw}`,
    });
  }
  return {
    summary: `Focus on ${params.weeklyTarget} reviews per week and respond to unanswered feedback.`,
    top_findings: [],
    keyword_gaps: params.keywordGaps.slice(0, 3),
    competitor_insights: [],
    tasks,
  };
}

export interface ReviewRequestTemplatesOutput {
  sms_template: string;
  email_subject: string;
  email_template: string;
  generic_template: string;
}

export async function generateReviewRequestTemplates(params: {
  businessName: string;
  reviewUrl: string;
  keywordSuggestions?: string[];
  tone?: string;
  organizationId?: string;
}): Promise<ReviewRequestTemplatesOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const systemPrompt = `You write short review request messages for local businesses. Keep them ethical, natural, and compliant.
Do not ask for fake reviews. Do not offer incentives. Do not pressure customers.
Encourage customers to mention the real service they received.
Use placeholders: {{customer_name}}, {{business_name}}, {{review_link}}, {{service_type}} where appropriate.
Return JSON only: {"sms_template":"...","email_subject":"...","email_template":"...","generic_template":"..."}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              businessName: params.businessName,
              reviewUrl: params.reviewUrl,
              keywordSuggestions: params.keywordSuggestions ?? [],
              tone: params.tone ?? "friendly",
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    const data = await res.json();
    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ReviewRequestTemplatesOutput;
  } catch {
    return null;
  }
}

export function fallbackReviewRequestTemplates(params: {
  businessName: string;
  reviewUrl: string;
}): ReviewRequestTemplatesOutput {
  return {
    sms_template: `Hey {{customer_name}}, thanks again for choosing ${params.businessName}. Would you mind leaving us a quick Google review? Here's the link: {{review_link}}`,
    email_subject: `Quick favor — Google review for ${params.businessName}`,
    email_template: `Hi {{customer_name}},\n\nThank you for choosing ${params.businessName}. If you had a good experience, we'd appreciate a quick Google review:\n\n{{review_link}}\n\nThanks,\n${params.businessName}`,
    generic_template: `Thank you for your business! Please leave us a Google review: {{review_link}}`,
  };
}
