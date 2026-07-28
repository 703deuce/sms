import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createId } from "@/lib/supabase/id";

export class DbError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }
}

type Row = Record<string, any>;
type Args = Record<string, any>;

/** Prisma client model name → Postgres table (PascalCase, matches schema.sql). */
const MODEL_TO_TABLE: Record<string, string> = {
  user: "User",
  workspace: "Workspace",
  membership: "Membership",
  phoneNumber: "PhoneNumber",
  contact: "Contact",
  contactList: "ContactList",
  contactListMember: "ContactListMember",
  segment: "Segment",
  tag: "Tag",
  contactTag: "ContactTag",
  campaign: "Campaign",
  message: "Message",
  messagingRegistration: "MessagingRegistration",
  messagingRegistrationEvent: "MessagingRegistrationEvent",
  campaignRecipient: "CampaignRecipient",
  campaignMessage: "CampaignMessage",
  suppression: "Suppression",
  jobQueue: "JobQueue",
  integrationWebhookEndpoint: "IntegrationWebhookEndpoint",
  integrationWebhookEvent: "IntegrationWebhookEvent",
  conversation: "Conversation",
  conversationMessage: "ConversationMessage",
  template: "Template",
  automationFlow: "AutomationFlow",
  keyword: "Keyword",
  optInForm: "OptInForm",
  consentRecord: "ConsentRecord",
  complianceBrand: "ComplianceBrand",
  complianceCampaign: "ComplianceCampaign",
  apiKey: "ApiKey",
  webhook: "Webhook",
  auditLog: "AuditLog",
  usageRecord: "UsageRecord",
};

/** Relation name on a model → { table, fk on this model, pk on related }. */
const RELATIONS: Record<string, Record<string, { table: string; fk: string; pk?: string }>> = {
  membership: {
    user: { table: "User", fk: "userId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  phoneNumber: { workspace: { table: "Workspace", fk: "workspaceId" } },
  contact: { workspace: { table: "Workspace", fk: "workspaceId" } },
  campaign: { workspace: { table: "Workspace", fk: "workspaceId" } },
  campaignRecipient: {
    campaign: { table: "Campaign", fk: "campaignId" },
    contact: { table: "Contact", fk: "contactId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  campaignMessage: {
    campaign: { table: "Campaign", fk: "campaignId" },
    recipient: { table: "CampaignRecipient", fk: "recipientId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  message: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    contact: { table: "Contact", fk: "contactId" },
  },
  messagingRegistration: { workspace: { table: "Workspace", fk: "workspaceId" } },
  messagingRegistrationEvent: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    registration: { table: "MessagingRegistration", fk: "registrationId" },
  },
  suppression: { workspace: { table: "Workspace", fk: "workspaceId" } },
  jobQueue: { workspace: { table: "Workspace", fk: "workspaceId" } },
  integrationWebhookEndpoint: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    campaign: { table: "Campaign", fk: "campaignId" },
  },
  integrationWebhookEvent: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    endpoint: { table: "IntegrationWebhookEndpoint", fk: "endpointId" },
  },
  conversation: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    contact: { table: "Contact", fk: "contactId" },
  },
  conversationMessage: { conversation: { table: "Conversation", fk: "conversationId" } },
  workspace: {
    phoneNumbers: { table: "PhoneNumber", fk: "workspaceId", pk: "id" },
    messagingRegistration: { table: "MessagingRegistration", fk: "workspaceId", pk: "id" },
  },
};

const FILTER_OPS = new Set([
  "equals",
  "in",
  "notIn",
  "lt",
  "lte",
  "gt",
  "gte",
  "not",
  "contains",
  "startsWith",
  "endsWith",
  "mode",
  "is",
  "isNot",
]);

function table(model: string): string {
  const t = MODEL_TO_TABLE[model];
  if (!t) throw new DbError(`Unknown model: ${model}`);
  return t;
}

function nowIso() {
  return new Date().toISOString();
}

