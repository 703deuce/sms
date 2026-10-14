import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getQueueDriverName,
  getRedisUrl,
  getQueueConfig,
  QUEUE_CONFIGS,
  brightDataFairChunkSize,
} from "@/lib/queue/config";
import { PRIORITY_SCORES } from "@/lib/queue/types";
import { scheduleJitterMs } from "@/lib/queue/schedule-jitter";
import {
  nextPollIntervalMs,
  isTerminalJobStatus,
  derivePhase,
} from "@/lib/jobs/active-job-status";

describe("map credit refund helper", () => {
  it("treats known pre-provider and cancel messages as refundable", async () => {
    const { PRE_PROVIDER_FAIL } = await import("@/lib/jobs/map-credits");
    assert.equal(PRE_PROVIDER_FAIL.test("No keywords configured"), true);
    assert.equal(PRE_PROVIDER_FAIL.test("Canceled by operator"), true);
    assert.equal(PRE_PROVIDER_FAIL.test("Bright Data timeout"), false);
  });
});

describe("bullmq queue names", () => {
  it("rejects colon-containing queue names and accepts registry names", async () => {
    const {
      assertValidBullmqQueueName,
      assertValidBullmqPrefix,
      resolveBullmqQueueIdentity,
      listRegisteredQueueNames,
    } = await import("@/lib/queue/bullmq-names");

    assert.throws(() => assertValidBullmqQueueName("lse:maps-scan"), /cannot contain/);
    assert.throws(() => assertValidBullmqQueueName("maps:scan"), /cannot contain/);
    assert.throws(() => assertValidBullmqPrefix("lse:prod"), /must not contain/);

    for (const name of listRegisteredQueueNames()) {
      assertValidBullmqQueueName(name);
      assert.ok(!name.includes(":"), name);
    }

    const prev = process.env.QUEUE_PREFIX;
    process.env.QUEUE_PREFIX = "lse";
    const id = resolveBullmqQueueIdentity("maps-scan");
    assert.equal(id.name, "maps-scan");
    assert.equal(id.prefix, "lse");
    if (prev === undefined) delete process.env.QUEUE_PREFIX;
    else process.env.QUEUE_PREFIX = prev;
  });
});

