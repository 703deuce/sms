/**
 * Cloud Agent: copy LLM API keys from production web container when local process.env is empty.
 * Does not print secret values. Safe to call before MCTB dialogue smoke tests.
 */
import { execFileSync } from "node:child_process";
import { providers } from "../../src/lib/ai/llm-providers";

const PROD_WEB_CONTAINER_FILTER =
  process.env.MCTB_PROD_WEB_CONTAINER_FILTER?.trim() || "ds8s3hjin60qs6g7s0iqkixs";

const VARS = [
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
];

export function hydrateProdLlmEnvFromCoolify(): boolean {
  if (providers().length > 0) {
    return true;
  }

  if (process.env.MCTB_HYDRATE_LLM_FROM_PROD === "0") {
    return false;
  }

  const remote = [
    "set -euo pipefail",
    `cid=$(docker ps --filter name=${PROD_WEB_CONTAINER_FILTER} --format '{{.ID}}' | head -1)`,
    'if [ -z "$cid" ]; then exit 2; fi',
    ...VARS.map(
      (v) =>
        `val=$(docker exec "$cid" printenv ${v} 2>/dev/null || true); if [ -n "$val" ]; then printf '%s=%s\\n' '${v}' "$val"; fi`,
    ),
  ].join("; ");

  try {
    const out = execFileSync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=20",
        "coolify-server",
        "bash",
        "-lc",
        remote,
      ],
      { encoding: "utf8", maxBuffer: 64_000 },
    );

    let applied = 0;
    for (const line of out.split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (!value.trim() || !VARS.includes(key)) continue;
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
        applied += 1;
      }
    }

    if (providers().length > 0) {
      console.info(
        `[hydrate-prod-llm-env] Loaded ${applied} LLM env var(s) from production web (provider: ${providers()[0].id}).`,
      );
      return true;
    }
    return false;
  } catch (err) {
    console.warn(
      "[hydrate-prod-llm-env] Could not hydrate from Coolify:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
