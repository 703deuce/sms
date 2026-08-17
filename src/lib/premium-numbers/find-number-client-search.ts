import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";

export async function runPremiumNumberSearch(
  body: Record<string, unknown>,
  onData: (data: PremiumSearchProductResponse) => void,
): Promise<{ durationSec: number; completedAt: Date }> {
  const started = performance.now();
  const res = await fetch("/api/numbers/premium/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Search failed");
  }

  if (contentType.includes("application/x-ndjson") && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line) as {
          type: string;
          data?: PremiumSearchProductResponse;
          error?: string;
        };
        if (msg.type === "error") throw new Error(msg.error || "Search failed");
        if (!msg.data) continue;
        onData(msg.data);
      }
    }
  } else {
    const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
    onData(data);
  }

  const durationSec = Math.round(((performance.now() - started) / 1000) * 10) / 10;
  return { durationSec, completedAt: new Date() };
}
