import "server-only";

let sharedClient: import("ioredis").default | null = null;
let redisCreateCount = 0;

export function getVoiceV2RedisCreateCount(): number {
  return redisCreateCount;
}

export function resetVoiceV2SharedRedisForTests(): void {
  if (sharedClient) {
    void sharedClient.quit().catch(() => undefined);
  }
  sharedClient = null;
  redisCreateCount = 0;
}

/** Single shared Redis client for Voice V2 session/tombstone/idempotency (no per-request connect). */
export async function getVoiceV2SharedRedis(): Promise<import("ioredis").default | null> {
  if (process.env.VOICE_V2_ALLOW_MEMORY_L2 === "1") return null;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (sharedClient) return sharedClient;
  const IORedis = (await import("ioredis")).default;
  redisCreateCount += 1;
  sharedClient = new IORedis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  await sharedClient.connect().catch(() => undefined);
  return sharedClient;
}
