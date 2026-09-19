#!/usr/bin/env npx tsx
/**
 * Production-equivalent callback persistence boundary: Supabase prisma-compat
 * must expose callbackRequest with findFirst/create used by persist-voice-v3-callback-request.
 */
import assert from "node:assert/strict";

type Row = Record<string, unknown>;

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://voice-v3-callback-compat.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "compat-test-key";

const callbackRows: Row[] = [];

function getAtPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const segment of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Row)[segment];
  }
  return cur;
}

function readJsonPathColumn(row: Row, column: string): unknown {
  if (!column.includes("->")) return row[column];
  const arrowIdx = column.lastIndexOf("->>");
  if (arrowIdx === -1) return row[column];
  const left = column.slice(0, arrowIdx);
  const leaf = column.slice(arrowIdx + 3);
  const segments = left.split("->");
  let cur: unknown = row;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Row)[seg];
  }
  if (cur == null || typeof cur !== "object") return undefined;
  return (cur as Row)[leaf];
}

function rowMatchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      if (!value.every((clause) => rowMatchesWhere(row, clause as Row))) return false;
      continue;
    }
    if (value && typeof value === "object" && "path" in value && "equals" in value) {
      const path = (value as Row).path as string[];
      const equals = (value as Row).equals;
      const at = getAtPath(row[key], path);
      if (at !== equals) return false;
      continue;
    }
    if (value && typeof value === "object" && "equals" in value) {
      if (row[key] !== (value as Row).equals) return false;
      continue;
    }
    const at = readJsonPathColumn(row, key);
    if (at !== value) return false;
  }
  return true;
}

class MockQuery implements PromiseLike<{ data: Row[] | Row | null; error: null }> {
  private table: string;
  private mode: "select" | "insert" | "update" = "select";
  private where: Row = {};
  private insertPayload: Row | Row[] | null = null;
  private limitN: number | null = null;
  private singleRow = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) {
    return this;
  }

  eq(col: string, val: unknown) {
    this.where[col] = val;
    return this;
  }

  is(col: string, val: unknown) {
    if (val === null) this.where[col] = null;
    return this;
  }

  neq() {
    return this;
  }

  not() {
    return this;
  }

  in() {
    return this;
  }

  or() {
    return this;
  }

  order() {
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  range(_from: number, _to: number) {
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.insertPayload = payload;
    return this;
  }

  update() {
    this.mode = "update";
    return this;
  }

  maybeSingle() {
    this.limitN = 1;
    this.singleRow = true;
    return this;
  }

  single() {
    this.limitN = 1;
    this.singleRow = true;
    return this;
  }

  then<TResult1 = { data: Row[] | Row | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | Row | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): { data: Row[] | Row | null; error: null } {
    if (this.table !== "callback_requests") {
      return { data: null, error: null };
    }
    if (this.mode === "insert" && this.insertPayload) {
      const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
      const created: Row[] = [];
      for (const raw of rows) {
        const row: Row = {
          ...raw,
          id: typeof raw.id === "string" ? raw.id : `cb_${callbackRows.length + 1}`,
        };
        callbackRows.push(row);
        created.push(row);
      }
      const one = created[0] ?? null;
      return { data: this.limitN === 1 ? one : created, error: null };
    }

    let rows = callbackRows.filter((r) => rowMatchesWhere(r, this.where));
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.singleRow) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

const globalAdmin = globalThis as unknown as {
  __supabaseAdmin?: { from: (t: string) => MockQuery };
};
// Prevent real Supabase client from replacing the in-memory harness.
globalAdmin.__supabaseAdmin = {
  from(table: string) {
    return new MockQuery(table);
  },
};

async function main() {
  const { getSupabaseDb } = await import("../src/lib/supabase/prisma-compat");
  const { persistVoiceV3CallbackRequest } = await import(
    "../src/lib/voice-v3/callback/persist-voice-v3-callback-request"
  );

  const db = getSupabaseDb();
  assert.ok(db.callbackRequest, "prisma-compat must expose callbackRequest");
  assert.equal(typeof db.callbackRequest.findFirst, "function");
  assert.equal(typeof db.callbackRequest.create, "function");

  const baseInput = {
    workspaceId: "ws_compat_test",
    agentId: "agent_compat",
    callId: "call_compat_1",
    liveSessionId: "live_compat_1",
    callerName: "PSTN Tester",
    inboundAni: "+15715550100",
    callbackPhoneE164: "+15715550100",
    reason: "Water heater",
    preferredTime: null,
    notes: null,
    customFieldsSnapshot: { name: { value: "PSTN Tester" } },
    idempotencyKey: "v3cb:idem_compat_1",
    businessE164: "+15717491060",
    phoneNumberId: "pn_compat",
  };

  const first = await persistVoiceV3CallbackRequest(baseInput);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("first persist failed");
  assert.equal(first.duplicate, false);
  assert.ok(first.callbackRequestId);

  const row = callbackRows.find((r) => r.id === first.callbackRequestId);
  assert.ok(row);
  const metadata = row.metadata as Row;
  assert.equal((metadata as Row).source, "VOICE_V3");
  assert.equal(
    getAtPath(metadata, ["voiceV3", "idempotencyKey"]),
    baseInput.idempotencyKey,
  );

  const dup = await persistVoiceV3CallbackRequest(baseInput);
  assert.equal(dup.ok, true);
  if (!dup.ok) throw new Error("duplicate persist failed");
  assert.equal(dup.duplicate, true);
  assert.equal(dup.callbackRequestId, first.callbackRequestId);
  assert.equal(callbackRows.length, 1, "idempotent duplicate must not insert another row");

  const viaCompat = await db.callbackRequest.findFirst({
    where: {
      workspaceId: baseInput.workspaceId,
      metadata: {
        path: ["voiceV3", "idempotencyKey"],
        equals: baseInput.idempotencyKey,
      },
    },
    select: { id: true },
  });
  assert.equal(viaCompat?.id, first.callbackRequestId);

  console.log("PASS voice-v3 callback prisma-compat persistence");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
