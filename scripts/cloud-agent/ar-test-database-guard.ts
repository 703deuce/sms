/**
 * Guards AR integration tests from mutating production Supabase.
 *
 * Set isolated staging credentials:
 *   AR_TEST_SUPABASE_URL
 *   AR_TEST_SUPABASE_SERVICE_ROLE_KEY
 * (and optionally AR_TEST_NEXT_PUBLIC_SUPABASE_URL for anon)
 *
 * Production Coolify hydrate must NOT be used for destructive DB tests.
 */
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export class ArTestDatabaseSkip extends Error {
  readonly code = "AR_TEST_DATABASE_SKIP";
}

export function applyArTestSupabaseEnv(): boolean {
  const url =
    process.env.AR_TEST_SUPABASE_URL?.trim() ||
    process.env.AR_TEST_NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.AR_TEST_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  return true;
}

/** Call at start of destructive AR DB integration scripts. */
export function requireIsolatedArTestDatabase(): void {
  if (process.env.AR_ALLOW_PROD_SUPABASE_TESTS === "1") {
    throw new ArTestDatabaseSkip(
      "AR_ALLOW_PROD_SUPABASE_TESTS=1 is disabled for Cloud Agent runs — use AR_TEST_SUPABASE_* staging project.",
    );
  }
  if (applyArTestSupabaseEnv()) {
    if (!isSupabaseConfigured()) {
      throw new ArTestDatabaseSkip("AR_TEST_SUPABASE_* set but Supabase client still not configured.");
    }
    return;
  }
  throw new ArTestDatabaseSkip(
    "CONFIGURATION REQUIRED — set AR_TEST_SUPABASE_URL and AR_TEST_SUPABASE_SERVICE_ROLE_KEY (isolated staging). Destructive tests do not run against production.",
  );
}

export function isArTestDatabaseAvailable(): boolean {
  try {
    requireIsolatedArTestDatabase();
    return true;
  } catch (e) {
    if (e instanceof ArTestDatabaseSkip) return false;
    throw e;
  }
}
