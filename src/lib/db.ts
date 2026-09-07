/**
 * Database accessor — Supabase only (LSE-style).
 * getPrisma() is kept as a name alias so existing call sites keep working.
 */
import { getSupabaseDb, type AppDb, type DbRow, DbError } from "@/lib/supabase/prisma-compat";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export { getSupabaseAdmin, isSupabaseConfigured, createBrowserSupabase } from "@/lib/supabase/admin";
export { DbError };
export type { AppDb, DbRow };

/** Supabase-backed DB (same call shape as former Prisma client for this app). */
export function getPrisma(): AppDb {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same as Local SEO Express).",
    );
  }
  return getSupabaseDb();
}

/** @deprecated Prefer getPrisma() */
export const prisma = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
