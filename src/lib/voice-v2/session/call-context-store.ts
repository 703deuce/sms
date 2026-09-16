import "server-only";

import type {
  VoiceV2CallContextRecord,
  VoiceV2PatchResult,
  VoiceV2RecoveryResult,
  VoiceV2WriteClass,
} from "./types";
import { VOICE_V2_CALL_CONTEXT_SCHEMA_VERSION, VOICE_V2_CALL_CONTEXT_TTL_SEC } from "./types";
import { voiceV2ContextMetric } from "./observability";
import { assertVoiceV2SharedSessionBackendAllowed } from "./store-config";
import { getVoiceV2SharedRedis } from "./redis-client";
import { syncLegacyFromRecord, buildRecordFromLegacy, projectOfferFromLegacy } from "./legacy-bridge";
import type { VoiceV2CallContext } from "../intake/types";
import type { VoiceV2ContextIdentity, VoiceV2EnrollmentSnapshot } from "./types";

export type VoiceV2CallContextStore = {
  resolveCanonicalSessionKey(input: {
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<string | null>;
  registerAliases(input: {
    canonical: string;
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<void>;
  getRecord(canonicalKey: string): Promise<VoiceV2CallContextRecord | null>;
  createRecord(record: VoiceV2CallContextRecord): Promise<VoiceV2CallContextRecord>;
  patchRecord(input: {
    canonicalKey: string;
    expectedVersion: number;
    writeClass: VoiceV2WriteClass;
    mutate: (current: VoiceV2CallContextRecord) => VoiceV2CallContextRecord;
  }): Promise<VoiceV2PatchResult>;
  replacePayload(input: {
    canonicalKey: string;
    payload: VoiceV2CallContext;
    writeClass?: VoiceV2WriteClass;
  }): Promise<VoiceV2PatchResult>;
  markEnded(canonicalKey: string): Promise<VoiceV2PatchResult>;
};

type L1Entry = { record: VoiceV2CallContextRecord };

function ctxKey(canonical: string): string {
  return `voice:v2:ctx:${canonical}`;
}

function aliasKey(kind: "call-control" | "conversation" | "call", id: string): string {
  return `voice:v2:alias:${kind}:${id}`;
}

export class InMemoryVoiceV2CallContextStore implements VoiceV2CallContextStore {
  private readonly records = new Map<string, VoiceV2CallContextRecord>();
  private readonly aliases = new Map<string, string>();

  async resolveCanonicalSessionKey(input: {
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<string | null> {
    const cc = input.callControlId?.trim();
    const conv = input.conversationId?.trim();
    const callId = input.callId?.trim();

    if (callId) {
      const ak = aliasKey("call", callId);
      const existing = this.aliases.get(ak);
      if (existing) return existing;
      const canonical = `call:${callId}`;
      await this.registerAliases({ canonical, callId, callControlId: cc, conversationId: conv });
      return canonical;
    }

    if (cc) {
      const mapped = this.aliases.get(aliasKey("call-control", cc));
      if (mapped) return mapped;
    }
    if (conv) {
      const mapped = this.aliases.get(aliasKey("conversation", conv));
      if (mapped) return mapped;
    }

    if (cc) return `cc:${cc}`;
    if (conv) return `conv:${conv}`;
    return null;
  }

  async registerAliases(input: {
    canonical: string;
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<void> {
    const { canonical } = input;
    const cc = input.callControlId?.trim();
    const conv = input.conversationId?.trim();
    const callId = input.callId?.trim();
    if (callId) this.aliases.set(aliasKey("call", callId), canonical);
    if (cc) this.aliases.set(aliasKey("call-control", cc), canonical);
    if (conv) this.aliases.set(aliasKey("conversation", conv), canonical);
  }

  async getRecord(canonicalKey: string): Promise<VoiceV2CallContextRecord | null> {
    return this.records.get(canonicalKey) ?? null;
  }

  async createRecord(record: VoiceV2CallContextRecord): Promise<VoiceV2CallContextRecord> {
    if (this.records.has(record.identity.sessionKey)) {
      throw new Error(`VoiceV2CallContext already exists: ${record.identity.sessionKey}`);
    }
    this.records.set(record.identity.sessionKey, record);
    return record;
  }

  async patchRecord(input: {
    canonicalKey: string;
    expectedVersion: number;
    writeClass: VoiceV2WriteClass;
    mutate: (current: VoiceV2CallContextRecord) => VoiceV2CallContextRecord;
  }): Promise<VoiceV2PatchResult> {
    const current = this.records.get(input.canonicalKey);
    if (!current) return { applied: false, reason: "NOT_FOUND" };
    if (current.lifecycle.status === "ENDED") {
      voiceV2ContextMetric("VOICE_V2_CONTEXT_ENDED_WRITE_REJECTED", { key: input.canonicalKey });
      return { applied: false, reason: "SESSION_ENDED", currentVersion: current.stateVersion };
    }
    if (current.stateVersion !== input.expectedVersion) {
      voiceV2ContextMetric("VOICE_V2_CONTEXT_CAS_STALE", {
        key: input.canonicalKey,
        expected: input.expectedVersion,
        current: current.stateVersion,
      });
      return { applied: false, reason: "STALE_VERSION", currentVersion: current.stateVersion };
    }
    const draft = input.mutate(current);
    const next: VoiceV2CallContextRecord = {
      ...draft,
      stateVersion: current.stateVersion + 1,
      lifecycle: {
        ...draft.lifecycle,
        updatedAt: new Date().toISOString(),
      },
    };
    this.records.set(input.canonicalKey, next);
    voiceV2ContextMetric("VOICE_V2_CONTEXT_CAS_APPLIED", {
      key: input.canonicalKey,
      writeClass: input.writeClass,
      newVersion: next.stateVersion,
    });
    return { applied: true, record: next, newVersion: next.stateVersion };
  }

  async replacePayload(input: {
    canonicalKey: string;
    payload: VoiceV2CallContext;
    writeClass?: VoiceV2WriteClass;
  }): Promise<VoiceV2PatchResult> {
    const current = await this.getRecord(input.canonicalKey);
    if (!current) return { applied: false, reason: "NOT_FOUND" };
    return this.patchRecord({
      canonicalKey: input.canonicalKey,
      expectedVersion: current.stateVersion,
      writeClass: input.writeClass ?? "B",
      mutate: (rec) => ({
        ...rec,
        payload: input.payload,
        booking: projectOfferFromLegacy(input.payload),
        bookingPreference: input.payload.bookingWorkflow?.requestedDate
          ? {
              requestedDate: input.payload.bookingWorkflow.requestedDate,
              updatedAt: new Date().toISOString(),
            }
          : rec.bookingPreference,
      }),
    });
  }

  async markEnded(canonicalKey: string): Promise<VoiceV2PatchResult> {
    const current = await this.getRecord(canonicalKey);
    if (!current) return { applied: false, reason: "NOT_FOUND" };
    const now = new Date().toISOString();
    return this.patchRecord({
      canonicalKey,
      expectedVersion: current.stateVersion,
      writeClass: "A",
      mutate: (rec) => ({
        ...rec,
        lifecycle: { ...rec.lifecycle, status: "ENDED", endedAt: now, updatedAt: now },
      }),
    });
  }

  /** Test helper — simulate replica without L1 */
  clearAll(): void {
    this.records.clear();
    this.aliases.clear();
  }
}

class RedisVoiceV2CallContextStore implements VoiceV2CallContextStore {
  private async redis(): Promise<import("ioredis").default> {
    const client = await getVoiceV2SharedRedis();
    if (!client) throw new Error("REDIS_URL required");
    return client;
  }

  private async acquireLock(canonical: string): Promise<() => Promise<void>> {
    const { getRealtimeSessionStore } = await import("@/lib/voice/realtime-session/store");
    const store = getRealtimeSessionStore();
    return store.acquireLock(`voice-v2-ctx:${canonical}`, 5000);
  }

  async resolveCanonicalSessionKey(input: {
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<string | null> {
    const r = await this.redis();
    const cc = input.callControlId?.trim();
    const conv = input.conversationId?.trim();
    const callId = input.callId?.trim();

    if (callId) {
      const mapped = await r.get(aliasKey("call", callId));
      if (mapped) return mapped;
      const canonical = `call:${callId}`;
      await this.registerAliases({ canonical, callId, callControlId: cc, conversationId: conv });
      return canonical;
    }
    if (cc) {
      const mapped = await r.get(aliasKey("call-control", cc));
      if (mapped) return mapped;
    }
    if (conv) {
      const mapped = await r.get(aliasKey("conversation", conv));
      if (mapped) return mapped;
    }
    if (cc) return `cc:${cc}`;
    if (conv) return `conv:${conv}`;
    return null;
  }

  async registerAliases(input: {
    canonical: string;
    callControlId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
  }): Promise<void> {
    const r = await this.redis();
    const ttl = VOICE_V2_CALL_CONTEXT_TTL_SEC;
    const { canonical } = input;
    const cc = input.callControlId?.trim();
    const conv = input.conversationId?.trim();
    const callId = input.callId?.trim();
    if (callId) await r.set(aliasKey("call", callId), canonical, "EX", ttl);
    if (cc) await r.set(aliasKey("call-control", cc), canonical, "EX", ttl);
    if (conv) await r.set(aliasKey("conversation", conv), canonical, "EX", ttl);
  }

  async getRecord(canonicalKey: string): Promise<VoiceV2CallContextRecord | null> {
    const r = await this.redis();
    const raw = await r.get(ctxKey(canonicalKey));
    if (!raw) return null;
    return JSON.parse(raw) as VoiceV2CallContextRecord;
  }

  async createRecord(record: VoiceV2CallContextRecord): Promise<VoiceV2CallContextRecord> {
    const release = await this.acquireLock(record.identity.sessionKey);
    try {
      const existing = await this.getRecord(record.identity.sessionKey);
      if (existing) throw new Error(`VoiceV2CallContext already exists: ${record.identity.sessionKey}`);
      const r = await this.redis();
      await r.set(ctxKey(record.identity.sessionKey), JSON.stringify(record), "EX", VOICE_V2_CALL_CONTEXT_TTL_SEC);
      return record;
    } finally {
      await release();
    }
  }

  async patchRecord(input: {
    canonicalKey: string;
    expectedVersion: number;
    writeClass: VoiceV2WriteClass;
    mutate: (current: VoiceV2CallContextRecord) => VoiceV2CallContextRecord;
  }): Promise<VoiceV2PatchResult> {
    const release = await this.acquireLock(input.canonicalKey);
    try {
      const current = await this.getRecord(input.canonicalKey);
      if (!current) return { applied: false, reason: "NOT_FOUND" };
      if (current.lifecycle.status === "ENDED") {
        voiceV2ContextMetric("VOICE_V2_CONTEXT_ENDED_WRITE_REJECTED", { key: input.canonicalKey });
        return { applied: false, reason: "SESSION_ENDED", currentVersion: current.stateVersion };
      }
      if (current.stateVersion !== input.expectedVersion) {
        voiceV2ContextMetric("VOICE_V2_CONTEXT_CAS_STALE", {
          key: input.canonicalKey,
          expected: input.expectedVersion,
          current: current.stateVersion,
        });
        return { applied: false, reason: "STALE_VERSION", currentVersion: current.stateVersion };
      }
      const draft = input.mutate(current);
      const next: VoiceV2CallContextRecord = {
        ...draft,
        stateVersion: current.stateVersion + 1,
        lifecycle: { ...draft.lifecycle, updatedAt: new Date().toISOString() },
      };
      const r = await this.redis();
      await r.set(ctxKey(input.canonicalKey), JSON.stringify(next), "EX", VOICE_V2_CALL_CONTEXT_TTL_SEC);
      voiceV2ContextMetric("VOICE_V2_CONTEXT_CAS_APPLIED", {
        key: input.canonicalKey,
        writeClass: input.writeClass,
        newVersion: next.stateVersion,
      });
      return { applied: true, record: next, newVersion: next.stateVersion };
    } finally {
      await release();
    }
  }

  async replacePayload(input: {
    canonicalKey: string;
    payload: VoiceV2CallContext;
    writeClass?: VoiceV2WriteClass;
  }): Promise<VoiceV2PatchResult> {
    const current = await this.getRecord(input.canonicalKey);
    if (!current) return { applied: false, reason: "NOT_FOUND" };
    return this.patchRecord({
      canonicalKey: input.canonicalKey,
      expectedVersion: current.stateVersion,
      writeClass: input.writeClass ?? "B",
      mutate: (rec) => ({
        ...rec,
        payload: input.payload,
        booking: projectOfferFromLegacy(input.payload),
        bookingPreference: input.payload.bookingWorkflow?.requestedDate
          ? {
              requestedDate: input.payload.bookingWorkflow.requestedDate,
              updatedAt: new Date().toISOString(),
            }
          : rec.bookingPreference,
      }),
    });
  }

  async markEnded(canonicalKey: string): Promise<VoiceV2PatchResult> {
    const current = await this.getRecord(canonicalKey);
    if (!current) return { applied: false, reason: "NOT_FOUND" };
    const now = new Date().toISOString();
    return this.patchRecord({
      canonicalKey,
      expectedVersion: current.stateVersion,
      writeClass: "A",
      mutate: (rec) => ({
        ...rec,
        lifecycle: { ...rec.lifecycle, status: "ENDED", endedAt: now, updatedAt: now },
      }),
    });
  }
}

const l1 = new Map<string, L1Entry>();

/** Hangup before L2 exists — blocks late warmup / ensure from creating ACTIVE context. */
const terminatedSessionKeys = new Set<string>();

function tombstoneRedisKey(canonical: string): string {
  return `voice:v2:tombstone:${canonical}`;
}

export function registerVoiceV2SessionTerminated(canonicalKey: string): void {
  terminatedSessionKeys.add(canonicalKey);
  void persistTerminatedTombstone(canonicalKey);
}

async function persistTerminatedTombstone(canonicalKey: string): Promise<void> {
  if (process.env.VOICE_V2_ALLOW_MEMORY_L2 === "1") return;
  try {
    const r = await getVoiceV2SharedRedis();
    if (!r) return;
    await r.set(tombstoneRedisKey(canonicalKey), "1", "EX", VOICE_V2_CALL_CONTEXT_TTL_SEC);
  } catch {
    // non-blocking
  }
}

export async function isVoiceV2SessionTerminated(canonicalKey: string): Promise<boolean> {
  if (terminatedSessionKeys.has(canonicalKey)) return true;
  if (process.env.VOICE_V2_ALLOW_MEMORY_L2 === "1") return false;
  try {
    const r = await getVoiceV2SharedRedis();
    if (!r) return false;
    const hit = await r.get(tombstoneRedisKey(canonicalKey));
    return hit === "1";
  } catch {
    return false;
  }
}

export type VoiceV2L2ContextBundle = {
  terminated: boolean;
  record: VoiceV2CallContextRecord | null;
  tombstoneMs: number;
  contextGetMs: number;
  deserializeMs: number;
};

/** One round trip for tombstone + context when canonical is known. */
export async function fetchVoiceV2L2ContextBundle(
  canonicalKey: string,
): Promise<VoiceV2L2ContextBundle> {
  if (terminatedSessionKeys.has(canonicalKey)) {
    return {
      terminated: true,
      record: null,
      tombstoneMs: 0,
      contextGetMs: 0,
      deserializeMs: 0,
    };
  }
  const store = getVoiceV2CallContextStore();
  if (getVoiceV2CallContextStoreMode() === "memory" || process.env.VOICE_V2_ALLOW_MEMORY_L2 === "1") {
    const t0 = Date.now();
    const record = await store.getRecord(canonicalKey);
    return {
      terminated: false,
      record,
      tombstoneMs: 0,
      contextGetMs: Date.now() - t0,
      deserializeMs: 0,
    };
  }
  const r = await getVoiceV2SharedRedis();
  if (!r) {
    const t0 = Date.now();
    const record = await store.getRecord(canonicalKey);
    return {
      terminated: false,
      record,
      tombstoneMs: 0,
      contextGetMs: Date.now() - t0,
      deserializeMs: 0,
    };
  }
  const tGet = Date.now();
  const [tombRaw, ctxRaw] = await r.mget(
    tombstoneRedisKey(canonicalKey),
    ctxKey(canonicalKey),
  );
  const contextGetMs = Date.now() - tGet;
  if (tombRaw === "1") {
    terminatedSessionKeys.add(canonicalKey);
    return {
      terminated: true,
      record: null,
      tombstoneMs: contextGetMs,
      contextGetMs: 0,
      deserializeMs: 0,
    };
  }
  if (!ctxRaw) {
    return {
      terminated: false,
      record: null,
      tombstoneMs: contextGetMs,
      contextGetMs: 0,
      deserializeMs: 0,
    };
  }
  const d0 = Date.now();
  const record = JSON.parse(ctxRaw) as VoiceV2CallContextRecord;
  const deserializeMs = Date.now() - d0;
  return {
    terminated: false,
    record,
    tombstoneMs: contextGetMs,
    contextGetMs: 0,
    deserializeMs,
  };
}

export function clearVoiceV2SessionTerminatedForTests(): void {
  terminatedSessionKeys.clear();
}

let storeSingleton: VoiceV2CallContextStore | null = null;
let storeMode: "redis" | "memory" | null = null;

export function getVoiceV2CallContextStore(): VoiceV2CallContextStore {
  if (storeSingleton) return storeSingleton;
  assertVoiceV2SharedSessionBackendAllowed();
  if (process.env.REDIS_URL) {
    storeSingleton = new RedisVoiceV2CallContextStore();
    storeMode = "redis";
  } else {
    storeSingleton = new InMemoryVoiceV2CallContextStore();
    storeMode = "memory";
  }
  return storeSingleton;
}

export function getVoiceV2CallContextStoreMode(): "redis" | "memory" {
  getVoiceV2CallContextStore();
  return storeMode || "memory";
}

export function resetVoiceV2CallContextStoreForTests(store?: VoiceV2CallContextStore): void {
  process.env.VOICE_V2_ALLOW_MEMORY_L2 = "1";
  storeSingleton = store ?? new InMemoryVoiceV2CallContextStore();
  storeMode = "memory";
  l1.clear();
  terminatedSessionKeys.clear();
}

/** Test helper — force store re-resolution (e.g. production fail-closed). */
export function resetVoiceV2CallContextStoreSingleton(): void {
  storeSingleton = null;
  storeMode = null;
}

/** Simulate another replica — shared L2, empty local L1. */
export function clearVoiceV2CallContextL1ForTests(): void {
  l1.clear();
}

export async function resolveVoiceV2SessionKey(input: {
  callControlId?: string | null;
  conversationId?: string | null;
  callId?: string | null;
}): Promise<string | null> {
  return getVoiceV2CallContextStore().resolveCanonicalSessionKey(input);
}

export function hydrateL1FromRecord(record: VoiceV2CallContextRecord): VoiceV2CallContext {
  return hydrateL1(record);
}

function hydrateL1(record: VoiceV2CallContextRecord): VoiceV2CallContext {
  const payload = syncLegacyFromRecord(record);
  const entry = { record };
  l1.set(record.identity.sessionKey, entry);
  const cc = record.identity.telnyxCallControlId?.trim();
  if (cc) l1.set(`cc:${cc}`, entry);
  const conv = record.identity.telnyxConversationId?.trim();
  if (conv) l1.set(`conv:${conv}`, entry);
  return payload;
}

async function canonicalKeyForLookup(lookupKey: string): Promise<string> {
  const store = getVoiceV2CallContextStore();
  if (lookupKey.startsWith("cc:")) {
    return (
      (await store.resolveCanonicalSessionKey({ callControlId: lookupKey.slice(3) })) || lookupKey
    );
  }
  if (lookupKey.startsWith("conv:")) {
    return (
      (await store.resolveCanonicalSessionKey({ conversationId: lookupKey.slice(5) })) || lookupKey
    );
  }
  if (lookupKey.startsWith("call:")) {
    return (
      (await store.resolveCanonicalSessionKey({ callId: lookupKey.slice(5) })) || lookupKey
    );
  }
  return lookupKey;
}

export async function loadVoiceV2CallContextRecord(
  lookupKey: string,
): Promise<VoiceV2CallContextRecord | null> {
  const store = getVoiceV2CallContextStore();
  const canonical = await canonicalKeyForLookup(lookupKey);

  const l1Hit = l1.get(canonical);
  if (l1Hit) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_L1_HIT", { key: canonical });
    return l1Hit.record;
  }
  voiceV2ContextMetric("VOICE_V2_CONTEXT_L1_MISS", { key: canonical });

  const fromL2 = await store.getRecord(canonical);
  if (fromL2) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_L2_HIT", { key: canonical });
    hydrateL1(fromL2);
    return fromL2;
  }
  voiceV2ContextMetric("VOICE_V2_CONTEXT_L2_MISS", { key: canonical });
  return null;
}

export async function loadVoiceV2CallContext(lookupKey: string): Promise<VoiceV2CallContext | null> {
  const record = await loadVoiceV2CallContextRecord(lookupKey);
  return record ? syncLegacyFromRecord(record) : null;
}

export type CreateVoiceV2CallContextOptions = {
  /** await L2 create (tests); background = L1 first, no caller-path block (ensure hot path) */
  l2Persist?: "await" | "background";
};

async function persistNewRecordToL2(
  store: VoiceV2CallContextStore,
  record: VoiceV2CallContextRecord,
  identity: VoiceV2ContextIdentity,
): Promise<VoiceV2CallContextRecord> {
  const created = await store.createRecord(record);
  await store.registerAliases({
    canonical: identity.sessionKey,
    callControlId: identity.telnyxCallControlId,
    conversationId: identity.telnyxConversationId,
    callId: identity.callId,
  });
  return created;
}

export async function createVoiceV2CallContext(
  input: {
    payload: VoiceV2CallContext;
    identity: VoiceV2ContextIdentity;
    enrollment: VoiceV2EnrollmentSnapshot;
    capabilities?: import("./types").VoiceV2ContextCapabilities;
  },
  options?: CreateVoiceV2CallContextOptions,
): Promise<VoiceV2CallContextRecord> {
  if (await isVoiceV2SessionTerminated(input.identity.sessionKey)) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_ENDED_WRITE_REJECTED", {
      key: input.identity.sessionKey,
      phase: "create_blocked",
    });
    throw new Error(`VoiceV2CallContext create blocked: session terminated (${input.identity.sessionKey})`);
  }
  const store = getVoiceV2CallContextStore();
  const record = buildRecordFromLegacy({
    payload: { ...input.payload, sessionKey: input.identity.sessionKey },
    identity: input.identity,
    enrollment: input.enrollment,
    capabilities: input.capabilities,
    stateVersion: 0,
  });
  hydrateL1(record);
  const mode = options?.l2Persist ?? "await";
  if (mode === "background") {
    void persistNewRecordToL2(store, record, input.identity).catch((err) => {
      console.warn(
        "[voice-v2/context-l2-create]",
        err instanceof Error ? err.message : err,
      );
    });
    return record;
  }
  const created = await persistNewRecordToL2(store, record, input.identity);
  hydrateL1(created);
  return created;
}

export async function patchVoiceV2CallContext(input: {
  canonicalKey: string;
  expectedVersion: number;
  writeClass: VoiceV2WriteClass;
  mutate: (current: VoiceV2CallContextRecord) => VoiceV2CallContextRecord;
}): Promise<VoiceV2PatchResult> {
  const store = getVoiceV2CallContextStore();
  const result = await store.patchRecord(input);
  if (result.applied) {
    hydrateL1(result.record);
  }
  return result;
}

export async function persistVoiceV2CallContextPayload(
  ctx: VoiceV2CallContext,
  writeClass: VoiceV2WriteClass = "B",
): Promise<VoiceV2PatchResult> {
  const store = getVoiceV2CallContextStore();
  const canonical = ctx.sessionKey;
  const existing = await store.getRecord(canonical);
  if (!existing) {
    return { applied: false, reason: "NOT_FOUND" };
  }
  const result = await store.replacePayload({ canonicalKey: canonical, payload: ctx, writeClass });
  if (result.applied) {
    hydrateL1(result.record);
  }
  return result;
}

export async function markVoiceV2CallContextEnded(canonicalKey: string): Promise<VoiceV2PatchResult> {
  registerVoiceV2SessionTerminated(canonicalKey);
  const store = getVoiceV2CallContextStore();
  const result = await store.markEnded(canonicalKey);
  if (result.applied) {
    hydrateL1(result.record);
  } else if (result.reason === "NOT_FOUND") {
    l1.delete(canonicalKey);
  }
  return result;
}

export async function tryRecoverVoiceV2CallContext(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  /** When true, recovery attempted for known-active call with missing L2 */
  requireExistingEnrollment?: boolean;
}): Promise<VoiceV2RecoveryResult> {
  const store = getVoiceV2CallContextStore();
  const canonical = await store.resolveCanonicalSessionKey({ callId: input.callId });
  if (!canonical) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_RECOVERY_FAILED", { reason: "no_canonical" });
    return { ok: false, code: "CALL_CONTEXT_RECOVERY_UNAVAILABLE", detail: "no_canonical_key" };
  }

  const existing = await store.getRecord(canonical);
  if (existing) {
    hydrateL1(existing);
    return { ok: true, record: existing };
  }

  if (!input.requireExistingEnrollment) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_RECOVERY_FAILED", { reason: "l2_miss" });
    return { ok: false, code: "CALL_CONTEXT_RECOVERY_UNAVAILABLE", detail: "l2_miss" };
  }

  const { buildVoiceV2EnrollmentSnapshot } = await import("./enrollment");
  const enrollment = await buildVoiceV2EnrollmentSnapshot({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });

  if (!enrollment.publishedConfigRevision && !enrollment.revisionGaps) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_RECOVERY_FAILED", { reason: "no_enrollment" });
    return { ok: false, code: "CALL_CONTEXT_RECOVERY_UNAVAILABLE", detail: "no_enrollment" };
  }

  const { loadVoiceAgentRuntimeConfig } = await import("@/lib/voice/load-agent-config");
  const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
  const { compileVoiceV2IntakeSchema } = await import("../intake/compile-schema");
  const { loadMctbAiBookingConfig } = await import("@/lib/mctb/ai-booking/config");

  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const runtimeVersion = String(
    (runtime as { versionId?: string; publishedVersionId?: string }).versionId ||
      (runtime as { publishedVersionId?: string }).publishedVersionId ||
      "",
  ).trim();
  if (
    enrollment.publishedConfigRevision &&
    runtimeVersion &&
    runtimeVersion !== enrollment.publishedConfigRevision
  ) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_RECOVERY_FAILED", { reason: "revision_mismatch" });
    return {
      ok: false,
      code: "CALL_CONTEXT_RECOVERY_UNAVAILABLE",
      detail: "REVISION_MISMATCH",
    };
  }

  const intakeSchema = compileVoiceV2IntakeSchema(config);
  const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";
  const now = new Date().toISOString();
  const payload: VoiceV2CallContext = {
    sessionKey: canonical,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema,
    intakeState: {},
    askedFields: {},
    compiledAt: now,
    intakeSaveCount: 0,
  };

  const identity: VoiceV2ContextIdentity = {
    sessionKey: canonical,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  };

  const record = buildRecordFromLegacy({
    payload,
    identity,
    enrollment,
    stateVersion: 0,
  });
  voiceV2ContextMetric("VOICE_V2_CONTEXT_RECONSTRUCTED", { key: canonical });
  await store.createRecord(record);
  hydrateL1(record);
  return { ok: true, record };
}

