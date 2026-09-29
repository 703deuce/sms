#!/usr/bin/env npx tsx
/**
 * Read-only BullMQ Redis capacity snapshot (no writes).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-scale/redis-stats.ts
 */
import Redis from "ioredis";

async function main() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.error("REDIS_URL required");
    process.exit(1);
  }
  const r = new Redis(url, { maxRetriesPerRequest: null });
  try {
    const [mem, stats, keyspace] = await Promise.all([
      r.info("memory"),
      r.info("stats"),
      r.info("keyspace"),
    ]);
    const pick = (blob: string, key: string) => {
      const m = blob.match(new RegExp(`${key}:(.+)`));
      return m ? m[1].trim() : null;
    };
    const used = Number(pick(mem, "used_memory") ?? 0);
    const max = Number(pick(mem, "maxmemory") ?? 0);
    console.log(
      JSON.stringify(
        {
          event: "mctb_redis_stats",
          timestamp: new Date().toISOString(),
          used_memory_bytes: used,
          used_memory_human: pick(mem, "used_memory_human"),
          used_memory_peak_human: pick(mem, "used_memory_peak_human"),
          maxmemory_bytes: max,
          maxmemory_human: pick(mem, "maxmemory_human"),
          maxmemory_policy: pick(mem, "maxmemory_policy"),
          mem_fragmentation_ratio: pick(mem, "mem_fragmentation_ratio"),
          instantaneous_ops_per_sec: pick(stats, "instantaneous_ops_per_sec"),
          dbsize: await r.dbsize(),
          keyspace,
          pct_of_maxmemory:
            max > 0 ? Math.round((used / max) * 1000) / 10 : null,
        },
        null,
        2,
      ),
    );
  } finally {
    await r.quit();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
