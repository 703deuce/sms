import IORedis from "ioredis";
import { getRedisUrl } from "@/lib/queue/config";
import {
  platformDispatchDefaultDeferMs,
  platformDispatchMps,
} from "@/lib/messaging/platform-dispatch/config";
import { PlatformDispatchDeferredError } from "@/lib/messaging/platform-dispatch/errors";
import {
  isInteractivePlatformDispatchPriority,
  platformDispatchScore,
} from "@/lib/messaging/platform-dispatch/priority";

let client: IORedis | null = null;
let connecting: Promise<IORedis | null> | null = null;

async function redis(): Promise<IORedis> {
  if (client && client.status !== "end" && client.status !== "close") return client;
  if (connecting) {
    const c = await connecting;
    if (c) return c;
    throw new Error("platform_dispatch_redis_unavailable");
  }
  connecting = (async () => {
    const url = getRedisUrl();
    if (!url) return null;
    const c = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    if (c.status === "wait") await c.connect();
    client = c;
    return c;
  })();
  const c = await connecting;
  connecting = null;
  if (!c) throw new Error("platform_dispatch_redis_unavailable");
  return c;
}

const ACQUIRE_LUA = `
local waitKey = KEYS[1]
local metaKey = KEYS[2]
local ratePrefix = KEYS[3]
local member = ARGV[1]
local score = tonumber(ARGV[2])
local notBefore = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local mps = tonumber(ARGV[5])
local isInteractive = tonumber(ARGV[6])

redis.call('ZADD', waitKey, 'NX', score, member)
redis.call('HSET', metaKey, member, notBefore)

if nowMs < notBefore then
  return {0, 'not_before', 1000}
end

local head = redis.call('ZRANGE', waitKey, 0, 0)
if (not head[1]) or (head[1] ~= member) then
  return {0, 'not_head', 200}
end

if isInteractive == 0 then
  local pairs = redis.call('ZRANGE', waitKey, 0, -1, 'WITHSCORES')
  for i = 1, #pairs, 2 do
    local m = pairs[i]
    local s = tonumber(pairs[i+1])
    if m ~= member and s < score then
      local nb = tonumber(redis.call('HGET', metaKey, m) or '0')
      if nowMs >= nb then
        return {0, 'interactive_waiting', 300}
      end
    end
  end
end

local second = math.floor(nowMs / 1000)
local rateKey = ratePrefix .. second
local count = redis.call('INCR', rateKey)
redis.call('EXPIRE', rateKey, 3)
if count > mps then
  redis.call('DECR', rateKey)
  return {0, 'rate', 250}
end

redis.call('ZREM', waitKey, member)
redis.call('HDEL', metaKey, member)
return {1, 'ok', 0}
`;

function keysForE164(e164: string) {
  const safe = e164.replace(/[^+0-9]/g, "");
  return {
    wait: `platform:sms:wait:${safe}`,
    meta: `platform:sms:meta:${safe}`,
    ratePrefix: `platform:sms:rate:${safe}:`,
  };
}

export async function acquirePlatformDispatchSlotRedis(input: {
  platformE164: string;
  reservationId: string;
  priority: number;
  notBeforeMs?: number;
  enqueueMs?: number;
  maxWaitMs: number;
}): Promise<void> {
  const r = await redis();
  const notBeforeMs = input.notBeforeMs ?? Date.now();
  const enqueueMs = input.enqueueMs ?? Date.now();
  const score = platformDispatchScore(input.priority, enqueueMs);
  const isInteractive = isInteractivePlatformDispatchPriority(input.priority) ? 1 : 0;
  const { wait, meta, ratePrefix } = keysForE164(input.platformE164);
  const mps = platformDispatchMps();
  const deadline = Date.now() + input.maxWaitMs;

  while (Date.now() < deadline) {
    const nowMs = Date.now();
    const raw = (await r.eval(
      ACQUIRE_LUA,
      3,
      wait,
      meta,
      ratePrefix,
      input.reservationId,
      String(score),
      String(notBeforeMs),
      String(nowMs),
      String(mps),
      String(isInteractive),
    )) as [number, string, number];
    const ok = Number(raw[0]) === 1;
    if (ok) return;
    const reason = String(raw[1] || "defer");
    const deferHint = Number(raw[2]) || platformDispatchDefaultDeferMs();
    if (Date.now() >= deadline) {
      throw new PlatformDispatchDeferredError(reason, deferHint);
    }
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new PlatformDispatchDeferredError("timeout", platformDispatchDefaultDeferMs());
}

export async function resetPlatformDispatchRedisForTests(): Promise<void> {
  const url = getRedisUrl();
  if (!url) return;
  const r = await redis();
  const keys = await r.keys("platform:sms:*");
  if (keys.length) await r.del(...keys);
}
