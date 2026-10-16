/**
 * Cloud Agent: copy env vars needed for AR verification/tests from production web
 * container when local process.env is empty. Does not print secret values.
 *
 * Includes Supabase service role + LLM keys (no separate Cloud Agent secrets required).
 */
import { execFileSync } from "node:child_process";
import { isSupabaseConfigured } from "../../src/lib/supabase/admin";
import { providers } from "../../src/lib/ai/llm-providers";

const PROD_WEB_CONTAINER_FILTER =
  process.env.MCTB_PROD_WEB_CONTAINER_FILTER?.trim() || "ds8s3hjin60qs6g7s0iqkixs";

const VARS = [
  "TELNYX_API_KEY",
  "DATABASE_URL",
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

function hydrateFromCoolify(vars: string[]): number {
  if (process.env.MCTB_HYDRATE_LLM_FROM_PROD === "0" && process.env.MCTB_HYDRATE_FROM_PROD === "0") {
    return 0;
  }

  const remote = [
    "set -euo pipefail",
    `cid=$(docker ps --filter name=${PROD_WEB_CONTAINER_FILTER} --format '{{.ID}}' | head -1)`,
    'if [ -z "$cid" ]; then exit 2; fi',
    ...vars.map(
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
      if (!value.trim() || !vars.includes(key)) continue;
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
        applied += 1;
      }
    }
    return applied;
  } catch (err) {
    console.warn(
      "[hydrate-prod-test-env] Could not hydrate from Coolify:",
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

/** Optional override: AR_TEST_SUPABASE_* copies into standard Supabase env names. */
export function applyArTestSupabaseEnvOverrides(): boolean {
  const url =
    process.env.AR_TEST_SUPABASE_URL?.trim() ||
    process.env.AR_TEST_NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.AR_TEST_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  return true;
}

export function hydrateProdDatabaseUrlFromCoolify(): boolean {
  if (process.env.DATABASE_URL?.trim()) return true;
  const applied = hydrateFromCoolify(["DATABASE_URL"]);
  if (applied > 0) {
    console.info(`[hydrate-prod-test-env] Loaded DATABASE_URL from production web.`);
  }
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function hydrateProdSupabaseFromCoolify(): boolean {
  if (isSupabaseConfigured()) return true;
  const applied = hydrateFromCoolify([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
  ]);
  if (applied > 0) {
    console.info(`[hydrate-prod-test-env] Loaded ${applied} Supabase env var(s) from production web.`);
  }
  return isSupabaseConfigured();
}

export function hydrateProdTestEnvFromCoolify(): { supabase: boolean; llm: boolean } {
  applyArTestSupabaseEnvOverrides();

  const needSupabase = !isSupabaseConfigured();
  const needLlm = providers().length === 0;

  if (!needSupabase && !needLlm) {
    return { supabase: true, llm: true };
  }

  const toLoad = needSupabase
    ? VARS
    : VARS.filter((v) => !v.startsWith("NEXT_PUBLIC_SUPABASE") && !v.startsWith("SUPABASE_"));

  const applied = hydrateFromCoolify(toLoad.length ? toLoad : VARS);
  if (applied > 0) {
    console.info(`[hydrate-prod-test-env] Loaded ${applied} env var(s) from production web.`);
  }

  return {
    supabase: isSupabaseConfigured(),
    llm: providers().length > 0,
  };
}
