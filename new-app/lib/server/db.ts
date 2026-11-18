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
 * Retry policy for read-only Prisma model queries.
 *
 * P2024 ("Timed out fetching a new connection from the connection pool") means
 * THIS process's pool was already full for `pool_timeout` seconds. Retrying it
 * puts the same request straight back into the same full queue, so one slow
 * page used to turn into 3x the load (and ~60s per request) and starve every
 * other caller, including the producer's uploads. Fail fast on P2024.
 *
 * Only a server-side rejection from the shared pooler (Supavisor/PgBouncer
 * "max clients", "too many connections", EMAXCONNSESSION) is retried, once,
 * with jitter: that is a brief cross-deployment blip, not local exhaustion.
 * Never retry writes: a failed response could follow an already-committed mutation.
 */
const RETRYABLE_POOL_READS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy",
]);

export type PoolErrorKind = "local_pool_timeout" | "pooler_rejected" | null;

export function classifyPoolError(error: unknown): PoolErrorKind {
  const typed = error as { code?: unknown; message?: unknown } | null;
  const code = typeof typed?.code === "string" ? typed.code : "";
  const message = typeof typed?.message === "string" ? typed.message : "";
  if (code === "P2024" || /connection pool timeout|timed out fetching a new connection/i.test(message)) {
    return "local_pool_timeout";
  }
  if (/EMAXCONNSESSION|too many connections|max clients|remaining connection slots/i.test(message)) {
    return "pooler_rejected";
  }
  return null;
}

export async function withPrismaPoolRetry<T>(operation: string, execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    const kind = classifyPoolError(error);
    if (kind !== "pooler_rejected") {
      if (kind === "local_pool_timeout") console.warn("[db:pool]", { action: "fail_fast", operation, code: "P2024" });
      throw error;
    }
    const backoffMs = 200 + Math.floor(Math.random() * 300);
    console.warn("[db:pool]", { action: "retry_once", operation, code: "pooler_rejected", backoffMs });
    await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
    return execute();
  }
}

/**
 * Defaults for interactive `$transaction(async tx => ...)` calls that do not pass
 * their own options. A transaction holds one pooled connection for its whole
 * lifetime, so keep both bounds short: callers must never await storage, fetch,
 * signed URLs or other external I/O inside the callback.
 */
export const DEFAULT_INTERACTIVE_TX = { maxWait: 4_000, timeout: 5_000 } as const;

/** Effective Prisma pool size for this process (from the resolved DATABASE_URL). */
export function prismaConnectionLimit(): number {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return 3;
  try {
    const n = Number(new URL(resolvePrismaDatabaseUrl(raw)).searchParams.get("connection_limit"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
  } catch {
    return 3;
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
      transactionOptions: DEFAULT_INTERACTIVE_TX,
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
