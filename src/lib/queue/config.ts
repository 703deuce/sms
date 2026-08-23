import type { QueueConfig, QueueDriverName, QueueName } from "@/lib/queue/types";

export function getQueueDriverName(): QueueDriverName {
  const raw = (process.env.QUEUE_DRIVER ?? "database").trim().toLowerCase();
  if (raw === "bullmq") return "bullmq";
  return "database";
}

/**
 * Retired Upstash DB id (digit + letter lookalikes both appear in logs).
 * Any `*.upstash.io` host that is not CURRENT is rewritten to CURRENT.
 */
const LEGACY_UPSTASH_IDS = ["1hv8gepn81e4s5mtmrjf9stv", "lhv8gepn81e4s5mtmrjf9stv"] as const;
export const CURRENT_UPSTASH_HOST = "dynamic-pipefish-176544.upstash.io";

const REDIS_URL_ENV_KEYS = [
  "REDIS_URL",
  "QUEUE_REDIS_URL",
  "BULLMQ_REDIS_URL",
  "CACHE_REDIS_URL",
] as const;

function isUpstashHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === CURRENT_UPSTASH_HOST || host.endsWith(".upstash.io")) return true;
  return LEGACY_UPSTASH_IDS.some(
    (id) => host === id || host === `${id}.upstash.io` || host.startsWith(`${id}.`)
  );
}

function isLegacyUpstashHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === CURRENT_UPSTASH_HOST) return false;
  return isUpstashHost(host);
}

/** Upstash requires TLS (rediss://). Plain redis:// causes ECONNRESET. */
function applyUpstashTlsUrl(parsed: URL): void {
  parsed.protocol = "rediss:";
  parsed.port = "6379";
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
}

function pickRawRedisUrl(): { raw: string; source: string } | null {
  for (const key of REDIS_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return { raw: value, source: key };
  }
  return null;
}

/** Which env var supplied the Redis URL (REDIS_URL, QUEUE_REDIS_URL, …). */
export function getRedisUrlEnvSource(): string | null {
  return pickRawRedisUrl()?.source ?? null;
}

/** Redact password for logs: rediss://default:****@host:6379 */
export function sanitizeRedisUrlForLogs(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/([^:@/]+):([^@/]+)@/i, "://$1:****@");
  }
}

export function getResolvedRedisHost(url?: string | null): string | null {
  const resolved = url ?? getRedisUrl();
  if (!resolved) return null;
  try {
    return new URL(resolved).hostname;
  } catch {
    return null;
  }
}

/**
 * Normalize Redis URL for ioredis / BullMQ.
 *
 * - Prefers REDIS_URL, then QUEUE_REDIS_URL / BULLMQ_REDIS_URL / CACHE_REDIS_URL
 * - REDIS_HOST overrides hostname when set
 * - Any non-current `*.upstash.io` host (including retired 1hv8… / lhv8…) → CURRENT_UPSTASH_HOST
 * - Upstash always forced to `rediss://…:6379` (no `/0` path) — plain redis:// → ECONNRESET
 */
export function getRedisUrl(): string | null {
  const picked = pickRawRedisUrl();
  if (!picked) return null;

  try {
    const parsed = new URL(picked.raw);
    const hostOverride = process.env.REDIS_HOST?.trim();

    if (hostOverride) {
      parsed.hostname = hostOverride;
    } else if (isLegacyUpstashHost(parsed.hostname)) {
      parsed.hostname = CURRENT_UPSTASH_HOST;
    }

    if (isUpstashHost(parsed.hostname)) {
      applyUpstashTlsUrl(parsed);
    }

    return parsed.toString();
  } catch {
    // Malformed URL — return as-is so callers surface the parse error later.
    return picked.raw;
  }
}

/**
 * Log resolved Redis endpoint (password redacted) and refuse legacy Upstash hosts.
 * Call from worker boot and cron/job entrypoints.
 */
