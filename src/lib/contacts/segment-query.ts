import { getPrisma } from "@/lib/db";

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "exists"
  | "not_exists";

export type SegmentRule = {
  /** "status" | "tag" | "source" | "provider" | "custom:<fieldKey>" */
  field: string;
  op: SegmentOperator;
  value?: string;
};

export type SegmentConditions = {
  match: "all" | "any";
  rules: SegmentRule[];
};

/** Normalize arbitrary stored JSON into a SegmentConditions shape. */
export function parseSegmentConditions(raw: unknown): SegmentConditions {
  if (!raw || typeof raw !== "object") return { match: "all", rules: [] };
  const obj = raw as Record<string, unknown>;
  const match = obj.match === "any" ? "any" : "all";
  const rulesRaw = Array.isArray(obj.rules) ? obj.rules : [];
  const rules: SegmentRule[] = rulesRaw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const rr = r as Record<string, unknown>;
      const field = String(rr.field || "").trim();
      const op = String(rr.op || "equals") as SegmentOperator;
      if (!field) return null;
      return {
        field,
        op,
        value: rr.value == null ? undefined : String(rr.value),
      } as SegmentRule;
    })
    .filter((r): r is SegmentRule => r !== null);
  return { match, rules };
}

type EvaluableContact = {
  id: string;
  status: string;
  customFields: unknown;
  /** Tag names attached to the contact. */
  tagNames: string[];
  /** consentSource / import source */
  source?: string | null;
  /** Connected integration provider ids (from external mappings). */
  providers?: string[];
};

function stringVal(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function evaluateRule(contact: EvaluableContact, rule: SegmentRule): boolean {
  const target = (rule.value ?? "").trim();
  const targetLc = target.toLowerCase();

  if (rule.field === "status") {
    const status = contact.status.toLowerCase();
    switch (rule.op) {
      case "equals":
        return status === targetLc;
      case "not_equals":
        return status !== targetLc;
      case "exists":
        return Boolean(contact.status);
      case "not_exists":
        return !contact.status;
      default:
        return status.includes(targetLc);
    }
  }

  if (rule.field === "tag") {
    const names = contact.tagNames.map((n) => n.toLowerCase());
    const has = target ? names.includes(targetLc) : names.length > 0;
    switch (rule.op) {
      case "equals":
      case "contains":
        return has;
      case "not_equals":
      case "not_contains":
        return !has;
      case "exists":
        return names.length > 0;
      case "not_exists":
        return names.length === 0;
      default:
        return has;
    }
  }

  if (rule.field === "source") {
    const src = stringVal(contact.source).toLowerCase();
    const present = Boolean(src);
    switch (rule.op) {
      case "equals":
        return src === targetLc;
      case "not_equals":
        return src !== targetLc;
      case "contains":
        return src.includes(targetLc);
      case "not_contains":
        return !src.includes(targetLc);
      case "exists":
        return present;
      case "not_exists":
        return !present;
      default:
        return src === targetLc;
    }
  }

  if (rule.field === "provider") {
    const providers = (contact.providers || []).map((p) => p.toLowerCase());
    const has = target ? providers.includes(targetLc) : providers.length > 0;
    switch (rule.op) {
      case "equals":
      case "contains":
        return has;
      case "not_equals":
      case "not_contains":
        return !has;
      case "exists":
        return providers.length > 0;
      case "not_exists":
        return providers.length === 0;
      default:
        return has;
    }
  }

  if (rule.field.startsWith("custom:")) {
    const key = rule.field.slice("custom:".length);
    const cf =
      contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)
        : {};
    const raw = cf[key];
    const val = stringVal(raw).toLowerCase();
    const present = raw !== undefined && raw !== null && stringVal(raw) !== "";
    switch (rule.op) {
      case "equals":
        return val === targetLc;
      case "not_equals":
        return val !== targetLc;
      case "contains":
        return val.includes(targetLc);
      case "not_contains":
        return !val.includes(targetLc);
      case "exists":
        return present;
      case "not_exists":
        return !present;
      default:
        return val === targetLc;
    }
  }

  return false;
}

