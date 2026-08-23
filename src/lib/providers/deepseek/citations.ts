import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export interface CitationAiOutput {
  summary: string;
  top_issues: string[];
  opportunities: string[];
  tasks: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    evidence: string;
  }>;
}

export async function generateCitationAnalysis(params: {
  payload: Record<string, unknown>;
  organizationId?: string;
}): Promise<CitationAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO strategist. Analyze citation audit data.
Do not invent listings. Only use provided found, missing, and mismatch data.
Explain in plain English what the business should fix first. Return JSON only with shape:
{"summary":"...","top_issues":["..."],"opportunities":["..."],"tasks":[{"title":"...","description":"...","priority":"low|medium|high","impact":"low|medium|high","effort":"low|medium|high","evidence":"..."}]}`;

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
      endpoint: "citations",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as CitationAiOutput;
  } catch {
    return null;
  }
}

export function fallbackCitationTasks(missing: string[], napIssues: string[]): CitationAiOutput {
  const tasks: CitationAiOutput["tasks"] = [];
  for (const src of missing.slice(0, 5)) {
    tasks.push({
      title: `Create or claim listing on ${src}`,
      description: `Your business was not found on ${src}. Add a complete NAP listing.`,
      priority: "high",
      impact: "high",
      effort: "medium",
      evidence: `Missing from ${src}`,
    });
  }
  for (const issue of napIssues.slice(0, 3)) {
    tasks.push({
      title: `Fix NAP on ${issue.split(":")[0] ?? "listing"}`,
      description: issue,
      priority: "high",
      impact: "medium",
      effort: "low",
      evidence: issue,
    });
  }
  return {
    summary:
      missing.length > 0
        ? `Found citation gaps on ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " and others" : ""}. Fix NAP mismatches next.`
        : "Citation listings found. Review NAP consistency across directories.",
    top_issues: napIssues.slice(0, 3),
    opportunities: missing.slice(0, 5),
    tasks,
  };
}
