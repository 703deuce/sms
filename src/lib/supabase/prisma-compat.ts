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

/** Prisma client model name → Postgres table (matches schema.sql / @@map). */
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
  messagingRegistration: "messaging_registrations",
  messagingRegistrationEvent: "messaging_registration_events",
  campaignRecipient: "campaign_recipients",
  campaignMessage: "campaign_messages",
  suppression: "review_request_suppression",
  jobQueue: "job_queue",
  integrationWebhookEndpoint: "integration_webhook_endpoints",
  integrationWebhookEvent: "integration_webhook_events",
  conversation: "Conversation",
  conversationMessage: "ConversationMessage",
  template: "Template",
  automationFlow: "AutomationFlow",
  automationExecution: "AutomationExecution",
  automationStepExecution: "AutomationStepExecution",
  keyword: "Keyword",
  optInForm: "OptInForm",
  formSubmission: "FormSubmission",
  voiceAgent: "voice_agents",
  voiceAgentVersion: "voice_agent_versions",
  voiceAgentPhoneNumber: "voice_agent_phone_numbers",
  voiceKnowledgeBase: "voice_knowledge_bases",
  voiceKnowledgeSource: "voice_knowledge_sources",
  voiceAgentKnowledgeBase: "voice_agent_knowledge_bases",
  voiceTool: "voice_tools",
  voiceAgentTool: "voice_agent_tools",
  voiceCalendarConnection: "voice_calendar_connections",
  voiceService: "voice_services",
  voiceStaffMember: "voice_staff_members",
  voiceRoutingRule: "voice_routing_rules",
  voiceCampaign: "voice_campaigns",
  voiceCampaignContact: "voice_campaign_contacts",
  voiceCampaignAttempt: "voice_campaign_attempts",
  voiceCall: "voice_calls",
  voiceCallLeg: "voice_call_legs",
  voiceCallEvent: "voice_call_events",
  voiceTransfer: "voice_transfers",
  voiceRecording: "voice_recordings",
  voiceTranscript: "voice_transcripts",
  voiceTranscriptSegment: "voice_transcript_segments",
  voiceConversationInsight: "voice_conversation_insights",
  voiceToolExecution: "voice_tool_executions",
  voiceAppointment: "voice_appointments",
  voiceTestRun: "voice_test_runs",
  voiceComplianceProfile: "voice_compliance_profiles",
  voiceUsageRecord: "voice_usage_records",
  voiceIntegrationSecret: "voice_integration_secrets",
  providerWebhookEvent: "provider_webhook_events",
  qrCode: "QrCode",
  clickToTextLink: "ClickToTextLink",
  consentRecord: "ConsentRecord",
  complianceBrand: "ComplianceBrand",
  complianceCampaign: "ComplianceCampaign",
  apiKey: "ApiKey",
  webhook: "Webhook",
  auditLog: "AuditLog",
  usageRecord: "UsageRecord",
  linkClickEvent: "link_click_events",
  mediaAsset: "media_assets",
  survey: "surveys",
  surveyResponse: "survey_responses",
  growWidget: "grow_widgets",
  contactCardProfile: "contact_card_profiles",
  workspaceMessagingSettings: "workspace_messaging_settings",
  emailToSmsAddress: "email_to_sms_addresses",
  paymentLink: "payment_links",
  portRequest: "PortRequest",
  humanCall: "human_calls",
  humanCallEvent: "human_call_events",
  pushSubscription: "push_subscriptions",
  workspaceNotificationPrefs: "workspace_notification_prefs",
  workspaceLimits: "workspace_limits",
  workspaceDataPrefs: "workspace_data_prefs",
  workspacePhoneSettings: "workspace_phone_settings",
  creditLedgerEntry: "credit_ledger_entries",
  senderPool: "sender_pools",
  phoneNumberAssignment: "phone_number_assignments",
  workspaceInvite: "workspace_invites",
  inAppNotification: "in_app_notifications",
  contest: "contests",
  contestEntry: "contest_entries",
  integrationConnection: "integration_connections",
  callQueue: "call_queues",
  ivrMenu: "ivr_menus",
  platformSettings: "platform_settings",
  supportTicket: "support_tickets",
  callParkSlot: "call_park_slots",
  conferenceCall: "conference_calls",
  conferenceParticipant: "conference_participants",
  voicemailBox: "voicemail_boxes",
  voicemailMessage: "voicemail_messages",
  callForwardingRule: "call_forwarding_rules",
  softphonePresence: "softphone_presence",
  softphoneDevice: "softphone_devices",
  softphoneUserSettings: "softphone_user_settings",
};