export function assertRedisEndpointReady(context: string): void {
  const picked = pickRawRedisUrl();
  const resolved = getRedisUrl();
  if (!resolved) {
    console.warn(`[redis] ${context}: no REDIS_URL (or QUEUE/BULLMQ/CACHE alias) set`);
    return;
  }

  const host = getResolvedRedisHost(resolved);
  const rawHost = (() => {
    try {
      return picked ? new URL(picked.raw).hostname : null;
    } catch {
      return null;
    }
  })();

  console.log(
    `[redis] ${context}: source=${picked?.source ?? "?"} rawHost=${rawHost ?? "?"} resolvedHost=${host ?? "?"} url=${sanitizeRedisUrlForLogs(resolved)}`
  );

  if (host && isLegacyUpstashHost(host)) {
    throw new Error(
      `[redis] ${context}: refusing to connect to retired Upstash host "${host}". ` +
        `Set REDIS_URL=rediss://default:TOKEN@${CURRENT_UPSTASH_HOST}:6379 on every Coolify resource (web + workers), enable Runtime Variable, then Redeploy (not Restart).`
    );
  }

  if (host && isUpstashHost(host) && !resolved.startsWith("rediss://")) {
    throw new Error(
      `[redis] ${context}: Upstash requires TLS. Use rediss:// (not redis://) — ` +
        `REDIS_URL=rediss://default:TOKEN@${CURRENT_UPSTASH_HOST}:6379 then Redeploy.`
    );
  }
}

export function getQueuePrefix(): string {
  return process.env.QUEUE_PREFIX?.trim() || "lse";
}

/**
 * Legacy per-second Bright Data start rate.
 * Prefer BRIGHTDATA_GLOBAL_START_RATE_PER_MIN (default 10/min paced trial).
 * If PER_SEC is unset, derive from per-minute (ceil) so callers stay valid.
 */
export function brightDataStartRatePerSec(): number {
  const perSec = Number(process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC ?? "");
  if (Number.isFinite(perSec) && perSec > 0) return perSec;
  const perMin = Number(process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_MIN ?? 10);
  if (Number.isFinite(perMin) && perMin > 0) return Math.max(1, Math.ceil(perMin / 60));
  return 1;
}

