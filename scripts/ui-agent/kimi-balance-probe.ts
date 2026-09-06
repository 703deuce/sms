#!/usr/bin/env tsx
import { loadKimiConfig } from "./config";
import { kimiFetch } from "./kimi-http";

async function main(): Promise<void> {
  const cfg = loadKimiConfig();
  console.log("baseUrl:", cfg.baseUrl);
  console.log("model:", cfg.model);

  const modelsRes = await fetch(`${cfg.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  console.log("GET /models:", modelsRes.status, modelsRes.statusText);

  const res = await kimiFetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 5,
    }),
    timeoutMs: 60_000,
    label: "balance-probe",
    maxRetries: 0,
  });
  const text = await res.text();
  console.log("POST /chat/completions:", res.status);
  console.log(text.slice(0, 500));
}

main().catch((err) => {
  console.error("PROBE FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