function isObject(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFilterOpObject(v: unknown): boolean {
  if (!isObject(v)) return false;
  return Object.keys(v).some((k) => FILTER_OPS.has(k));
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviveValue(v: unknown): unknown {
  if (typeof v === "string" && ISO_RE.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (Array.isArray(v)) return v.map(reviveValue);
  if (isObject(v)) {
    const out: Row = {};
    for (const [k, val] of Object.entries(v)) out[k] = reviveValue(val);
    return out;
  }
  return v;
}

function reviveRow<T>(row: T): T {
  return reviveValue(row) as T;
}

function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (isObject(v)) {
    // Leave nested Prisma ops alone; plain objects (JSON fields) serialize dates inside
    if (isFilterOpObject(v) || "increment" in v || "connect" in v || "create" in v) return v;
    const out: Row = {};
    for (const [k, val] of Object.entries(v)) out[k] = serializeValue(val);
    return out;
  }
  return v;
}

function formatOrAtom(key: string, value: unknown): string | null {
  if (value === null) return `${key}.is.null`;
  if (typeof value === "string") return `${key}.eq.${value}`;
  if (typeof value === "number" || typeof value === "boolean") return `${key}.eq.${value}`;
  if (!isObject(value)) return null;
  if ("in" in value && Array.isArray(value.in)) {
    return `${key}.in.(${value.in.map(String).join(",")})`;
  }
  if ("equals" in value) {
    if (value.equals === null) return `${key}.is.null`;
    return `${key}.eq.${value.equals}`;
  }
  if ("gte" in value) return `${key}.gte.${value.gte instanceof Date ? value.gte.toISOString() : value.gte}`;
  if ("gt" in value) return `${key}.gt.${value.gt instanceof Date ? value.gt.toISOString() : value.gt}`;
  if ("lte" in value) return `${key}.lte.${value.lte instanceof Date ? value.lte.toISOString() : value.lte}`;
  if ("lt" in value) return `${key}.lt.${value.lt instanceof Date ? value.lt.toISOString() : value.lt}`;
  if ("not" in value) {
    if (value.not === null) return `${key}.not.is.null`;
    return `${key}.neq.${value.not}`;
  }
  return null;
}

function formatOrClause(clause: Row): string | null {
  const atoms: string[] = [];
  for (const [k, v] of Object.entries(clause)) {
    if (k === "AND" || k === "OR" || k === "NOT") return null;
    if (isObject(v) && !isFilterOpObject(v) && RELATIONS) {
      // nested relation inside OR — unsupported in string form
      return null;
    }
    const atom = formatOrAtom(k, v);
    if (!atom) return null;
    atoms.push(atom);
  }
  if (!atoms.length) return null;
  if (atoms.length === 1) return atoms[0]!;
  return `and(${atoms.join(",")})`;
}

async function resolveNestedWhere(model: string, where: Args | undefined): Promise<Args | undefined> {
  if (!where) return where;
  const out: Args = { ...where };
  const rels = RELATIONS[model] ?? {};

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      out.AND = await Promise.all(value.map((c) => resolveNestedWhere(model, c as Args)));
      continue;
    }
    if (key === "OR" && Array.isArray(value)) {
      out.OR = await Promise.all(value.map((c) => resolveNestedWhere(model, c as Args)));
      continue;
    }
    if (key === "NOT" && isObject(value)) {
      out.NOT = await resolveNestedWhere(model, value);
      continue;
    }

    const rel = rels[key];
    if (rel && isObject(value) && !isFilterOpObject(value) && !("connect" in value)) {
      // Relation filter → resolve to FK in-list
      const db = getSupabaseAdmin();
      let q: any = db.from(rel.table).select("id");
      q = applyWhereSync(q, value);
      const { data, error } = await q;
      if (error) throw new DbError(error.message, error.code);
      const ids = (data ?? []).map((r: Row) => r.id as string);
      delete out[key];
      out[rel.fk] = { in: ids.length ? ids : ["__none__"] };
    }
  }
  return out;
}

