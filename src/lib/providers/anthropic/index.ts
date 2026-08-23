import { logProviderRun } from "@/lib/providers/dataforseo";

export type ClaudeSearchResult = {
  answer: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
  fanouts: string[];
};

export type ClaudeSearchOutcome =
  | { ok: true; result: ClaudeSearchResult }
  | { ok: false; error: string };

function claudeLiveSearchModel(): string {
  // Sonnet supports web search reliably; override via env if needed.
  return process.env.ANTHROPIC_GEO_LIVE_SEARCH_MODEL?.trim() || "claude-sonnet-4-5";
}

function claudeWebSearchToolSpec(maxUses = 8): Record<string, unknown> {
  const t = process.env.ANTHROPIC_GEO_WEB_SEARCH_TOOL?.trim();
  const type =
    t === "web_search_20260209" || t === "web_search_20250305" || t === "web_search_20260318"
      ? t
      : "web_search_20250305";
  return { type, name: "web_search", max_uses: maxUses };
}

function anthropicErrorMessage(data: Record<string, unknown>, status: number): string {
  const err = data.error;
  if (err && typeof err === "object" && !Array.isArray(err)) {
    const obj = err as Record<string, unknown>;
    const msg = typeof obj.message === "string" ? obj.message : null;
    const typ = typeof obj.type === "string" ? obj.type : null;
    if (msg && typ) return `Anthropic ${status} (${typ}): ${msg}`;
    if (msg) return `Anthropic ${status}: ${msg}`;
  }
  if (typeof data.message === "string") return `Anthropic ${status}: ${data.message}`;
  return `Anthropic web search failed (${status})`;
}

function parseClaudeContent(content: Array<Record<string, unknown>>): ClaudeSearchResult {
  let answer = "";
  const sources: ClaudeSearchResult["sources"] = [];
  const fanouts: string[] = [];

  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      answer += block.text;
    }
    if (block.type === "web_search_tool_result") {
      const results = (block.content as Array<Record<string, unknown>>) ?? [];
      for (const r of results) {
        if (r.type === "web_search_result") {
          sources.push({
            url: r.url as string,
            label: (r.title as string) ?? undefined,
            position: sources.length + 1,
          });
        }
      }
    }
    if (block.type === "server_tool_use" && typeof block.input === "object" && block.input) {
      const input = block.input as Record<string, unknown>;
      if (typeof input.query === "string") fanouts.push(input.query);
    }
  }

  return { answer: answer.trim(), sources, fanouts };
}

export async function claudeWebSearchDetailed(params: {
  prompt: string;
  city?: string;
  state?: string;
  organizationId?: string;
}): Promise<ClaudeSearchOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Claude requires ANTHROPIC_API_KEY — add to .env.local / Coolify and restart",
    };
  }

  const model = claudeLiveSearchModel();
  const start = Date.now();

  const tool = claudeWebSearchToolSpec(8) as Record<string, unknown>;
  if (params.city && params.state) {
    tool.user_location = {
      type: "approximate",
      city: params.city,
      region: params.state,
      country: "US",
    };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: params.prompt }],
        tools: [tool],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const latencyMs = Date.now() - start;
    const data = (await res.json()) as Record<string, unknown>;

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "anthropic",
      endpoint: "messages",
      request: { model, prompt: params.prompt },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) {
      return { ok: false, error: anthropicErrorMessage(data, res.status) };
    }

    const content = (data.content as Array<Record<string, unknown>>) ?? [];
    const parsed = parseClaudeContent(content);
    if (!parsed.answer) {
      return { ok: false, error: "Claude returned an empty response" };
    }
    return { ok: true, result: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude request failed";
    return { ok: false, error: message };
  }
}

export async function claudeWebSearch(params: {
  prompt: string;
  city?: string;
  state?: string;
  organizationId?: string;
}): Promise<ClaudeSearchResult | null> {
  const outcome = await claudeWebSearchDetailed(params);
  return outcome.ok ? outcome.result : null;
}
