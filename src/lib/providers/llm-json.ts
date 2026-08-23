import { logProviderRun } from "@/lib/providers/dataforseo";
import {
  estimateProviderCost,
  fetchWithTimeout,
  providerTimeoutMs,
} from "@/lib/providers/fetch-with-timeout";

export type JsonLlmResult = {
  ok: boolean;
  content: string | null;
  provider: string;
  statusCode: number;
  error?: string;
};

export async function callJsonLlm(params: {
  organizationId?: string;
  endpoint: string;
  systemPrompt: string;
  userContent: string;
  temperature?: number;
}): Promise<JsonLlmResult> {
  const temperature = params.temperature ?? 0.1;
  const attempts: Array<() => Promise<JsonLlmResult>> = [
    () => callDeepSeek(params, temperature),
    () => callGemini(params, temperature),
    () => callKimi(params, temperature),
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok && result.content) return result;
    if (result.error) errors.push(`${result.provider}: ${result.error}`);
  }

  return {
    ok: false,
    content: null,
    provider: "none",
    statusCode: 0,
    error: errors.join("; ") || "All LLM providers failed",
  };
}

async function callDeepSeek(
  params: { organizationId?: string; endpoint: string; systemPrompt: string; userContent: string },
  temperature: number
): Promise<JsonLlmResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, content: null, provider: "deepseek", statusCode: 0, error: "missing API key" };

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userContent },
          ],
          response_format: { type: "json_object" },
          temperature,
        }),
      },
      { provider: "deepseek", timeoutMs: providerTimeoutMs("deepseek", 60_000), label: params.endpoint }
    );
    const latencyMs = Date.now() - start;
    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: params.endpoint,
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
      costEstimate: estimateProviderCost("deepseek"),
    });
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
      return { ok: false, content: null, provider: "deepseek", statusCode: res.status, error: msg };
    }
    const content = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? null;
    return { ok: !!content, content, provider: "deepseek", statusCode: res.status };
  } catch (err) {
    return {
      ok: false,
      content: null,
      provider: "deepseek",
      statusCode: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

async function callGemini(
  params: { organizationId?: string; endpoint: string; systemPrompt: string; userContent: string },
  temperature: number
): Promise<JsonLlmResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { ok: false, content: null, provider: "gemini", statusCode: 0, error: "missing API key" };

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: params.userContent }] }],
          generationConfig: { responseMimeType: "application/json", temperature },
        }),
      },
      { provider: "gemini", timeoutMs: providerTimeoutMs("gemini", 60_000), label: params.endpoint }
    );
    const latencyMs = Date.now() - start;
    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "gemini",
      endpoint: params.endpoint,
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
      costEstimate: estimateProviderCost("gemini"),
    });
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
      return { ok: false, content: null, provider: "gemini", statusCode: res.status, error: msg };
    }
    const content =
      (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("\n") ?? null;
    return { ok: !!content, content, provider: "gemini", statusCode: res.status };
  } catch (err) {
    return {
      ok: false,
      content: null,
      provider: "gemini",
      statusCode: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

async function callKimi(
  params: { organizationId?: string; endpoint: string; systemPrompt: string; userContent: string },
  temperature: number
): Promise<JsonLlmResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return { ok: false, content: null, provider: "kimi", statusCode: 0, error: "missing API key" };

  const model = process.env.KIMI_MODEL ?? "moonshot-v1-8k";
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.moonshot.cn/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userContent },
          ],
          response_format: { type: "json_object" },
          temperature,
        }),
      },
      { provider: "kimi", timeoutMs: providerTimeoutMs("kimi", 60_000), label: params.endpoint }
    );
    const latencyMs = Date.now() - start;
    const data = await res.json();
    await logProviderRun({
      organizationId: params.organizationId,
      provider: "kimi",
      endpoint: params.endpoint,
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
      costEstimate: estimateProviderCost("kimi"),
    });
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
      return { ok: false, content: null, provider: "kimi", statusCode: res.status, error: msg };
    }
    const content = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? null;
    return { ok: !!content, content, provider: "kimi", statusCode: res.status };
  } catch (err) {
    return {
      ok: false,
      content: null,
      provider: "kimi",
      statusCode: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}