describe("queue config", () => {
  it("defaults QUEUE_DRIVER to database when unset or unknown", () => {
    const prev = process.env.QUEUE_DRIVER;
    delete process.env.QUEUE_DRIVER;
    assert.equal(getQueueDriverName(), "database");
    process.env.QUEUE_DRIVER = "nonsense";
    assert.equal(getQueueDriverName(), "database");
    if (prev === undefined) delete process.env.QUEUE_DRIVER;
    else process.env.QUEUE_DRIVER = prev;
  });

  it("requires explicit QUEUE_DRIVER=bullmq (ignores REDIS_URL alone)", () => {
    const prevDriver = process.env.QUEUE_DRIVER;
    const prevRedis = process.env.REDIS_URL;
    process.env.QUEUE_DRIVER = "database";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    assert.equal(getQueueDriverName(), "database");
    assert.equal(getQueueConfig().driver, "database");
    process.env.QUEUE_DRIVER = "bullmq";
    assert.equal(getQueueDriverName(), "bullmq");
    assert.equal(getRedisUrl(), "redis://127.0.0.1:6379");
    if (prevDriver === undefined) delete process.env.QUEUE_DRIVER;
    else process.env.QUEUE_DRIVER = prevDriver;
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
  });

  it("exposes isolated named queues", () => {
    assert.equal(QUEUE_CONFIGS["maps-scan"].name, "maps-scan");
    assert.equal(QUEUE_CONFIGS["report-generation"].name, "report-generation");
    assert.equal(QUEUE_CONFIGS["email-send"].name, "email-send");
    assert.equal(QUEUE_CONFIGS["sms-send"].name, "sms-send");
    assert.ok(QUEUE_CONFIGS["email-send"].concurrency >= 1);
    assert.ok(QUEUE_CONFIGS["sms-send"].concurrency >= 1);
    assert.ok(QUEUE_CONFIGS["maps-scan"].concurrency >= 1);
    assert.ok(QUEUE_CONFIGS.notifications.maxAttempts >= 1);
    assert.ok(brightDataFairChunkSize() >= 1);
    assert.ok(brightDataFairChunkSize() <= 100);
  });

  it("keeps messaging queues in the global registry for worker:all", async () => {
    const { MESSAGING_QUEUE_NAMES, ALL_QUEUE_NAMES } = await import("@/lib/queue/types");
    assert.ok(MESSAGING_QUEUE_NAMES.includes("email-send"));
    assert.ok(MESSAGING_QUEUE_NAMES.includes("sms-send"));
    assert.ok(MESSAGING_QUEUE_NAMES.includes("review-campaign"));
    // worker:all consumes every registered queue, including messaging
    assert.ok(ALL_QUEUE_NAMES.includes("maps-scan"));
    assert.ok(ALL_QUEUE_NAMES.includes("email-send"));
    for (const name of MESSAGING_QUEUE_NAMES) {
      assert.ok(ALL_QUEUE_NAMES.includes(name), name);
    }
  });

  it("defaults Bright Data fair chunk / start rate for paced 10/min waves", async () => {
    const prevChunk = process.env.BRIGHTDATA_FAIR_CHUNK_SIZE;
    const prevRate = process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC;
    const prevRateMin = process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_MIN;
    const prevBatch = process.env.BRIGHTDATA_GRID_BATCH_SIZE;
    delete process.env.BRIGHTDATA_FAIR_CHUNK_SIZE;
    delete process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC;
    delete process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_MIN;
    delete process.env.BRIGHTDATA_GRID_BATCH_SIZE;

    // Re-import after env clear is not needed — helpers read env on each call.
    const { brightDataFairChunkSize: chunkFn, brightDataStartRatePerSec: rateFn } =
      await import("@/lib/queue/config");
    const { mapsCellBatchSize, mapsGridConcurrency } = await import(
      "@/lib/jobs/run-grid-cells"
    );
    const { brightDataStartRatePerMin } = await import("@/lib/providers/maps-grid/config");

    assert.equal(chunkFn(), 10);
    assert.equal(brightDataStartRatePerMin(), 10);
    assert.equal(rateFn(), 1); // ceil(10/min) legacy per-sec view
    assert.equal(mapsCellBatchSize(), 10);
    assert.equal(mapsGridConcurrency(49), 10);
    assert.equal(mapsGridConcurrency(10), 10);
    assert.equal(mapsGridConcurrency(121), 10);

    if (prevChunk === undefined) delete process.env.BRIGHTDATA_FAIR_CHUNK_SIZE;
    else process.env.BRIGHTDATA_FAIR_CHUNK_SIZE = prevChunk;
    if (prevRate === undefined) delete process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC;
    else process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC = prevRate;
    if (prevRateMin === undefined) delete process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_MIN;
    else process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_MIN = prevRateMin;
    if (prevBatch === undefined) delete process.env.BRIGHTDATA_GRID_BATCH_SIZE;
    else process.env.BRIGHTDATA_GRID_BATCH_SIZE = prevBatch;
  });

  it("orders priority classes highest < normal < lower", () => {
    assert.ok(PRIORITY_SCORES.highest < PRIORITY_SCORES.normal);
    assert.ok(PRIORITY_SCORES.normal < PRIORITY_SCORES.lower);
  });

  it("getRedisUrl returns null when empty", () => {
    if (!process.env.REDIS_URL?.trim()) {
      assert.equal(getRedisUrl(), null);
    }
  });

  it("rewrites retired Upstash host to dynamic-pipefish", () => {
    const prevRedis = process.env.REDIS_URL;
    const prevHost = process.env.REDIS_HOST;
    const prevQueue = process.env.QUEUE_REDIS_URL;
    const prevBull = process.env.BULLMQ_REDIS_URL;
    const prevCache = process.env.CACHE_REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.QUEUE_REDIS_URL;
    delete process.env.BULLMQ_REDIS_URL;
    delete process.env.CACHE_REDIS_URL;
    process.env.REDIS_URL =
      "rediss://default:secret@1hv8gepn81e4s5mtmrjf9stv.upstash.io:6379";
    const url = getRedisUrl();
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.hostname, "dynamic-pipefish-176544.upstash.io");
    assert.equal(parsed.password, "secret");
    assert.equal(parsed.port, "6379");
    assert.equal(parsed.protocol, "rediss:");

    // Letter-L lookalike id from logs
    process.env.REDIS_URL =
      "rediss://default:secret@lhv8gepn81e4s5mtmrjf9stv.upstash.io:6379";
    assert.equal(new URL(getRedisUrl()!).hostname, "dynamic-pipefish-176544.upstash.io");

    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = prevHost;
    if (prevQueue === undefined) delete process.env.QUEUE_REDIS_URL;
    else process.env.QUEUE_REDIS_URL = prevQueue;
    if (prevBull === undefined) delete process.env.BULLMQ_REDIS_URL;
    else process.env.BULLMQ_REDIS_URL = prevBull;
    if (prevCache === undefined) delete process.env.CACHE_REDIS_URL;
    else process.env.CACHE_REDIS_URL = prevCache;
  });

  it("upgrades redis:// Upstash URLs to rediss:// and strips /0", () => {
    const prevRedis = process.env.REDIS_URL;
    const prevHost = process.env.REDIS_HOST;
    delete process.env.REDIS_HOST;
    // Coolify still had non-TLS redis:// + /0 DB path — Upstash resets those.
    process.env.REDIS_URL =
      "redis://default:secret@lhv8gepn81e4s5mtmrjf9stv.upstash.io:6379/0";
    const url = getRedisUrl()!;
    assert.ok(url.startsWith("rediss://"), url);
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "rediss:");
    assert.equal(parsed.hostname, "dynamic-pipefish-176544.upstash.io");
    assert.equal(parsed.port, "6379");
    assert.equal(parsed.pathname, "");
    assert.equal(parsed.password, "secret");
    assert.doesNotMatch(url, /\/0/);

    // Already on current host but still redis://
    process.env.REDIS_URL =
      "redis://default:tok@dynamic-pipefish-176544.upstash.io:6379/0";
    const again = getRedisUrl()!;
    assert.ok(again.startsWith("rediss://"), again);
    assert.equal(new URL(again).pathname, "");

    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = prevHost;
  });

  it("getBullmqConnectionOptions enables TLS for Upstash", async () => {
    const { getBullmqConnectionOptions } = await import("@/lib/queue/config");
    const opts = getBullmqConnectionOptions(
      "redis://default:secret@dynamic-pipefish-176544.upstash.io:6379/0"
    );
    assert.equal(opts.host, "dynamic-pipefish-176544.upstash.io");
    assert.ok(opts.tls);
  });

  it("rewrites any non-current *.upstash.io host", () => {
    const prevRedis = process.env.REDIS_URL;
    const prevHost = process.env.REDIS_HOST;
    delete process.env.REDIS_HOST;
    process.env.REDIS_URL = "rediss://default:tok@some-old-db-123.upstash.io:6379";
    assert.equal(new URL(getRedisUrl()!).hostname, "dynamic-pipefish-176544.upstash.io");
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = prevHost;
  });

  it("reads QUEUE_REDIS_URL when REDIS_URL is empty", () => {
    const prevRedis = process.env.REDIS_URL;
    const prevQueue = process.env.QUEUE_REDIS_URL;
    const prevHost = process.env.REDIS_HOST;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    process.env.QUEUE_REDIS_URL =
      "rediss://default:q@1hv8gepn81e4s5mtmrjf9stv.upstash.io:6379";
    const parsed = new URL(getRedisUrl()!);
    assert.equal(parsed.hostname, "dynamic-pipefish-176544.upstash.io");
    assert.equal(parsed.password, "q");
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevQueue === undefined) delete process.env.QUEUE_REDIS_URL;
    else process.env.QUEUE_REDIS_URL = prevQueue;
    if (prevHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = prevHost;
  });

  it("honors REDIS_HOST override", () => {
    const prevRedis = process.env.REDIS_URL;
    const prevHost = process.env.REDIS_HOST;
    process.env.REDIS_URL = "redis://:pw@127.0.0.1:6379";
    process.env.REDIS_HOST = "dynamic-pipefish-176544.upstash.io";
    const parsed = new URL(getRedisUrl()!);
    assert.equal(parsed.hostname, "dynamic-pipefish-176544.upstash.io");
    assert.equal(parsed.password, "pw");
    assert.equal(parsed.protocol, "rediss:");
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = prevHost;
  });
});

