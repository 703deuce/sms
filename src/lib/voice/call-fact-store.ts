/**
 * CallFactStore — lightweight per-call facts (local DB, no CRM during call).
 * Backed by voiceCall.metadata.callFactStore for low latency.
 */

import { getPrisma } from "@/lib/db";

export type CallFactEntry = {
  key: string;
  raw_value: string;
  normalized_value?: string | null;
  confidence?: number | null;
  source_turn_id?: string | null;
  confirmed: boolean;
  source: "caller_stt" | "agent" | "tool" | "caller_id" | "inferred";
  updated_at: string;
};

export type CallFactStore = {
  facts: Record<string, CallFactEntry>;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyCallFactStore(): CallFactStore {
  return { facts: {}, updated_at: new Date().toISOString() };
}

export async function loadCallFactStore(callId: string): Promise<CallFactStore> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const raw = asRecord(meta.callFactStore);
  if (!Object.keys(raw).length) return emptyCallFactStore();
  return {
    facts: asRecord(raw.facts) as CallFactStore["facts"],
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

export async function saveCallFactStore(callId: string, store: CallFactStore): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const next = { ...store, updated_at: new Date().toISOString() };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        callFactStore: next,
      },
    },
  });
}

export async function upsertCallFact(input: {
  callId: string;
  key: string;
  rawValue: string;
  normalizedValue?: string | null;
  confidence?: number | null;
  sourceTurnId?: string | null;
  confirmed?: boolean;
  source?: CallFactEntry["source"];
}): Promise<CallFactStore> {
  const key = input.key.trim();
  const raw = input.rawValue.trim();
  if (!key || !raw) throw new Error("fact key and value required");

  const store = await loadCallFactStore(input.callId);
  const prev = store.facts[key];
  store.facts[key] = {
    key,
    raw_value: raw,
    normalized_value: input.normalizedValue ?? raw,
    confidence: input.confidence ?? prev?.confidence ?? null,
    source_turn_id: input.sourceTurnId ?? prev?.source_turn_id ?? null,
    confirmed: input.confirmed ?? prev?.confirmed ?? false,
    source: input.source ?? prev?.source ?? "tool",
    updated_at: new Date().toISOString(),
  };
  await saveCallFactStore(input.callId, store);
  return store;
}

export function callFactsToRecord(store: CallFactStore): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fact] of Object.entries(store.facts)) {
    out[key] = fact.confirmed ? fact.normalized_value || fact.raw_value : fact.raw_value;
    out[`${key}_confirmed`] = fact.confirmed;
  }
  return out;
}
