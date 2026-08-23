import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export interface ReviewMomentumAiOutput {
  summary: string;
  key_findings: string[];
  recommended_weekly_target: number;
  tasks: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    evidence: string;
  }>;
}

export async function generateReviewMomentumAnalysis(params: {
  payload: Record<string, unknown>;
  model?: string;
  organizationId?: string;
}): Promise<ReviewMomentumAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = params.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO strategist. Analyze Google Business Profile review momentum.
Use only the provided metrics. Do not invent data.
Explain what is happening in plain English for a business owner.
Return JSON only with shape:
{"summary":"...","key_findings":["..."],"recommended_weekly_target":number,"tasks":[{"title":"...","description":"...","priority":"low|medium|high","impact":"low|medium|high","effort":"low|medium|high","evidence":"..."}]}`;

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
      endpoint: "review-momentum",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ReviewMomentumAiOutput;
  } catch {
    return null;
  }
}

export function fallbackReviewMomentumTasks(gap: number, weeklyTarget: number): ReviewMomentumAiOutput["tasks"] {
  return [
    {
      title: "Ask every completed customer for a review this week",
      description: `Send a review request within 24 hours of each job. Target ${weeklyTarget} reviews/week to close the ${gap}-review gap.`,
      priority: "high",
      impact: "high",
      effort: "low",
      evidence: "review_gap",
    },
    {
      title: "Add review link to SMS follow-up",
      description: "Include a direct Google review link in your post-job text message template.",
      priority: "high",
      impact: "high",
      effort: "low",
      evidence: "review_velocity",
    },
    {
      title: "Reply to all new reviews within 24 hours",
      description: "Respond to every new review promptly to signal active profile management.",
      priority: "medium",
      impact: "medium",
      effort: "low",
      evidence: "review_recency",
    },
    {
      title: "Re-run Review Momentum audit next week",
      description: "Track whether your weekly review pace is closing the competitor gap.",
      priority: "low",
      impact: "medium",
      effort: "low",
      evidence: "monitoring",
    },
  ];
}
