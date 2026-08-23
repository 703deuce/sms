import { logProviderRun } from "@/lib/providers/dataforseo";
import { wrapUntrustedContext } from "@/lib/security/prompt-guard";

export interface GroundedResearchResult {
  answer: string;
  sources: Array<{ title?: string; uri?: string }>;
  searchSuggestions?: string[];
}

export async function groundedResearch(params: {
  question: string;
  organizationId?: string;
}): Promise<GroundedResearchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const start = Date.now();
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: wrapUntrustedContext("RESEARCH_QUESTION", params.question) }] }],
        tools: [{ googleSearch: {} }],
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await res.json();

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "gemini",
      endpoint: "generateContent",
      request: { question: params.question },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text).join("\n") ?? "";
    const grounding = candidate?.groundingMetadata;
    const sources =
      grounding?.groundingChunks?.map((c: { web?: { title?: string; uri?: string } }) => ({
        title: c.web?.title,
        uri: c.web?.uri,
      })) ?? [];
    const searchSuggestions =
      grounding?.searchEntryPoint?.renderedContent
        ? [grounding.searchEntryPoint.renderedContent]
        : [];

    return { answer: text, sources, searchSuggestions };
  } catch {
    return null;
  }
}
