import { getPrisma } from "@/lib/db";

export type SegmentOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "exists"
  | "not_exists";

export type SegmentRule = {
  /**
   * status | tag | source | provider | connection | external_list | external_tag |
   * form | appointment_status | order_status | deal_stage | ticket_status | consent_status |
   * custom:<fieldKey>
   */
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
  /** Internal contact list names. */
  listNames?: string[];
  /** consentSource / import source */
  source?: string | null;
  /** Connected integration provider ids (from external mappings). */
  providers?: string[];
  connectionIds?: string[];
  externalLists?: string[];
  externalTags?: string[];
  forms?: string[];
  appointmentStatuses?: string[];
  orderStatuses?: string[];
  dealStages?: string[];
  ticketStatuses?: string[];
  consentStatus?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

function matchListField(
  values: string[] | undefined,
  rule: SegmentRule,
): boolean {
  const names = (values || []).map((n) => n.toLowerCase());
  const target = (rule.value ?? "").trim().toLowerCase();
  const has = target ? names.includes(target) : names.length > 0;
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

  if (rule.field === "list") {
    return matchListField(contact.listNames, rule);
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
    return matchListField(contact.providers, rule);
  }
  if (rule.field === "connection") {
    return matchListField(contact.connectionIds, rule);
  }
  if (rule.field === "external_list") {
    return matchListField(contact.externalLists, rule);
  }
  if (rule.field === "external_tag") {
    return matchListField(contact.externalTags, rule);
  }
  if (rule.field === "form") {
    return matchListField(contact.forms, rule);
  }
  if (rule.field === "appointment_status" || rule.field === "appointment_type") {
    return matchListField(contact.appointmentStatuses, rule);
  }
  if (rule.field === "order_status") {
    return matchListField(contact.orderStatuses, rule);
  }
  if (rule.field === "deal_stage") {
    return matchListField(contact.dealStages, rule);
  }
  if (rule.field === "ticket_status") {
    return matchListField(contact.ticketStatuses, rule);
  }
  if (rule.field === "consent_status") {
    const status = stringVal(contact.consentStatus || contact.status).toLowerCase();
    switch (rule.op) {
      case "equals":
        return status === targetLc;
      case "not_equals":
        return status !== targetLc;
      case "exists":
        return Boolean(status);
      case "not_exists":
        return !status;
      default:
        return status.includes(targetLc);
    }
  }

  if (rule.field === "firstName" || rule.field === "lastName" || rule.field === "email") {
    const val = stringVal(contact[rule.field]).toLowerCase();
    const present = Boolean(val);
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
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }>;

  // Load tag names per contact only when a tag rule is present (avoids extra
  // queries otherwise). The Supabase compat layer does not hydrate nested
  // relations via `select`, so we resolve the join manually.
  const needsTags = parsed.rules.some((r) => r.field === "tag" || r.field === "external_tag");
  const needsLists = parsed.rules.some((r) => r.field === "list");
  const needsProviders = parsed.rules.some(
    (r) => r.field === "provider" || r.field === "connection" || r.field === "external_list" || r.field === "deal_stage" || r.field === "ticket_status",
  );
  const needsForms = parsed.rules.some((r) => r.field === "form");
  const needsAppt = parsed.rules.some(
    (r) => r.field === "appointment_status" || r.field === "appointment_type",
  );
  const needsOrders = parsed.rules.some((r) => r.field === "order_status");
  const tagNamesByContact = new Map<string, string[]>();
  const listNamesByContact = new Map<string, string[]>();
  const providersByContact = new Map<string, string[]>();
  const connectionsByContact = new Map<string, string[]>();
  const listsByContact = new Map<string, string[]>();
  const dealStagesByContact = new Map<string, string[]>();
  const ticketStatusesByContact = new Map<string, string[]>();
  const formsByContact = new Map<string, string[]>();
  const apptByContact = new Map<string, string[]>();
  const ordersByContact = new Map<string, string[]>();
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

  if (needsLists && contactIds.length) {
    const members = (await prisma.contactListMember.findMany({
      where: { contactId: { in: contactIds } },
    })) as Array<{ contactId: string; listId: string }>;
    const listIds = [...new Set(members.map((m) => m.listId))];
    const contactLists = listIds.length
      ? ((await prisma.contactList.findMany({ where: { id: { in: listIds } } })) as Array<{
          id: string;
          name: string;
        }>)
      : [];
    const listNameById = new Map(contactLists.map((l) => [l.id, l.name]));
    for (const m of members) {
      const name = listNameById.get(m.listId);
      if (!name) continue;
      const list = listNamesByContact.get(m.contactId) || [];
      if (!list.includes(name)) list.push(name);
      listNamesByContact.set(m.contactId, list);
    }
  }

  if (needsProviders && contactIds.length) {
    const mappings = (await prisma.crmObjectMapping.findMany({
      where: { workspaceId, internalId: { in: contactIds } },
    })) as Array<{
      internalId: string;
      provider: string;
      objectType: string;
      externalId: string;
      metadataJson: unknown;
    }>;
    for (const m of mappings) {
      const list = providersByContact.get(m.internalId) || [];
      if (!list.includes(m.provider)) list.push(m.provider);
      providersByContact.set(m.internalId, list);
      // connection surrogate: provider:objectType for audience filtering
      const connKey = `${m.provider}:${m.objectType}`;
      const cl = connectionsByContact.get(m.internalId) || [];
      if (!cl.includes(connKey)) cl.push(connKey);
      connectionsByContact.set(m.internalId, cl);
      if (m.objectType === "audience" || m.objectType === "segment") {
        const ll = listsByContact.get(m.internalId) || [];
        if (!ll.includes(m.externalId)) ll.push(m.externalId);
        listsByContact.set(m.internalId, ll);
      }
      const meta = (m.metadataJson || {}) as Record<string, unknown>;
      if (m.objectType === "deal" && meta.stageId) {
        const dl = dealStagesByContact.get(m.internalId) || [];
        const stage = String(meta.stageId);
        if (!dl.includes(stage)) dl.push(stage);
        dealStagesByContact.set(m.internalId, dl);
      }
      if (m.objectType === "support_ticket" && meta.status) {
        const tl = ticketStatusesByContact.get(m.internalId) || [];
        const st = String(meta.status);
        if (!tl.includes(st)) tl.push(st);
        ticketStatusesByContact.set(m.internalId, tl);
      }
    }
  }

  if (needsForms && contactIds.length) {
    const subs = (await prisma.formSubmission.findMany({
      where: { workspaceId, contactId: { in: contactIds } },
      include: { form: true },
      take: 5000,
    })) as Array<{ contactId: string | null; form: { name: string; slug: string | null } }>;
    for (const s of subs) {
      if (!s.contactId) continue;
      const fl = formsByContact.get(s.contactId) || [];
      const name = s.form.slug || s.form.name;
      if (!fl.includes(name)) fl.push(name);
      formsByContact.set(s.contactId, fl);
    }
  }

  if (needsAppt && contactIds.length) {
    const appts = (await prisma.voiceAppointment.findMany({
      where: { workspaceId, contactId: { in: contactIds } },
      select: { contactId: true, status: true, serviceName: true },
      take: 5000,
    })) as Array<{ contactId: string | null; status: string; serviceName: string | null }>;
    for (const a of appts) {
      if (!a.contactId) continue;
      const al = apptByContact.get(a.contactId) || [];
      for (const v of [a.status, a.serviceName].filter(Boolean) as string[]) {
        if (!al.includes(v)) al.push(v);
      }
      apptByContact.set(a.contactId, al);
    }
  }

  if (needsOrders && contactIds.length) {
    const orders = (await prisma.integrationOrder.findMany({
      where: { workspaceId, contactId: { in: contactIds } },
      select: { contactId: true, status: true },
      take: 5000,
    })) as Array<{ contactId: string | null; status: string | null }>;
    for (const o of orders) {
      if (!o.contactId || !o.status) continue;
      const ol = ordersByContact.get(o.contactId) || [];
      if (!ol.includes(o.status)) ol.push(o.status);
      ordersByContact.set(o.contactId, ol);
    }
  }

  const contacts: EvaluableContact[] = rawContacts.map((c) => ({
    id: c.id,
    status: c.status,
    customFields: c.customFields,
    tagNames: tagNamesByContact.get(c.id) || [],
    listNames: listNamesByContact.get(c.id) || [],
    source: c.consentSource || null,
    providers: providersByContact.get(c.id) || [],
    connectionIds: connectionsByContact.get(c.id) || [],
    externalLists: listsByContact.get(c.id) || [],
    externalTags: tagNamesByContact.get(c.id) || [],
    forms: formsByContact.get(c.id) || [],
    appointmentStatuses: apptByContact.get(c.id) || [],
    orderStatuses: ordersByContact.get(c.id) || [],
    dealStages: dealStagesByContact.get(c.id) || [],
    ticketStatuses: ticketStatusesByContact.get(c.id) || [],
    consentStatus: c.status,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
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
