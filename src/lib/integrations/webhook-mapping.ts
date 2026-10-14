export type FieldMapping = Partial<{
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  name: string;
  external_customer_id: string;
  event_id: string;
}>;

function readPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function walk(
  obj: unknown,
  prefix: string,
  hits: Array<{ path: string; key: string; value: string }>,
  depth = 0,
) {
  if (depth > 6 || obj == null) return;
  if (typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.slice(0, 3).forEach((item, i) => walk(item, `${prefix}[${i}]`, hits, depth + 1));
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" && v.length > 0 && v.length < 200) {
      hits.push({ path, key: k.toLowerCase(), value: v });
    }
    walk(v, path, hits, depth + 1);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

export function detectFieldMapping(sample: unknown): FieldMapping {
  const hits: Array<{ path: string; key: string; value: string }> = [];
  walk(sample, "", hits);
  const mapping: FieldMapping = {};

  for (const h of hits) {
    if (!mapping.email && (h.key.includes("email") || EMAIL_RE.test(h.value))) {
      mapping.email = h.path;
    }
    if (!mapping.phone && (h.key.includes("phone") || h.key.includes("mobile") || PHONE_RE.test(h.value))) {
      mapping.phone = h.path;
    }
    if (!mapping.first_name && (h.key === "firstname" || h.key === "first_name" || h.key === "givenname")) {
      mapping.first_name = h.path;
    }
    if (!mapping.last_name && (h.key === "lastname" || h.key === "last_name" || h.key === "familyname")) {
      mapping.last_name = h.path;
    }
    if (!mapping.name && h.key === "name") mapping.name = h.path;
    if (!mapping.external_customer_id && (h.key.includes("customer") || h.key.includes("client_id"))) {
      mapping.external_customer_id = h.path;
    }
    if (!mapping.event_id && (h.key === "id" || h.key.includes("event_id"))) {
      mapping.event_id = h.path;
    }
  }
  return mapping;
}

export function applyFieldMapping(
  payload: Record<string, unknown>,
  mapping: FieldMapping,
  _ctx?: { eventType?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  const normalized: Record<string, unknown> = {};
  for (const [field, path] of Object.entries(mapping)) {
    if (!path) continue;
    const val = readPath(payload, path);
    if (val !== undefined && val !== null && val !== "") {
      normalized[field] = val;
    }
  }
  out._normalized = normalized;
  return out;
}