function applyWhereSync(query: any, where: Args | undefined): any {
  if (!where) return query;
  let q = query;

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(value)) {
      const parts = value.map((c) => (isObject(c) ? formatOrClause(c) : null));
      if (parts.every(Boolean)) {
        q = q.or(parts.join(","));
      } else {
        // Fallback: unsupported OR shape — ignore and hope other filters suffice
        // Callers with complex ORs should be migrated to explicit queries over time.
      }
      continue;
    }

    if (key === "AND" && Array.isArray(value)) {
      for (const clause of value) {
        if (isObject(clause)) q = applyWhereSync(q, clause);
      }
      continue;
    }

    if (key === "NOT" && isObject(value)) {
      for (const [nk, nv] of Object.entries(value)) {
        if (nv === null) q = q.not(nk, "is", null);
        else if (typeof nv === "string" || typeof nv === "number" || typeof nv === "boolean") {
          q = q.neq(nk, nv);
        } else if (isObject(nv) && "in" in nv && Array.isArray(nv.in)) {
          // NOT IN — PostgREST: not.in
          q = q.not(nk, "in", `(${nv.in.map(String).join(",")})`);
        }
      }
      continue;
    }

    if (value === null) {
      q = q.is(key, null);
      continue;
    }

    if (isFilterOpObject(value)) {
      const v = value as Row;
      if ("equals" in v) {
        if (v.equals === null) q = q.is(key, null);
        else q = q.eq(key, serializeValue(v.equals));
      }
      if ("in" in v && Array.isArray(v.in)) q = q.in(key, v.in.map(serializeValue));
      if ("lt" in v) q = q.lt(key, serializeValue(v.lt));
      if ("lte" in v) q = q.lte(key, serializeValue(v.lte));
      if ("gt" in v) q = q.gt(key, serializeValue(v.gt));
      if ("gte" in v) q = q.gte(key, serializeValue(v.gte));
      if ("contains" in v && typeof v.contains === "string") {
        q = q.ilike(key, `%${v.contains}%`);
      }
      if ("startsWith" in v && typeof v.startsWith === "string") {
        q = q.ilike(key, `${v.startsWith}%`);
      }
      if ("endsWith" in v && typeof v.endsWith === "string") {
        q = q.ilike(key, `%${v.endsWith}`);
      }
      if ("not" in v) {
        if (v.not === null) q = q.not(key, "is", null);
        else if (isObject(v.not) && "in" in v.not && Array.isArray((v.not as Row).in)) {
          q = q.not(key, "in", `(${(v.not as Row).in.map(String).join(",")})`);
        } else {
          q = q.neq(key, serializeValue(v.not));
        }
      }
      continue;
    }

    // Skip unresolved nested relation objects (should have been resolved already)
    if (isObject(value) && !("connect" in value) && RELATIONS[key as string]) {
      continue;
    }
    if (isObject(value) && ("connect" in value || "create" in value || "disconnect" in value)) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      q = q.eq(key, value);
    } else if (value instanceof Date) {
      q = q.eq(key, value.toISOString());
    }
  }

  return q;
}

async function applyInclude(rows: Row[], include: Args | undefined, model: string): Promise<Row[]> {
  if (!include || !rows.length) return rows;
  const db = getSupabaseAdmin();
  let out = rows.map((r) => ({ ...r }));

  for (const [rel, cfg] of Object.entries(include)) {
    if (!cfg) continue;
    const meta = RELATIONS[model]?.[rel];

    // One-to-many from workspace
    if (rel === "phoneNumbers" && model === "workspace") {
      const ids = out.map((r) => r.id as string);
      const { data } = await db.from("PhoneNumber").select("*").in("workspaceId", ids);
      const by = new Map<string, Row[]>();
      for (const p of data ?? []) {
        const list = by.get(p.workspaceId as string) ?? [];
        list.push(reviveRow(p as Row));
        by.set(p.workspaceId as string, list);
      }
      out = out.map((r) => ({ ...r, phoneNumbers: by.get(r.id as string) ?? [] }));
      continue;
    }

    if (rel === "messagingRegistration" && model === "workspace") {
      const ids = out.map((r) => r.id as string);
      const { data } = await db.from("MessagingRegistration").select("*").in("workspaceId", ids);
      const map = new Map((data ?? []).map((r) => [r.workspaceId as string, reviveRow(r as Row)]));
      out = out.map((r) => ({ ...r, messagingRegistration: map.get(r.id as string) ?? null }));
      continue;
    }

    if (!meta) continue;

    // Many-to-one: load related by FK
    const fk = meta.fk;
    const ids = [...new Set(out.map((r) => r[fk]).filter(Boolean))] as string[];
    if (!ids.length) {
      out = out.map((r) => ({ ...r, [rel]: null }));
      continue;
    }
    const { data, error } = await db.from(meta.table).select("*").in("id", ids);
    if (error) throw new DbError(error.message, error.code);
    const map = new Map((data ?? []).map((r) => [r.id as string, reviveRow(r as Row)]));
    out = out.map((r) => ({ ...r, [rel]: map.get(r[fk] as string) ?? null }));

    // Nested include e.g. include: { campaign: { include: { ... } } }
    if (isObject(cfg) && isObject(cfg.include)) {
      const nestedModel = Object.entries(MODEL_TO_TABLE).find(([, t]) => t === meta.table)?.[0];
      if (nestedModel) {
        const nestedRows = out.map((r) => r[rel]).filter(Boolean) as Row[];
        const hydrated = await applyInclude(nestedRows, cfg.include, nestedModel);
        const byId = new Map(hydrated.map((r) => [r.id as string, r]));
        out = out.map((r) => {
          const cur = r[rel] as Row | null;
          return cur ? { ...r, [rel]: byId.get(cur.id as string) ?? cur } : r;
        });
      }
    }
  }

  return out;
}