/** Sync L1 read — same-process hot path (not cross-replica authoritative). */
export function getVoiceV2CallContextL1(sessionKey: string): VoiceV2CallContext | null {
  const entry = l1.get(sessionKey);
  if (entry) {
    voiceV2ContextMetric("VOICE_V2_CONTEXT_L1_HIT", { key: sessionKey, sync: true });
    return syncLegacyFromRecord(entry.record);
  }
  voiceV2ContextMetric("VOICE_V2_CONTEXT_L1_MISS", { key: sessionKey, sync: true });
  return null;
}

export function setVoiceV2CallContextL1(record: VoiceV2CallContextRecord): void {
  hydrateL1(record);
}

export function updateVoiceV2CallContextL1Payload(ctx: VoiceV2CallContext): void {
  const entry = l1.get(ctx.sessionKey);
  if (entry) {
    const nextRecord: VoiceV2CallContextRecord = {
      ...entry.record,
      payload: ctx,
      booking: projectOfferFromLegacy(ctx),
      bookingPreference: ctx.bookingWorkflow?.requestedDate
        ? {
            requestedDate: ctx.bookingWorkflow.requestedDate,
            updatedAt: new Date().toISOString(),
          }
        : entry.record.bookingPreference,
    };
    l1.set(ctx.sessionKey, { record: nextRecord });
    return;
  }
  const stub = buildRecordFromLegacy({
    payload: ctx,
    identity: {
      sessionKey: ctx.sessionKey,
      callId: ctx.sessionKey,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
    },
    enrollment: { enrolledAt: ctx.compiledAt },
    stateVersion: 0,
  });
  l1.set(ctx.sessionKey, { record: stub });
}

export const DISTRIBUTED_TOKEN_LOCK_PRIMITIVE =
  "RedisRealtimeSessionStore.acquireLock() in src/lib/voice/realtime-session/store.ts (used by RedisVoiceV2CallContextStore.patchRecord)";
