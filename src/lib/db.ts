/**
 * App data access.
 *
 * Primary (LSE-style): Supabase service role via getSupabaseAdmin()
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Legacy fallback: Prisma via DATABASE_URL (still supported during migration).
 */
import type { PrismaClient } from "@prisma/client";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export { getSupabaseAdmin, isSupabaseConfigured, createBrowserSupabase } from "@/lib/supabase/admin";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * @deprecated Prefer getSupabaseAdmin().from('Table') — Prisma remains only as a
 * temporary fallback when DATABASE_URL is set and Supabase is not.
 */
export function getPrisma(): PrismaClient {
  if (isSupabaseConfigured() && !process.env.DATABASE_URL) {
    throw new Error(
      "This code path still uses Prisma. Set DATABASE_URL to your Supabase Postgres URI " +
        "(Project Settings → Database), or wait for this module to finish migrating to getSupabaseAdmin().",
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY " +
        "(and DATABASE_URL for any remaining Prisma call sites).",
    );
  }

  if (!globalForPrisma.prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
    globalForPrisma.prisma = new Client({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}

/** @deprecated Prefer getPrisma() / getSupabaseAdmin() */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