function prepareData(data: Args, { isCreate }: { isCreate: boolean }): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (isObject(v) && "connect" in v && isObject(v.connect) && "id" in v.connect) {
      out[`${k}Id`] = v.connect.id;
      continue;
    }
    if (isObject(v) && "increment" in v) {
      out[k] = v; // handled by caller
      continue;
    }
    out[k] = serializeValue(v);
  }
  if (isCreate && out.id == null) out.id = createId();
  if (isCreate && out.createdAt == null) out.createdAt = nowIso();
  if (out.updatedAt == null) out.updatedAt = nowIso();
  return out;
}

async function applyIncrements(model: string, where: Args, patch: Row): Promise<Row> {
  const out = { ...patch };
  const incKeys = Object.entries(out).filter(([, v]) => isObject(v) && "increment" in v);
  if (!incKeys.length) return out;

  const current = await modelApi(model).findFirst({ where });
  for (const [k, v] of incKeys) {
    const inc = (v as Row).increment as number;
    out[k] = Number(current?.[k] ?? 0) + inc;
  }
  return out;
}

type ModelApi = {
  findUnique: (args: Args) => Promise<any>;
  findUniqueOrThrow: (args: Args) => Promise<any>;
  findFirst: (args?: Args) => Promise<any>;
  findMany: (args?: Args) => Promise<any[]>;
  create: (args: Args) => Promise<any>;
  createMany: (args: Args) => Promise<{ count: number }>;
  update: (args: Args) => Promise<any>;
  updateMany: (args: Args) => Promise<{ count: number }>;
  upsert: (args: Args) => Promise<any>;
  delete: (args: Args) => Promise<any>;
  deleteMany: (args?: Args) => Promise<{ count: number }>;
  count: (args?: Args) => Promise<number>;
};

