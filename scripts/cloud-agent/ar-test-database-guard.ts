/**
 * Ensures AR DB integration tests can reach Supabase.
 *
 * Default (Cloud Agent): hydrates NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * from the production web container via Coolify SSH — no extra Cloud Agent secrets.
 *
 * Optional override: AR_TEST_SUPABASE_URL + AR_TEST_SUPABASE_SERVICE_ROLE_KEY.
 */
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  applyArTestSupabaseEnvOverrides,
  hydrateProdSupabaseFromCoolify,
} from "./hydrate-prod-test-env";

export class ArTestDatabaseSkip extends Error {
  readonly code = "AR_TEST_DATABASE_SKIP";
}

/** Call at start of AR DB integration scripts. */
export function requireIsolatedArTestDatabase(): void {
  applyArTestSupabaseEnvOverrides();
  if (!isSupabaseConfigured()) {
    hydrateProdSupabaseFromCoolify();
  }
  if (!isSupabaseConfigured()) {
    throw new ArTestDatabaseSkip(
      "Supabase not configured — need coolify-server SSH or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.",
    );
  }
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