/** Global in-flight Bright Data requests across all workers. */
export function brightDataMaxInFlight(): number {
  const n = Number(process.env.BRIGHTDATA_GLOBAL_MAX_IN_FLIGHT ?? 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/**
 * Max cells one scan launches per wave (and local pLimit concurrency).
 * Default 10 = paced trial (do 10 → wait for finish → next 10 after the minute).
 * Raise via BRIGHTDATA_FAIR_CHUNK_SIZE / BRIGHTDATA_GRID_BATCH_SIZE to restore burst.
 */
export function brightDataFairChunkSize(): number {
  const n = Number(process.env.BRIGHTDATA_FAIR_CHUNK_SIZE ?? 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 10;
}

/** Twilio global start rate (SMS API calls/sec across workers). */
export function twilioStartRatePerSec(): number {
  const n = Number(process.env.TWILIO_GLOBAL_START_RATE_PER_SEC ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/** Twilio global in-flight SMS sends across workers. */
export function twilioMaxInFlight(): number {
  const n = Number(process.env.TWILIO_GLOBAL_MAX_IN_FLIGHT ?? 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** Brevo global start rate (email API calls/sec across workers). */
export function brevoStartRatePerSec(): number {
  const n = Number(process.env.BREVO_GLOBAL_START_RATE_PER_SEC ?? 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** Brevo global in-flight email sends across workers. */
export function brevoMaxInFlight(): number {
  const n = Number(process.env.BREVO_GLOBAL_MAX_IN_FLIGHT ?? 40);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

export function maxActiveMapsScansPerOrg(): number {
  // Default 1: same org runs one Maps scan at a time (others stay queued).
  const n = Number(process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function maxQueuedMapsScansPerOrg(): number {
  const n = Number(process.env.MAX_QUEUED_MAPS_SCANS_PER_ORG ?? 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export type BullmqConnectionRole = "worker" | "producer";

/**
 * BullMQ connection options as plain ioredis fields (avoids duplicate-ioredis
 * type conflicts when constructing Redis clients in app vs bullmq's nested copy).
 *
 * Workers retry forever with bounded backoff + keepalive so a transient
 * ETIMEDOUT during deploy does not kill the process. Producers share the same
 * reconnect strategy; enqueue failures still mark ledger `enqueue_failed`.
 */
export function getBullmqConnectionOptions(
  redisUrl?: string | null,
  _role: BullmqConnectionRole = "producer"
): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  keepAlive: number;
  connectTimeout: number;
  retryStrategy: (times: number) => number | void;
  enableOfflineQueue: boolean;
  tls?: { rejectUnauthorized: boolean };
} {
  const url = redisUrl ?? getRedisUrl();
  if (!url) throw new Error("REDIS_URL is required for BullMQ");
  const parsed = new URL(url);
  const host = parsed.hostname;
  if (isLegacyUpstashHost(host)) {
    throw new Error(
      `BullMQ refused retired Upstash host "${host}". Use ${CURRENT_UPSTASH_HOST}.`
    );
  }
  const useTls = parsed.protocol === "rediss:" || isUpstashHost(host);
  return {
    host,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    // Required for BullMQ blocking commands (BRPOPLPUSH / BZPOPMIN).
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 30_000,
    connectTimeout: 20_000,
    // Indefinite reconnect with bounded backoff (ms).
    retryStrategy: (times: number) => Math.min(Math.max(times, 1) * 200, 5_000),
    enableOfflineQueue: true,
    // Upstash is TLS-only; plain redis:// yields ECONNRESET.
    ...(useTls ? { tls: { rejectUnauthorized: true } } : {}),
  };
}

export function getQueueConfig(): {
  driver: QueueDriverName;
  redisUrl: string | null;
  prefix: string;
  queues: Record<QueueName, QueueConfig>;
} {
  return {
    driver: getQueueDriverName(),
    redisUrl: getRedisUrl(),
    prefix: getQueuePrefix(),
    queues: QUEUE_CONFIGS,
  };
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  "maps-scan": {
    name: "maps-scan",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAPS_SCAN ?? 2),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_MAPS_SCAN_MAX ?? 20),
      durationMs: 60_000,
    },
    maxAttempts: 3,
    timeoutMs: 30 * 60_000,
    description: "Parent grid scan jobs (Bright Data)",
  },
  "maps-cell-retry": {
    name: "maps-cell-retry",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAPS_CELL_RETRY ?? 4),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_MAPS_CELL_RETRY_MAX ?? 40),
      durationMs: 60_000,
    },
    maxAttempts: 5,
    timeoutMs: 10 * 60_000,
    description: "Failed cell retry bursts",
  },
  "review-campaign": {
    name: "review-campaign",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_CAMPAIGN ?? 2),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_REVIEW_CAMPAIGN_MAX ?? 30),
      durationMs: 60_000,
    },
    maxAttempts: 3,
    timeoutMs: 2 * 60_000,
    description: "Campaign drain — enqueue due email/sms send jobs",
  },
  "email-send": {
    name: "email-send",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_EMAIL_SEND ?? 15),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_EMAIL_SEND_MAX ?? 120),
      durationMs: 60_000,
    },
    maxAttempts: 5,
    timeoutMs: 2 * 60_000,
    description: "Brevo campaign email delivery",
  },
  "sms-send": {
    name: "sms-send",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_SMS_SEND ?? 10),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_SMS_SEND_MAX ?? 60),
      durationMs: 60_000,
    },
    maxAttempts: 5,
    timeoutMs: 2 * 60_000,
    description: "Twilio campaign SMS delivery",
  },
  "review-import": {
    name: "review-import",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_IMPORT ?? 2),
    maxAttempts: 3,
    timeoutMs: 15 * 60_000,
    description: "Contact CSV / review imports",
  },
  "review-monitor": {
    name: "review-monitor",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_MONITOR ?? 2),
    maxAttempts: 3,
    timeoutMs: 10 * 60_000,
    description: "Review velocity / new-review monitoring",
  },
  "backlink-gap": {
    name: "backlink-gap",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_BACKLINK_GAP ?? 1),
    limiter: { max: 10, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "Backlink Gap audits",
  },
  "local-trust": {
    name: "local-trust",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_LOCAL_TRUST ?? 1),
    limiter: { max: 10, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "Local Trust audits",
  },
  "ai-visibility": {
    name: "ai-visibility",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_AI_VISIBILITY ?? 1),
    limiter: { max: 6, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "AI Visibility prompt runs",
  },
  "report-generation": {
    name: "report-generation",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REPORT_GENERATION ?? 2),
    maxAttempts: 3,
    timeoutMs: 10 * 60_000,
    description: "Client report / PDF generation",
  },
  notifications: {
    name: "notifications",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_NOTIFICATIONS ?? 5),
    maxAttempts: 5,
    timeoutMs: 2 * 60_000,
    description: "Transactional notifications",
  },
  maintenance: {
    name: "maintenance",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAINTENANCE ?? 1),
    maxAttempts: 2,
    timeoutMs: 30 * 60_000,
    description: "Retention, reconciliation, cleanup",
  },
};