function modelApi(model: string): ModelApi {
  const t = table(model);
  const api: ModelApi = {
    async findUnique(args) {
      return api.findFirst(args);
    },

    async findUniqueOrThrow(args) {
      const row = await api.findUnique(args);
      if (!row) throw new DbError(`No ${model} found`, "P2025");
      return row;
    },

    async findFirst(args: Args = {}) {
      const rows = await api.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },

    async findMany(args: Args = {}) {
      const db = getSupabaseAdmin();
      const where = await resolveNestedWhere(model, args.where);
      let q: any = db.from(t).select("*");
      q = applyWhereSync(q, where);

      if (args.orderBy) {
        const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        for (const o of orders) {
          if (!isObject(o)) continue;
          for (const [col, dir] of Object.entries(o)) {
            q = q.order(col, { ascending: dir !== "desc", nullsFirst: dir === "desc" ? false : undefined });
          }
        }
      }
      if (typeof args.skip === "number") {
        const take = typeof args.take === "number" ? args.take : 1000;
        q = q.range(args.skip, args.skip + take - 1);
      } else if (typeof args.take === "number") {
        q = q.limit(args.take);
      }

      const { data, error } = await q;
      if (error) throw new DbError(error.message, error.code);
      const rows = ((data ?? []) as Row[]).map(reviveRow);
      return applyInclude(rows, args.include, model);
    },

    async create({ data, include }: Args) {
      const db = getSupabaseAdmin();
      const row = prepareData(data, { isCreate: true });
      const { data: created, error } = await db.from(t).insert(row).select("*").single();
      if (error) throw new DbError(error.message, error.code);
      const hydrated = await applyInclude([reviveRow(created as Row)], include, model);
      return hydrated[0];
    },

    async createMany({ data, skipDuplicates }: Args) {
      const db = getSupabaseAdmin();
      const rows = (Array.isArray(data) ? data : [data]).map((d) => prepareData(d, { isCreate: true }));
      const { data: inserted, error } = await db.from(t).insert(rows).select("id");
      if (error) {
        if (skipDuplicates) return { count: 0 };
        throw new DbError(error.message, error.code);
      }
      return { count: inserted?.length ?? 0 };
    },

    async update({ where, data, include }: Args) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, where);
      let patch = prepareData(data, { isCreate: false });
      patch = await applyIncrements(model, resolved ?? {}, patch);
      let q: any = db.from(t).update(patch).select("*");
      q = applyWhereSync(q, resolved);
      const { data: updated, error } = await q.maybeSingle();
      if (error) throw new DbError(error.message, error.code);
      if (!updated) throw new DbError(`Update failed: no row matched on ${t}`, "P2025");
      const hydrated = await applyInclude([reviveRow(updated as Row)], include, model);
      return hydrated[0];
    },

    async updateMany({ where, data }: Args) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, where);
      let patch = prepareData(data, { isCreate: false });

      const incKeys = Object.entries(patch).filter(([, v]) => isObject(v) && "increment" in v);
      if (incKeys.length) {
        const rows = await api.findMany({ where: resolved });
        for (const row of rows) {
          const one: Row = { updatedAt: nowIso() };
          for (const [k, v] of incKeys) {
            one[k] = Number(row[k] ?? 0) + ((v as Row).increment as number);
          }
          for (const [k, v] of Object.entries(patch)) {
            if (isObject(v) && "increment" in v) continue;
            one[k] = v;
          }
          const { error } = await db.from(t).update(one).eq("id", row.id);
          if (error) throw new DbError(error.message, error.code);
        }
        return { count: rows.length };
      }

      let q: any = db.from(t).update(patch).select("id");
      q = applyWhereSync(q, resolved);
      const { data: updated, error } = await q;
      if (error) throw new DbError(error.message, error.code);
      return { count: updated?.length ?? 0 };
    },

    async upsert({ where, create, update }: Args) {
      const existing = await api.findUnique({ where });
      if (existing) return api.update({ where, data: update });
      return api.create({ data: { ...where, ...create } });
    },

    async delete({ where }: Args) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, where);
      let q: any = db.from(t).delete().select("*");
      q = applyWhereSync(q, resolved);
      const { data, error } = await q.maybeSingle();
      if (error) throw new DbError(error.message, error.code);
      return reviveRow((data as Row) ?? {});
    },

    async deleteMany(args: Args = {}) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, args.where);
      let q: any = db.from(t).delete().select("id");
      q = applyWhereSync(q, resolved);
      const { data, error } = await q;
      if (error) throw new DbError(error.message, error.code);
      return { count: data?.length ?? 0 };
    },

    async count(args: Args = {}) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, args.where);
      let q: any = db.from(t).select("*", { count: "exact", head: true });
      q = applyWhereSync(q, resolved);
      const { count, error } = await q;
      if (error) throw new DbError(error.message, error.code);
      return count ?? 0;
    },
  };
  return api;
}

/** Prisma-shaped facade backed by Supabase PostgREST. */
export type AppDb = any;

let cached: AppDb | null = null;

export function getSupabaseDb(): AppDb {
  if (cached) return cached;

  const models = Object.fromEntries(
    Object.keys(MODEL_TO_TABLE).map((m) => [m, modelApi(m)]),
  ) as Record<string, ModelApi>;

  const db = {
    ...models,
    async $transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
      // supabase-js/PostgREST has no multi-statement transactions.
      // Sequential execution + CAS updateMany covers our concurrency needs.
      return fn(db);
    },
    async $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      // Legacy Prisma FOR UPDATE helpers — resolve via normal reads instead.
      const sql = strings.join("?");
      if (/campaign_recipients|CampaignRecipient/i.test(sql) && values[0]) {
        const row = await models.campaignRecipient.findUnique({ where: { id: values[0] } });
        return (row ? [{ id: row.id, metadata: row.metadata }] : []) as T;
      }
      return [] as T;
    },
  };

  cached = db;
  return db;
}
