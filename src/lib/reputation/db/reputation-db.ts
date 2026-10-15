import "server-only";

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

let reputationPrisma: PrismaClient | null = null;

/** Postgres Prisma client for reputation tables (not Supabase PostgREST compat). */
function getReputationPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for Reviews reputation database operations");
  }
  if (!reputationPrisma) {
    const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
    reputationPrisma = new Client();
  }
  return reputationPrisma;
}

const ALLOWED_TABLES = new Set([
  "reputation_workspace_profile",
  "business_reviews",
  "business_review_snapshots",
  "review_sync_state",
  "review_request_templates",
  "review_request_contacts",
  "review_request_campaigns",
  "review_request_recipients",
  "review_request_messages",
  "review_request_sends",
  "review_request_links",
  "review_request_events",
  "review_request_replies",
  "review_request_suppression",
  "reputation_alerts",
  "review_notification_settings",
  "review_notification_events",
  "reputation_settings",
  "review_momentum_runs",
  "review_momentum_entities",
  "review_momentum_tasks",
  "review_qr_campaigns",
  "review_qr_scans",
  "review_qr_events",
  "review_qr_daily_stats",
  "review_qr_audit_events",
  "competitors",
  "reputation_audits",
  "review_campaign_attributions",
  "review_keyword_gaps",
  "reputation_tasks",
  "reputation_competitors",
  "business_keywords",
  "review_campaign_steps",
  "review_campaign_runs",
  "review_records",
  "review_request_clicks",
  "review_request_uploads",
  "review_response_drafts",
  "scan_batches",
  "scan_points",
  "scan_results",
  "scheduled_scans",
  "maps_campaigns",
  "integration_webhook_endpoints",
  "organizations",
  "payment_page_configurations",
  "payment_page_methods",
  "payment_page_suggested_amounts",
  "payment_request_sessions",
]);

const TIMESTAMPTZ_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "scheduled_for",
  "started_at",
  "finished_at",
  "sent_at",
  "delivered_at",
  "clicked_at",
  "archived_at",
  "scanned_at",
  "last_used_at",
  "published_at",
  "owner_responded_at",
]);

const JSONB_COLUMN_HINTS = new Set([
  "settings_json",
  "payload_json",
  "config_json",
  "raw_json",
  "metadata",
  "metrics_json",
  "known_review_ids",
  "tags",
  "send_days",
  "poster_config",
  "warnings",
  "aggregate_metrics",
]);

function sqlValue(col: string, val: unknown): unknown {
  if (val === undefined) return null;
  if (val !== null && typeof val === "object" && JSONB_COLUMN_HINTS.has(col)) {
    return JSON.stringify(val);
  }
  return val;
}

type Row = Record<string, unknown>;

type Filter =
  | { op: "eq"; col: string; val: unknown }
  | { op: "neq"; col: string; val: unknown }
  | { op: "in"; col: string; vals: unknown[] }
  | { op: "not"; col: string; kind: "is"; val: null }
  | { op: "gte"; col: string; val: unknown }
  | { op: "lt"; col: string; val: unknown }
  | { op: "is"; col: string; val: null }
  | { op: "or"; expr: string }
  | { op: "ilike"; col: string; pattern: string };

function mapSuppressionColumn(table: string, col: string): string {
  if (table === "review_request_suppression" && col === "business_id") return "workspaceId";
  return col;
}

function toSnake(col: string): string {
  return col.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function rowToSnake(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[toSnake(k)] = v;
  }
  return out;
}

function rowFromDb(table: string, row: Row): Row {
  if (table === "review_request_suppression") {
    const { workspaceId, ...rest } = row as { workspaceId?: string };
    return { ...rest, business_id: workspaceId };
  }
  return row;
}

/** Tables with a non-`id` primary key — do not inject a synthetic `id` on insert/upsert. */
const TABLES_WITHOUT_AUTO_ID = new Set(["reputation_settings"]);

function tableUsesAutoId(table: string): boolean {
  return !TABLES_WITHOUT_AUTO_ID.has(table);
}

function insertPayload(table: string, payload: Row): Row {
  if (table === "review_request_suppression") {
    const p = { ...payload };
    if (p.business_id && !p.workspaceId) {
      p.workspaceId = p.business_id;
      delete p.business_id;
    }
    if (!p.suppressionKey && (p.phone || p.email)) {
      const phone = String(p.phone || "");
      const email = String(p.email || "").toLowerCase();
      p.suppressionKey = phone ? `p:${phone}` : `e:${email}`;
    }
    if (!p.reason) p.reason = "review_opt_out";
    return p;
  }
  return payload;
}

