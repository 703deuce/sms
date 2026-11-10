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

/**
 * Retry read-only Prisma model queries when the shared transaction pooler briefly
 * runs out of sessions during overlapping deployments. Never retry writes:
 * a failed response could follow an already-committed mutation.
 */
const RETRYABLE_POOL_READS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy",
]);

function isTransientPoolError(error: unknown): boolean {
  const typed = error as { code?: unknown; message?: unknown } | null;
  const code = typeof typed?.code === "string" ? typed.code : "";
  const message = typeof typed?.message === "string" ? typed.message : "";
  return code === "P2024" ||
    /EMAXCONNSESSION|too many connections|max clients|remaining connection slots|connection pool timeout|timed out fetching a new connection/i.test(message);
}

export async function withPrismaPoolRetry<T>(operation: string, execute: () => Promise<T>): Promise<T> {
  const backoffs = [150, 400];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await execute();
    } catch (error) {
      if (!isTransientPoolError(error)) throw error;
      const code = typeof (error as { code?: unknown })?.code === "string"
        ? (error as { code: string }).code : "pool_exhausted";
      if (attempt >= backoffs.length) {
        console.error("[db:pool]", { action: "retry_exhausted", operation, code, attempts: attempt + 1 });
        throw error;
      }
      console.warn("[db:pool]", { action: "retry", operation, code, attempt: attempt + 1, backoffMs: backoffs[attempt] });
      await new Promise<void>((resolve) => setTimeout(resolve, backoffs[attempt]));
    }
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
    }).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!RETRYABLE_POOL_READS.has(operation)) return query(args);
            return withPrismaPoolRetry(`${model}.${operation}`, () => query(args));
          },
        },
      },
    }) as unknown as PrismaClient;
  }
  return globalForPrisma.prisma;
}
