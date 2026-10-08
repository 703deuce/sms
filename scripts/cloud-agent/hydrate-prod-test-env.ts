/**
 * Cloud Agent: copy non-secret + secret env vars needed for AR backend verification
 * from production web container when local process.env is empty.
 * Does not print secret values.
 */
import { execFileSync } from "node:child_process";
import { isSupabaseConfigured } from "../../src/lib/supabase/admin";
import { providers } from "../../src/lib/ai/llm-providers";

const PROD_WEB_CONTAINER_FILTER =
  process.env.MCTB_PROD_WEB_CONTAINER_FILTER?.trim() || "ds8s3hjin60qs6g7s0iqkixs";

const VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "AR_AI_RESCHEDULER_MODEL",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
];

export function hydrateProdTestEnvFromCoolify(): { supabase: boolean; llm: boolean } {
  const needSupabase = !isSupabaseConfigured();
  const needLlm = providers().length === 0;
  if (!needSupabase && !needLlm) {
    return { supabase: true, llm: true };
  }

  if (process.env.MCTB_HYDRATE_LLM_FROM_PROD === "0") {
    return { supabase: isSupabaseConfigured(), llm: providers().length > 0 };
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
      { encoding: "utf8", maxBuffer: 128_000 },
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

    if (applied > 0) {
      console.info(`[hydrate-prod-test-env] Loaded ${applied} env var(s) from production web.`);
    }
  } catch (err) {
    console.warn(
      "[hydrate-prod-test-env] Could not hydrate from Coolify:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return {
    supabase: isSupabaseConfigured(),
    llm: providers().length > 0,
  };
}
