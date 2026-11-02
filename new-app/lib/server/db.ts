// Canonical schema: `new-app/prisma/schema.prisma` (generate via `pnpm prisma generate --schema=prisma/schema.prisma`).
import { PrismaClient } from "@prisma/client";

export type DbRow = Record<string, unknown>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase transaction pooler (port 6543) shares a small server-side pool (often ~15).
 * Each Node process must use a low Prisma `connection_limit` and `pgbouncer=true`.
 * Set DATABASE_CONNECTION_LIMIT to override the default (3 on pooler, unset on direct).
 */
export function resolvePrismaDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const pgbouncerModeOff = process.env.PRISMA_PGBOUNCER_MODE?.trim().toLowerCase() === "off";
    const isPooler =
      url.port === "6543" ||
      url.hostname.includes("pooler.supabase.com") ||
      url.searchParams.get("pgbouncer") === "true";

    const shouldSetPgbouncer =
      isPooler &&
      url.port !== "5432" &&
      !pgbouncerModeOff &&
      url.searchParams.get("pgbouncer") !== "true";

    if (shouldSetPgbouncer) {
      url.searchParams.set("pgbouncer", "true");
    }

    if (url.port === "5432") {
      url.searchParams.delete("pgbouncer");
    }

    const envLimit = process.env.DATABASE_CONNECTION_LIMIT?.trim();
    if (!url.searchParams.has("connection_limit")) {
      const limit = envLimit || (isPooler ? "3" : "");
      if (limit) url.searchParams.set("connection_limit", limit);
    }

    return url.toString();
  } catch {
    return raw;
  }
}

export function getPrisma(): PrismaClient {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalForPrisma.prisma) {
    const datasourceUrl = resolvePrismaDatabaseUrl(raw);
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: datasourceUrl } },
    });
  }
  return globalForPrisma.prisma;
}