/** Relation name on a model → { table, fk on this model, pk on related }. */
const RELATIONS: Record<string, Record<string, { table: string; fk: string; pk?: string }>> = {
  membership: {
    user: { table: "User", fk: "userId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  phoneNumber: { workspace: { table: "Workspace", fk: "workspaceId" } },
  portRequest: { workspace: { table: "Workspace", fk: "workspaceId" } },
  humanCall: { workspace: { table: "Workspace", fk: "workspaceId" } },
  humanCallEvent: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    humanCall: { table: "human_calls", fk: "humanCallId" },
  },
  pushSubscription: { workspace: { table: "Workspace", fk: "workspaceId" } },
  workspaceNotificationPrefs: { workspace: { table: "Workspace", fk: "workspaceId" } },
  workspaceLimits: { workspace: { table: "Workspace", fk: "workspaceId" } },
  workspaceDataPrefs: { workspace: { table: "Workspace", fk: "workspaceId" } },
  workspacePhoneSettings: { workspace: { table: "Workspace", fk: "workspaceId" } },
  creditLedgerEntry: { workspace: { table: "Workspace", fk: "workspaceId" } },
  senderPool: { workspace: { table: "Workspace", fk: "workspaceId" } },
  phoneNumberAssignment: {
    phoneNumber: { table: "PhoneNumber", fk: "phoneNumberId" },
    user: { table: "User", fk: "userId" },
  },
  workspaceInvite: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    invitedBy: { table: "User", fk: "invitedById" },
  },
  inAppNotification: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    user: { table: "User", fk: "userId" },
  },
  contest: { workspace: { table: "Workspace", fk: "workspaceId" } },
  contestEntry: { contest: { table: "contests", fk: "contestId" } },
  integrationConnection: { workspace: { table: "Workspace", fk: "workspaceId" } },
  callQueue: { workspace: { table: "Workspace", fk: "workspaceId" } },
  ivrMenu: { workspace: { table: "Workspace", fk: "workspaceId" } },
  callParkSlot: { workspace: { table: "Workspace", fk: "workspaceId" } },
  conferenceCall: { workspace: { table: "Workspace", fk: "workspaceId" } },
  conferenceParticipant: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    conference: { table: "conference_calls", fk: "conferenceId" },
  },
  voicemailBox: { workspace: { table: "Workspace", fk: "workspaceId" } },
  voicemailMessage: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    box: { table: "voicemail_boxes", fk: "boxId" },
  },
  callForwardingRule: { workspace: { table: "Workspace", fk: "workspaceId" } },
  softphonePresence: { workspace: { table: "Workspace", fk: "workspaceId" } },
  softphoneDevice: { workspace: { table: "Workspace", fk: "workspaceId" } },
  softphoneUserSettings: { workspace: { table: "Workspace", fk: "workspaceId" } },
  supportTicket: {},
  contact: { workspace: { table: "Workspace", fk: "workspaceId" } },
  contactTag: {
    contact: { table: "Contact", fk: "contactId" },
    tag: { table: "Tag", fk: "tagId" },
  },
  campaign: { workspace: { table: "Workspace", fk: "workspaceId" } },
  campaignRecipient: {
    campaign: { table: "Campaign", fk: "campaignId" },
    contact: { table: "Contact", fk: "contactId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  campaignMessage: {
    campaign: { table: "Campaign", fk: "campaignId" },
    recipient: { table: "campaign_recipients", fk: "recipientId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  message: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    contact: { table: "Contact", fk: "contactId" },
  },
  messagingRegistration: { workspace: { table: "Workspace", fk: "workspaceId" } },
  messagingRegistrationEvent: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    registration: { table: "messaging_registrations", fk: "registrationId" },
  },
  suppression: { workspace: { table: "Workspace", fk: "workspaceId" } },
  jobQueue: { workspace: { table: "Workspace", fk: "workspaceId" } },
  integrationWebhookEndpoint: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    campaign: { table: "Campaign", fk: "campaignId" },
  },
  integrationWebhookEvent: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    endpoint: { table: "integration_webhook_endpoints", fk: "endpointId" },
  },
  conversation: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    contact: { table: "Contact", fk: "contactId" },
    assignee: { table: "User", fk: "assigneeId" },
  },
  qrCode: { workspace: { table: "Workspace", fk: "workspaceId" } },
  clickToTextLink: { workspace: { table: "Workspace", fk: "workspaceId" } },
  formSubmission: {
    form: { table: "OptInForm", fk: "formId" },
    contact: { table: "Contact", fk: "contactId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  optInForm: { workspace: { table: "Workspace", fk: "workspaceId" } },
  survey: { workspace: { table: "Workspace", fk: "workspaceId" } },
  surveyResponse: {
    survey: { table: "surveys", fk: "surveyId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  growWidget: { workspace: { table: "Workspace", fk: "workspaceId" } },
  contactCardProfile: { workspace: { table: "Workspace", fk: "workspaceId" } },
  workspaceMessagingSettings: { workspace: { table: "Workspace", fk: "workspaceId" } },
  emailToSmsAddress: { workspace: { table: "Workspace", fk: "workspaceId" } },
  paymentLink: { workspace: { table: "Workspace", fk: "workspaceId" } },
  linkClickEvent: { workspace: { table: "Workspace", fk: "workspaceId" } },
  mediaAsset: { workspace: { table: "Workspace", fk: "workspaceId" } },
  voiceAgent: { workspace: { table: "Workspace", fk: "workspaceId" } },
  voiceCall: {
    workspace: { table: "Workspace", fk: "workspaceId" },
    agent: { table: "voice_agents", fk: "agentId" },
  },
  conversationMessage: { conversation: { table: "Conversation", fk: "conversationId" } },
  automationFlow: { workspace: { table: "Workspace", fk: "workspaceId" } },
  automationExecution: {
    flow: { table: "AutomationFlow", fk: "flowId" },
    contact: { table: "Contact", fk: "contactId" },
    workspace: { table: "Workspace", fk: "workspaceId" },
  },
  automationStepExecution: {
    execution: { table: "AutomationExecution", fk: "executionId" },
  },
  workspace: {
    phoneNumbers: { table: "PhoneNumber", fk: "workspaceId", pk: "id" },
    messagingRegistration: { table: "messaging_registrations", fk: "workspaceId", pk: "id" },
  },
};

/** model → `_count` relation name → child table + FK for aggregate counts. */
const COUNT_RELATIONS: Record<string, Record<string, { table: string; fk: string }>> = {
  contactList: { members: { table: "ContactListMember", fk: "listId" } },
  tag: { contacts: { table: "ContactTag", fk: "tagId" } },
  campaign: {
    recipients: { table: "campaign_recipients", fk: "campaignId" },
    campaignMessages: { table: "campaign_messages", fk: "campaignId" },
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

/**
 * PostgREST returns PGRST204 ("Could not find the 'X' column of 'T' in the
 * schema cache") when a write payload includes a column the table does not
 * have. Some models (e.g. User, Contact, Campaign) do not carry `updatedAt`
 * even though prepareData sets it. Extract that column so we can drop it and
 * retry instead of failing the whole write.
 */
function missingColumnFromError(error: { message?: string } | null | undefined): string | null {
  const msg = error?.message || "";
  const m = msg.match(/Could not find the '([^']+)' column/);
  return m ? m[1] : null;
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
  if ("contains" in value && typeof value.contains === "string") {
    return `${key}.ilike.*${value.contains}*`;
  }
  if ("startsWith" in value && typeof value.startsWith === "string") {
    return `${key}.ilike.${value.startsWith}*`;
  }
  if ("endsWith" in value && typeof value.endsWith === "string") {
    return `${key}.ilike.*${value.endsWith}`;
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

function flattenCompoundWhere(where: Args | undefined): Args | undefined {
  if (!where) return where;
  const out: Args = { ...where };
  for (const [key, value] of Object.entries(where)) {
    if (
      key.includes("_") &&
      isObject(value) &&
      !isFilterOpObject(value) &&
      !("connect" in value)
    ) {
      for (const [fk, fv] of Object.entries(value)) {
        out[fk] = fv;
      }
      delete out[key];
    }
  }
  return out;
}

async function resolveNestedWhere(model: string, where: Args | undefined): Promise<Args | undefined> {
  where = flattenCompoundWhere(where);
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

    // Prisma compound unique key, e.g. { userId_workspaceId: { userId, workspaceId } }
    // or { workspaceId_phone: { workspaceId, phone } }. Expand each scalar
    // sub-field into an equality filter so the lookup actually targets a row.
    if (isObject(value)) {
      for (const [ck, cv] of Object.entries(value)) {
        if (cv === null) q = q.is(ck, null);
        else if (cv instanceof Date) q = q.eq(ck, cv.toISOString());
        else if (typeof cv === "string" || typeof cv === "number" || typeof cv === "boolean") {
          q = q.eq(ck, cv);
        }
      }
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

    // Aggregate counts: include: { _count: { select: { members: true } } }
    if (rel === "_count") {
      const select = isObject(cfg) && isObject(cfg.select) ? (cfg.select as Row) : {};
      const names = Object.keys(select).filter((k) => select[k]);
      const countMaps: Record<string, Map<string, number>> = {};
      const ids = out.map((r) => r.id as string);
      for (const name of names) {
        const rel2 = COUNT_RELATIONS[model]?.[name];
        const m = new Map<string, number>();
        if (rel2 && ids.length) {
          const { data } = await db.from(rel2.table).select(rel2.fk).in(rel2.fk, ids);
          for (const row of data ?? []) {
            const k = (row as Row)[rel2.fk] as string;
            m.set(k, (m.get(k) ?? 0) + 1);
          }
        }
        countMaps[name] = m;
      }
      out = out.map((r) => {
        const c: Row = {};
        for (const name of names) c[name] = countMaps[name]?.get(r.id as string) ?? 0;
        return { ...r, _count: c };
      });
      continue;
    }

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

    // One-to-many: conversation.messages (ConversationMessage.conversationId)
    if (rel === "messages" && model === "conversation") {
      const ids = out.map((r) => r.id as string);
      const { data } = await db
        .from("ConversationMessage")
        .select("*")
        .in("conversationId", ids);
      const orderBy = isObject(cfg) ? (cfg.orderBy as Row | undefined) : undefined;
      const dir = orderBy && "createdAt" in orderBy ? orderBy.createdAt : "asc";
      const take = isObject(cfg) && typeof cfg.take === "number" ? cfg.take : undefined;
      const by = new Map<string, Row[]>();
      for (const m of data ?? []) {
        const list = by.get(m.conversationId as string) ?? [];
        list.push(reviveRow(m as Row));
        by.set(m.conversationId as string, list);
      }
      out = out.map((r) => {
        let list = by.get(r.id as string) ?? [];
        list = list.sort((a, b) => {
          const av = new Date(a.createdAt as string).getTime();
          const bv = new Date(b.createdAt as string).getTime();
          return dir === "desc" ? bv - av : av - bv;
        });
        if (take != null) list = list.slice(0, take);
        return { ...r, messages: list };
      });
      continue;
    }

    // One-to-many: contact.tagMembers (ContactTag.contactId) + nested tag
    if (rel === "tagMembers" && model === "contact") {
      const ids = out.map((r) => r.id as string);
      const { data } = ids.length
        ? await db.from("ContactTag").select("*").in("contactId", ids)
        : { data: [] as Row[] };
      let members = (data ?? []).map((r) => reviveRow(r as Row));
      if (isObject(cfg) && isObject(cfg.include) && cfg.include.tag) {
        const tagIds = [...new Set(members.map((m) => m.tagId).filter(Boolean))] as string[];
        const { data: tags } = tagIds.length
          ? await db.from("Tag").select("*").in("id", tagIds)
          : { data: [] as Row[] };
        const tagMap = new Map((tags ?? []).map((t) => [t.id as string, reviveRow(t as Row)]));
        members = members.map((m) => ({ ...m, tag: tagMap.get(m.tagId as string) ?? null }));
      }
      const by = new Map<string, Row[]>();
      for (const m of members) {
        const list = by.get(m.contactId as string) ?? [];
        list.push(m);
        by.set(m.contactId as string, list);
      }
      out = out.map((r) => ({ ...r, tagMembers: by.get(r.id as string) ?? [] }));
      continue;
    }

    // One-to-many: conferenceCall.participants
    if (rel === "participants" && model === "conferenceCall") {
      const ids = out.map((r) => r.id as string);
      const { data } = ids.length
        ? await db.from("conference_participants").select("*").in("conferenceId", ids)
        : { data: [] as Row[] };
      const by = new Map<string, Row[]>();
      for (const p of data ?? []) {
        const row = reviveRow(p as Row);
        const list = by.get(row.conferenceId as string) ?? [];
        list.push(row);
        by.set(row.conferenceId as string, list);
      }
      out = out.map((r) => ({ ...r, participants: by.get(r.id as string) ?? [] }));
      continue;
    }

    // One-to-many: phoneNumber.assignments (phone_number_assignments.phoneNumberId)
    if (rel === "assignments" && model === "phoneNumber") {
      const ids = out.map((r) => r.id as string);
      const { data } = ids.length
        ? await db.from("phone_number_assignments").select("*").in("phoneNumberId", ids)
        : { data: [] as Row[] };
      let assignmentRows = (data ?? []).map((r) => reviveRow(r as Row));
      if (isObject(cfg) && isObject(cfg.include) && cfg.include.user) {
        const userIds = [
          ...new Set(assignmentRows.map((a) => a.userId).filter(Boolean)),
        ] as string[];
        const { data: users } = userIds.length
          ? await db.from("User").select("*").in("id", userIds)
          : { data: [] as Row[] };
        const userMap = new Map(
          (users ?? []).map((u) => [u.id as string, reviveRow(u as Row)]),
        );
        assignmentRows = assignmentRows.map((a) => ({
          ...a,
          user: userMap.get(a.userId as string) ?? null,
        }));
      }
      const by = new Map<string, Row[]>();
      for (const a of assignmentRows) {
        const list = by.get(a.phoneNumberId as string) ?? [];
        list.push(a);
        by.set(a.phoneNumberId as string, list);
      }
      out = out.map((r) => ({ ...r, assignments: by.get(r.id as string) ?? [] }));
      continue;
    }

    if (rel === "messagingRegistration" && model === "workspace") {
      const ids = out.map((r) => r.id as string);
      const { data } = await db.from("messaging_registrations").select("*").in("workspaceId", ids);
      const map = new Map((data ?? []).map((r) => [r.workspaceId as string, reviveRow(r as Row)]));
      out = out.map((r) => ({ ...r, messagingRegistration: map.get(r.id as string) ?? null }));
      continue;
    }

    if (rel === "steps" && model === "automationExecution") {
      const ids = out.map((r) => r.id as string);
      const { data } = await db.from("AutomationStepExecution").select("*").in("executionId", ids);
      const orderBy = isObject(cfg) ? (cfg.orderBy as Row | undefined) : undefined;
      const dir = orderBy && "startedAt" in orderBy ? orderBy.startedAt : "asc";
      const by = new Map<string, Row[]>();
      for (const s of data ?? []) {
        const list = by.get(s.executionId as string) ?? [];
        list.push(reviveRow(s as Row));
        by.set(s.executionId as string, list);
      }
      out = out.map((r) => {
        let list = by.get(r.id as string) ?? [];
        list = list.sort((a, b) => {
          const av = a.startedAt ? new Date(a.startedAt as string).getTime() : 0;
          const bv = b.startedAt ? new Date(b.startedAt as string).getTime() : 0;
          return dir === "desc" ? bv - av : av - bv;
        });
        return { ...r, steps: list };
      });
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
  groupBy: (args: Args) => Promise<Row[]>;
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
      for (let attempt = 0; ; attempt++) {
        const { data: created, error } = await db.from(t).insert(row).select("*").single();
        if (!error) {
          const hydrated = await applyInclude([reviveRow(created as Row)], include, model);
          return hydrated[0];
        }
        const col = missingColumnFromError(error);
        if (col && col in row && attempt < 8) {
          delete row[col];
          continue;
        }
        throw new DbError(error.message, error.code);
      }
    },

    async createMany({ data, skipDuplicates }: Args) {
      const db = getSupabaseAdmin();
      const rows = (Array.isArray(data) ? data : [data]).map((d) => prepareData(d, { isCreate: true }));
      for (let attempt = 0; ; attempt++) {
        const { data: inserted, error } = await db.from(t).insert(rows).select("id");
        if (!error) return { count: inserted?.length ?? 0 };
        const col = missingColumnFromError(error);
        if (col && rows.some((r) => col in r) && attempt < 8) {
          for (const r of rows) delete r[col];
          continue;
        }
        if (skipDuplicates) return { count: 0 };
        throw new DbError(error.message, error.code);
      }
    },

    async update({ where, data, include }: Args) {
      const db = getSupabaseAdmin();
      const resolved = await resolveNestedWhere(model, where);
      let patch = prepareData(data, { isCreate: false });
      patch = await applyIncrements(model, resolved ?? {}, patch);
      for (let attempt = 0; ; attempt++) {
        let q: any = db.from(t).update(patch).select("*");
        q = applyWhereSync(q, resolved);
        const { data: updated, error } = await q.maybeSingle();
        if (!error) {
          if (!updated) throw new DbError(`Update failed: no row matched on ${t}`, "P2025");
          const hydrated = await applyInclude([reviveRow(updated as Row)], include, model);
          return hydrated[0];
        }
        const col = missingColumnFromError(error);
        if (col && col in patch && attempt < 8) {
          delete patch[col];
          continue;
        }
        throw new DbError(error.message, error.code);
      }
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
          for (let attempt = 0; ; attempt++) {
            const { error } = await db.from(t).update(one).eq("id", row.id);
            if (!error) break;
            const col = missingColumnFromError(error);
            if (col && col in one && attempt < 8) {
              delete one[col];
              continue;
            }
            throw new DbError(error.message, error.code);
          }
        }
        return { count: rows.length };
      }

      for (let attempt = 0; ; attempt++) {
        let q: any = db.from(t).update(patch).select("id");
        q = applyWhereSync(q, resolved);
        const { data: updated, error } = await q;
        if (!error) return { count: updated?.length ?? 0 };
        const col = missingColumnFromError(error);
        if (col && col in patch && attempt < 8) {
          delete patch[col];
          continue;
        }
        throw new DbError(error.message, error.code);
      }
    },

    async upsert({ where, create, update }: Args) {
      const flatWhere = flattenCompoundWhere(where) ?? where;
      const existing = await api.findUnique({ where: flatWhere });
      if (existing) return api.update({ where: flatWhere, data: update });
      const createData = { ...create };
      if (flatWhere && isObject(flatWhere)) {
        for (const [k, v] of Object.entries(flatWhere)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            createData[k] = v;
          }
        }
      }
      return api.create({ data: createData });
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

    async groupBy(args: Args = {}) {
      const by: string[] = Array.isArray(args.by) ? args.by : args.by ? [args.by] : [];
      const rows = await api.findMany({ where: args.where });
      const groups = new Map<string, Row>();
      for (const row of rows) {
        const key = by.map((f) => JSON.stringify(row[f])).join("|");
        let g = groups.get(key);
        if (!g) {
          g = {};
          for (const f of by) g[f] = row[f];
          groups.set(key, g);
        }
        if (args._count === true) {
          g._count = ((g._count as number) || 0) + 1;
        } else if (isObject(args._count)) {
          const cnt = (g._count as Row) || {};
          for (const k of Object.keys(args._count)) {
            if (k === "_all" || row[k] != null) cnt[k] = ((cnt[k] as number) || 0) + 1;
          }
          g._count = cnt;
        }
      }
      return [...groups.values()];
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
