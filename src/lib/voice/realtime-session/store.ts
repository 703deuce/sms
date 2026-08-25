import type { AmyRealtimeSession, SessionPatch } from "./types";

export type RealtimeSessionStore = {
  get(sessionId: string): Promise<AmyRealtimeSession | null>;
  set(sessionId: string, session: AmyRealtimeSession): Promise<void>;
  patch(sessionId: string, changes: SessionPatch, expectedVersion?: number): Promise<AmyRealtimeSession>;
  delete(sessionId: string): Promise<void>;
  acquireLock(sessionId: string, ttlMs?: number): Promise<() => Promise<void>>;
};

const SESSION_TTL_SEC = 4 * 60 * 60; // 4 hours — covers long calls

/** Development-only fallback when REDIS_URL is unset. NOT safe for multi-instance production. */
class InMemoryRealtimeSessionStore implements RealtimeSessionStore {
  private readonly sessions = new Map<string, AmyRealtimeSession>();
  private readonly locks = new Map<string, NodeJS.Timeout>();

  async get(sessionId: string): Promise<AmyRealtimeSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async set(sessionId: string, session: AmyRealtimeSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async patch(
    sessionId: string,
    changes: SessionPatch,
    expectedVersion?: number,
  ): Promise<AmyRealtimeSession> {
    const current = this.sessions.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    if (expectedVersion != null && current.version !== expectedVersion) {
      throw new Error(`Session version conflict: ${sessionId}`);
    }
    const next: AmyRealtimeSession = {
      ...current,
      ...changes,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      runtime: changes.runtime ?? current.runtime,
      collectedFields: changes.collectedFields ?? current.collectedFields,
      missingFieldIds: changes.missingFieldIds ?? current.missingFieldIds,
      availableSlots: changes.availableSlots ?? current.availableSlots,
    };
    this.sessions.set(sessionId, next);
    return next;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async acquireLock(sessionId: string, ttlMs = 5000): Promise<() => Promise<void>> {
    const key = `lock:${sessionId}`;
    while (this.locks.has(key)) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const timer = setTimeout(() => this.locks.delete(key), ttlMs);
    this.locks.set(key, timer);
    return async () => {
      clearTimeout(timer);
      this.locks.delete(key);
    };
  }
}

class RedisRealtimeSessionStore implements RealtimeSessionStore {
  private client: import("ioredis").default | null = null;

  private async getClient(): Promise<import("ioredis").default> {
    if (this.client) return this.client;
    const IORedis = (await import("ioredis")).default;
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL required");
    this.client = new IORedis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    await this.client.connect().catch(() => undefined);
    return this.client;
  }

  private key(sessionId: string): string {
    return `amy:realtime:${sessionId}`;
  }

  private lockKey(sessionId: string): string {
    return `amy:realtime:lock:${sessionId}`;
  }

  async get(sessionId: string): Promise<AmyRealtimeSession | null> {
    const redis = await this.getClient();
    const raw = await redis.get(this.key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as AmyRealtimeSession;
  }

  async set(sessionId: string, session: AmyRealtimeSession): Promise<void> {
    const redis = await this.getClient();
    await redis.set(this.key(sessionId), JSON.stringify(session), "EX", SESSION_TTL_SEC);
  }

  async patch(
    sessionId: string,
    changes: SessionPatch,
    expectedVersion?: number,
  ): Promise<AmyRealtimeSession> {
    const redis = await this.getClient();
    const lockRelease = await this.acquireLock(sessionId);
    try {
      const current = await this.get(sessionId);
      if (!current) throw new Error(`Session not found: ${sessionId}`);
      if (expectedVersion != null && current.version !== expectedVersion) {
        throw new Error(`Session version conflict: ${sessionId}`);
      }
      const next: AmyRealtimeSession = {
        ...current,
        ...changes,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
        runtime: changes.runtime ?? current.runtime,
        collectedFields: changes.collectedFields ?? current.collectedFields,
        missingFieldIds: changes.missingFieldIds ?? current.missingFieldIds,
        availableSlots: changes.availableSlots ?? current.availableSlots,
      };
      await redis.set(this.key(sessionId), JSON.stringify(next), "EX", SESSION_TTL_SEC);
      return next;
    } finally {
      await lockRelease();
    }
  }

  async delete(sessionId: string): Promise<void> {
    const redis = await this.getClient();
    await redis.del(this.key(sessionId));
  }

  async acquireLock(sessionId: string, ttlMs = 5000): Promise<() => Promise<void>> {
    const redis = await this.getClient();
    const key = this.lockKey(sessionId);
    const token = `${Date.now()}-${Math.random()}`;
    const deadline = Date.now() + ttlMs;
    while (Date.now() < deadline) {
      const ok = await redis.set(key, token, "PX", ttlMs, "NX");
      if (ok === "OK") {
        return async () => {
          const val = await redis.get(key);
          if (val === token) await redis.del(key);
        };
      }
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error(`Could not acquire session lock: ${sessionId}`);
  }
}

let storeInstance: RealtimeSessionStore | null = null;
let storeMode: "redis" | "memory" | null = null;

export function getRealtimeSessionStore(): RealtimeSessionStore {
  if (storeInstance) return storeInstance;

  if (process.env.REDIS_URL) {
    storeInstance = new RedisRealtimeSessionStore();
    storeMode = "redis";
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[amy.realtime] REDIS_URL unset — using in-memory session store (NOT safe for horizontal scale)",
      );
    }
    storeInstance = new InMemoryRealtimeSessionStore();
    storeMode = "memory";
  }
  return storeInstance;
}

export function getRealtimeSessionStoreMode(): "redis" | "memory" {
  getRealtimeSessionStore();
  return storeMode || "memory";
}

/** Test helper — reset singleton */
export function resetRealtimeSessionStoreForTests(store?: RealtimeSessionStore): void {
  storeInstance = store ?? new InMemoryRealtimeSessionStore();
  storeMode = "memory";
}

export { InMemoryRealtimeSessionStore };