export function contactMatchesSegment(
  contact: EvaluableContact,
  conditions: SegmentConditions,
): boolean {
  if (!conditions.rules.length) return true;
  if (conditions.match === "any") {
    return conditions.rules.some((rule) => evaluateRule(contact, rule));
  }
  return conditions.rules.every((rule) => evaluateRule(contact, rule));
}

/** Resolve the contact IDs matching a segment's conditions. */
export async function resolveSegmentContactIds(
  workspaceId: string,
  conditions: unknown,
): Promise<string[]> {
  const parsed = parseSegmentConditions(conditions);
  const prisma = getPrisma();

  // Push status equality down to the query when it's the only status rule, to
  // keep the in-memory set small for large workspaces.
  const where: Record<string, unknown> = { workspaceId };
  const statusRules = parsed.rules.filter((r) => r.field === "status");
  if (
    parsed.match === "all" &&
    statusRules.length === 1 &&
    statusRules[0].op === "equals" &&
    statusRules[0].value
  ) {
    where.status = statusRules[0].value.toUpperCase();
  }

  const rawContacts = (await prisma.contact.findMany({ where })) as Array<{
    id: string;
    status: string;
    customFields: unknown;
    consentSource?: string | null;
  }>;

  // Load tag names per contact only when a tag rule is present (avoids extra
  // queries otherwise). The Supabase compat layer does not hydrate nested
  // relations via `select`, so we resolve the join manually.
  const needsTags = parsed.rules.some((r) => r.field === "tag");
  const needsProviders = parsed.rules.some((r) => r.field === "provider");
  const tagNamesByContact = new Map<string, string[]>();
  const providersByContact = new Map<string, string[]>();
  const contactIds = rawContacts.map((c) => c.id);
  if (needsTags && rawContacts.length) {
    const contactTags = (await prisma.contactTag.findMany({
      where: { contactId: { in: contactIds } },
    })) as Array<{ contactId: string; tagId: string }>;
    const tagIds = [...new Set(contactTags.map((ct) => ct.tagId))];
    const tags = tagIds.length
      ? ((await prisma.tag.findMany({ where: { id: { in: tagIds } } })) as Array<{
          id: string;
          name: string;
        }>)
      : [];
    const tagNameById = new Map(tags.map((t) => [t.id, t.name]));
    for (const ct of contactTags) {
      const name = tagNameById.get(ct.tagId);
      if (!name) continue;
      const list = tagNamesByContact.get(ct.contactId) || [];
      list.push(name);
      tagNamesByContact.set(ct.contactId, list);
    }
  }

  if (needsProviders && contactIds.length) {
    const mappings = (await prisma.crmObjectMapping.findMany({
      where: { workspaceId, internalId: { in: contactIds } },
    })) as Array<{ internalId: string; provider: string }>;
    for (const m of mappings) {
      const list = providersByContact.get(m.internalId) || [];
      if (!list.includes(m.provider)) list.push(m.provider);
      providersByContact.set(m.internalId, list);
    }
  }

  const contacts: EvaluableContact[] = rawContacts.map((c) => ({
    id: c.id,
    status: c.status,
    customFields: c.customFields,
    tagNames: tagNamesByContact.get(c.id) || [],
    source: c.consentSource || null,
    providers: providersByContact.get(c.id) || [],
  }));

  return contacts
    .filter((c) => contactMatchesSegment(c, parsed))
    .map((c) => c.id);
}

/** Count contacts matching a segment's conditions. */
export async function countSegmentContacts(
  workspaceId: string,
  conditions: unknown,
): Promise<number> {
  const ids = await resolveSegmentContactIds(workspaceId, conditions);
  return ids.length;
}
