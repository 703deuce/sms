import { logProviderRun } from "@/lib/providers/dataforseo";
import { actionPlanOutputSchema } from "@/lib/validation/schemas";

const BASE_URL = "https://api.deepseek.com/v1";

export interface ActionPlanOutput {
  summary: string;
  actions: Array<{
    title: string;
    description: string;
    bucket: "relevance" | "distance" | "prominence" | "trust";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    reason_code: string;
    evidence_refs: string[];
  }>;
}

export async function generateActionPlan(params: {
  findings: Array<{
    finding_type: string;
    bucket: string;
    severity: string;
    metric_key?: string | null;
    metric_value?: string | null;
    evidence_json?: unknown;
  }>;
  businessName: string;
  keyword: string;
  model?: string;
  organizationId?: string;
}): Promise<ActionPlanOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = params.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a Google Maps local SEO advisor. Convert structured audit findings into a plain-English weekly action plan.
Return ONLY valid JSON with this shape:
{"summary":"...","actions":[{"title":"...","description":"...","bucket":"relevance|distance|prominence|trust","impact":"low|medium|high","effort":"low|medium|high","reason_code":"...","evidence_refs":["finding_type"]}]}
Prioritize 3-7 actions. Distance findings should note limited actionability when geography is the blocker.`;

  const userPrompt = JSON.stringify({
    business: params.businessName,
    keyword: params.keyword,
    findings: params.findings,
  });

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
          { role: "user", content: userPrompt },
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
      endpoint: "chat/completions",
      request: { model, findingsCount: params.findings.length },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = actionPlanOutputSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
