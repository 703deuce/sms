import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * LSE-style Supabase clients.
 *
 * Env (same as Local SEO Express):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY  (server-only)
 */

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Configure Supabase the same way as Local SEO Express (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).`,
    );
  }
  return value;
}

export function getSupabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** Browser / anon client — respects RLS. */
export function createBrowserSupabase() {
  return createClient(getSupabaseUrl(), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

const globalForAdmin = globalThis as unknown as { __supabaseAdmin?: SupabaseClient };

/**
 * Server admin client — service role, bypasses RLS.
 * Use only in API routes, workers, webhooks, and server libs.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!globalForAdmin.__supabaseAdmin) {
    globalForAdmin.__supabaseAdmin = createClient(
      getSupabaseUrl(),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return globalForAdmin.__supabaseAdmin;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
