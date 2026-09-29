/**
 * Cloud Agent: prefer self-hosted BullMQ Redis from /workspace/.env (SSH tunnel to Coolify).
 * Loaded before other preloads so it overrides dashboard REDIS_URL (e.g. legacy Upstash).
 */
import { existsSync, readFileSync } from "node:fs";

const ENV_PATH = "/workspace/.env";
const TUNNEL_HOST = "127.0.0.1";
const TUNNEL_PORT = process.env.BULLMQ_REDIS_LOCAL_PORT || "63790";

function applyWorkspaceRedisEnv() {
  if (!existsSync(ENV_PATH)) return;
  let redisUrl;
  let queueDriver;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    if (line.startsWith("REDIS_URL=")) {
      redisUrl = line.slice("REDIS_URL=".length).trim().replace(/^["']|["']$/g, "");
    } else if (line.startsWith("QUEUE_DRIVER=")) {
      queueDriver = line.slice("QUEUE_DRIVER=".length).trim();
    }
  }
  if (!redisUrl) return;
  try {
    const u = new URL(redisUrl);
    if (u.hostname === TUNNEL_HOST && String(u.port) === String(TUNNEL_PORT)) {
      process.env.REDIS_URL = redisUrl;
      if (queueDriver) process.env.QUEUE_DRIVER = queueDriver;
    }
  } catch {
    // ignore malformed .env
  }
}

applyWorkspaceRedisEnv();
