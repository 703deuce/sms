import { logProviderRun } from "@/lib/providers/dataforseo";
import { wrapUntrustedContext } from "@/lib/security/prompt-guard";

const BASE_URL = "https://api.moonshot.cn/v1";

export async function analyzeScreenshot(params: {
  imageBase64: string;
  prompt: string;
  organizationId?: string;
}): Promise<string | null> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return null;

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: wrapUntrustedContext("USER_PROMPT", params.prompt) },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${params.imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await res.json();

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "kimi",
      endpoint: "chat/completions",
      request: { prompt: params.prompt.slice(0, 100) },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