describe("schedule jitter", () => {
  it("is deterministic per seed and stays inside the window", () => {
    const a = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-a:campaign-1",
    });
    const b = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-a:campaign-1",
    });
    const c = scheduleJitterMs({
      windowStartMs: 1_000_000,
      windowMs: 3_600_000,
      seed: "org-b:campaign-1",
    });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.ok(a >= 1_000_000);
    assert.ok(a < 1_000_000 + 3_600_000 + 1000);
  });
});

describe("active job status helpers", () => {
  it("uses adaptive intervals and terminal detection", () => {
    const start = 1_000_000;
    // Schedule: 2s / 4s / 8s / 15s + jitter — assert bands, not exact ms.
    const early = nextPollIntervalMs(start, start, start + 5_000);
    assert.ok(early >= 500 && early <= 3000, `early=${early}`);
    const mid = nextPollIntervalMs(start, start, start + 45_000);
    assert.ok(mid >= 500 && mid <= 5500, `mid=${mid}`);
    const late = nextPollIntervalMs(start, start, start + 200_000);
    assert.ok(late >= 5000, `late=${late}`);
    assert.equal(isTerminalJobStatus("completed"), true);
    assert.equal(isTerminalJobStatus("permanently_failed"), true);
    assert.equal(isTerminalJobStatus("provider_running"), false);
    assert.equal(derivePhase("queued"), "queued");
    assert.equal(derivePhase("failed"), "failed");
    assert.equal(derivePhase("provider_running"), "active");
  });
});