class ReputationQueryBuilder {
  private filters: Filter[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private selectCols = "*";
  private countOnly = false;
  private headOnly = false;

  constructor(
    private readonly table: string,
    private readonly mode: "select" | "update" | "delete" = "select",
    private updatePayload: Row | null = null,
  ) {}

  select(cols: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count === "exact" && opts?.head) {
      this.countOnly = true;
      this.headOnly = true;
      this.selectCols = cols;
      return this;
    }
    this.selectCols = cols.split("(")[0]?.trim() || cols;
    return this;
  }

  ilike(col: string, pattern: string) {
    this.filters.push({ op: "ilike", col, pattern });
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ op: "eq", col, val });
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push({ op: "neq", col, val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push({ op: "in", col, vals });
    return this;
  }

  not(col: string, kind: string, val: unknown) {
    if (kind === "is" && val === null) this.filters.push({ op: "not", col, kind: "is", val: null });
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push({ op: "gte", col, val });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push({ op: "lt", col, val });
    return this;
  }

  is(col: string, val: unknown) {
    if (val === null) this.filters.push({ op: "is", col, val: null });
    return this;
  }

  or(expr: string) {
    this.filters.push({ op: "or", expr });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private whereSql(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((f) => {
      const col = mapSuppressionColumn(this.table, f.col);
      const sqlCol = `"${col}"`;
      if (f.op === "eq") {
        params.push(f.val);
        return `${sqlCol} = $${params.length}`;
      }
      if (f.op === "neq") {
        params.push(f.val);
        return `${sqlCol} <> $${params.length}`;
      }
      if (f.op === "in") {
        params.push(f.vals);
        return `${sqlCol} = ANY($${params.length})`;
      }
      if (f.op === "not") {
        return `${sqlCol} IS NOT NULL`;
      }
      if (f.op === "gte") {
        params.push(f.val);
        return `${sqlCol} >= $${params.length}`;
      }
      if (f.op === "lt") {
        params.push(f.val);
        return `${sqlCol} < $${params.length}`;
      }
      if (f.op === "is") {
        return `${sqlCol} IS NULL`;
      }
      if (f.op === "ilike") {
        params.push(f.pattern);
        return `${sqlCol} ILIKE $${params.length}`;
      }
      if (f.op === "or") {
        const clauses = f.expr.split(",").map((part) => {
          const m = part.trim().match(/^([a-zA-Z0-9_]+)\.(eq|neq|ilike)\.(.+)$/);
          if (!m) return "FALSE";
          const [, col, op, rawVal] = m;
          const sqlC = `"${mapSuppressionColumn(this.table, col)}"`;
          if (op === "ilike") {
            params.push(rawVal);
            return `${sqlC} ILIKE $${params.length}`;
          }
          if (op === "eq") {
            const bool =
              rawVal === "true" ? true : rawVal === "false" ? false : rawVal;
            params.push(bool);
            return `${sqlC} = $${params.length}`;
          }
          params.push(rawVal);
          return `${sqlC} <> $${params.length}`;
        });
        return `(${clauses.join(" OR ")})`;
      }
      return "TRUE";
    });
    return `WHERE ${parts.join(" AND ")}`;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: Error | null; count?: number }> {
    if (this.mode === "update") {
      const res = await this.limit(1).executeUpdate();
      if (res.error) return res;
      return { data: res.data?.[0] ?? null, error: null, count: res.count };
    }
    const res = await this.limit(1).executeSelect();
    if (res.error) return res;
    return { data: res.data?.[0] ?? null, error: null, count: res.count };
  }

  async single(): Promise<{ data: Row | null; error: Error | null }> {
    const res = await this.maybeSingle();
    if (res.error) return res;
    if (!res.data) return { data: null, error: new Error("No rows") };
    return res;
  }

  private async executeSelect(): Promise<{ data: Row[] | null; error: Error | null; count?: number }> {
    const prisma = getReputationPrisma();
    const params: unknown[] = [];
    const where = this.whereSql(params);
    if (this.countOnly) {
      const sql = `SELECT COUNT(*)::int AS count FROM "${this.table}" ${where}`;
      try {
        const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as { count: number }[];
        const count = rows[0]?.count ?? 0;
        return { data: this.headOnly ? null : [{ count }], error: null, count };
      } catch (e) {
        return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
      }
    }
    let sql = `SELECT ${this.selectCols === "*" ? "*" : this.selectCols} FROM "${this.table}" ${where}`;
    if (this.orderBy) {
      const col = mapSuppressionColumn(this.table, this.orderBy.col);
      sql += ` ORDER BY "${col}" ${this.orderBy.ascending ? "ASC" : "DESC"}`;
    }
    if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
    try {
      const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Row[];
      return { data: rows.map((r) => rowFromDb(this.table, r)), error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const table = this.table;
    const runSingle = async (): Promise<{ data: Row | null; error: Error | null }> => {
      const prisma = getReputationPrisma();
      const inserted: Row[] = [];
      for (const raw of rows) {
        const p = insertPayload(table, { ...raw });
        if (tableUsesAutoId(table) && !p.id) p.id = randomUUID();
        const cols = Object.keys(p);
        const vals = cols.map((_, i) => `$${i + 1}`);
        const castCols = cols.map((c) => {
          const v = p[c];
          if (v !== null && typeof v === "object" && JSONB_COLUMN_HINTS.has(c)) {
            return `"${c}"`;
          }
          return `"${c}"`;
        });
        const valueExprs = cols.map((c, i) => {
          const v = p[c];
          if (v !== null && typeof v === "object" && JSONB_COLUMN_HINTS.has(c)) {
            return `$${i + 1}::jsonb`;
          }
          if (TIMESTAMPTZ_COLUMNS.has(c) && (typeof v === "string" || v instanceof Date)) {
            return `$${i + 1}::timestamptz`;
          }
          return `$${i + 1}`;
        });
        const sql = `INSERT INTO "${table}" (${castCols.join(",")}) VALUES (${valueExprs.join(",")}) RETURNING *`;
        try {
          const out = (await prisma.$queryRawUnsafe(
            sql,
            ...cols.map((c) => sqlValue(c, p[c])),
          )) as Row[];
          inserted.push(rowFromDb(table, out[0]!));
        } catch (e) {
          return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
      }
      return { data: inserted[0] ?? null, error: null };
    };
    const chain = {
      select: (_cols?: string) => ({
        single: runSingle,
        maybeSingle: runSingle,
      }),
      then<TResult1 = { data: Row | null; error: Error | null }, TResult2 = never>(
        onfulfilled?: ((value: { data: Row | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        return runSingle().then(onfulfilled, onrejected);
      },
    };
    return chain;
  }

  update(payload: Row) {
    const builder = new ReputationQueryBuilder(this.table, "update", payload);
    builder.filters = [...this.filters];
    return builder;
  }

  async executeUpdate(): Promise<{ data: Row[] | null; error: Error | null; count?: number }> {
    if (!this.updatePayload) return { data: null, error: new Error("missing update payload") };
    const prisma = getReputationPrisma();
    const p = insertPayload(this.table, { ...this.updatePayload });
    const setCols = Object.keys(p);
    const params: unknown[] = [...setCols.map((c) => sqlValue(c, p[c]))];
    const setSql = setCols
      .map((c, i) => {
        const v = p[c];
        if (v !== null && typeof v === "object" && JSONB_COLUMN_HINTS.has(c)) {
          return `"${c}" = $${i + 1}::jsonb`;
        }
        if (TIMESTAMPTZ_COLUMNS.has(c) && (typeof v === "string" || v instanceof Date)) {
          return `"${c}" = $${i + 1}::timestamptz`;
        }
        return `"${c}" = $${i + 1}`;
      })
      .join(", ");
    const where = this.whereSql(params);
    const returning =
      this.selectCols === "*" ? "*" : this.selectCols.split(",").map((c) => c.trim()).join(", ");
    const sql = `UPDATE "${this.table}" SET ${setSql} ${where} RETURNING ${returning}`;
    try {
      const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Row[];
      return { data: rows.map((r) => rowFromDb(this.table, r)), error: null, count: rows.length };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  upsert(
    payload: Row,
    opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): {
    select: (_?: string) => { single: () => Promise<{ data: Row | null; error: Error | null }> };
    then: (
      onfulfilled?: (value: { error: Error | null }) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } {
    const conflict = opts?.onConflict ?? "id";
    const runUpsert = async (): Promise<{ data: Row | null; error: Error | null }> => {
          const prisma = getReputationPrisma();
          const p = insertPayload(this.table, { ...payload });
          if (tableUsesAutoId(this.table) && !p.id) p.id = randomUUID();
          const cols = Object.keys(p);
          const vals = cols.map((_, i) => `$${i + 1}`);
          const updates = cols
            .filter((c) => c !== conflict)
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(", ");
      const valueExprs = cols.map((c, i) => {
        const v = p[c];
        if (v !== null && typeof v === "object" && JSONB_COLUMN_HINTS.has(c)) {
          return `$${i + 1}::jsonb`;
        }
        if (TIMESTAMPTZ_COLUMNS.has(c) && (typeof v === "string" || v instanceof Date)) {
          return `$${i + 1}::timestamptz`;
        }
        return `$${i + 1}`;
      });
      const onConflict = opts?.ignoreDuplicates
        ? `ON CONFLICT ("${conflict}") DO NOTHING`
        : `ON CONFLICT ("${conflict}") DO UPDATE SET ${updates}`;
      const sql = `INSERT INTO "${this.table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${valueExprs.join(",")})
            ${onConflict} RETURNING *`;
      try {
        const out = (await prisma.$queryRawUnsafe(
          sql,
          ...cols.map((c) => sqlValue(c, p[c])),
        )) as Row[];
        return { data: rowFromDb(this.table, out[0] ?? null), error: null };
      } catch (e) {
        return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
      }
    };
    return {
      select: () => ({
        single: runUpsert,
      }),
      then(onfulfilled, onrejected) {
        return runUpsert()
          .then((r) => (onfulfilled ? onfulfilled({ error: r.error }) : r))
          .catch(onrejected);
      },
    };
  }

  delete() {
    const builder = new ReputationQueryBuilder(this.table, "delete");
    builder.filters = [...this.filters];
    return builder;
  }

  private async executeDelete(): Promise<{ data: Row[] | null; error: Error | null }> {
    const prisma = getReputationPrisma();
    const params: unknown[] = [];
    const where = this.whereSql(params);
    const sql = `DELETE FROM "${this.table}" ${where}`;
    try {
      await prisma.$queryRawUnsafe(sql, ...params);
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  // Make select chains thenable for `const { data } = await query`
  then<TResult1 = { data: Row[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this.mode === "update") {
      return this.executeUpdate().then(onfulfilled as never, onrejected);
    }
    if (this.mode === "delete") {
      return this.executeDelete().then(onfulfilled as never, onrejected);
    }
    return this.executeSelect().then(onfulfilled, onrejected);
  }
}

export type ReputationDbClient = {
  from: (table: string) => ReputationQueryBuilder;
};

export function createReputationDbClient(): ReputationDbClient {
  return {
    from(table: string) {
      if (table === "businesses") {
        return new BusinessesQueryBuilder();
      }
      if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`reputation_db_table_not_allowed:${table}`);
      }
      return new ReputationQueryBuilder(table);
    },
  };
}

/** Map legacy `businesses` reads to Transovo workspaces. */
class BusinessesQueryBuilder extends ReputationQueryBuilder {
  constructor() {
    super("Workspace");
  }

  private workspaceIdFilter: string | null = null;
  private updatePayload: Row | null = null;

  update(payload: Row) {
    this.updatePayload = payload;
    return this;
  }

  eq(col: string, val: unknown) {
    if (col === "id") this.workspaceIdFilter = String(val);
    return this;
  }

  private async applyBusinessUpdate(): Promise<{ error: Error | null }> {
    if (!this.workspaceIdFilter || !this.updatePayload) {
      return { error: new Error("business update missing id or payload") };
    }
    const prisma = getReputationPrisma();
    const cid = this.updatePayload.cid as string | undefined;
    if (cid) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO reputation_workspace_profile (workspace_id, google_place_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (workspace_id) DO UPDATE SET google_place_id = EXCLUDED.google_place_id, updated_at = now()`,
        this.workspaceIdFilter,
        cid,
      );
    }
    return { error: null };
  }

  override async maybeSingle(): Promise<{ data: Row | null; error: Error | null }> {
    if (!this.workspaceIdFilter) return { data: null, error: new Error("business id required") };
    try {
      const prisma = getReputationPrisma();
      const row = await prisma.workspace.findUnique({
        where: { id: this.workspaceIdFilter },
        select: { id: true, name: true, displayName: true },
      });
      if (!row) return { data: null, error: null };
      return {
        data: {
          id: row.id,
          organization_id: row.id,
          name: row.displayName ?? row.name,
        },
        error: null,
      };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  override async single(): Promise<{ data: Row | null; error: Error | null }> {
    const res = await this.maybeSingle();
    if (res.error) return res;
    if (!res.data) return { data: null, error: new Error("No rows") };
    return res;
  }

  then<TResult1 = { data: Row[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this.updatePayload) {
      return this.applyBusinessUpdate().then((r) => {
        const wrapped = { data: null, error: r.error };
        return onfulfilled ? onfulfilled(wrapped) : (wrapped as TResult1);
      }, onrejected);
    }
    return this.maybeSingle().then((r) => {
      const wrapped = { data: r.data ? [r.data] : [], error: r.error };
      return onfulfilled ? onfulfilled(wrapped) : (wrapped as TResult1);
    }, onrejected);
  }
}
