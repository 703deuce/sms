import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { setCachedWorkflowFieldSession } from "./session-cache";
import type {
  CollectedFieldValue,
  FieldValueSource,
  WorkflowAction,
  WorkflowFieldSession,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyWorkflowFieldSession(input: {
  sessionId: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): WorkflowFieldSession {
  return {
    session_id: input.sessionId,
    workflow: input.workflow || "general",
    service_name: input.serviceName ?? null,
    active_field: null,
    fields: {},
    derived: {},
    updated_at: new Date().toISOString(),
  };
}

const SESSION_META_KEY = "workflowFieldSession";

/** Auto-created inbound stub — must not satisfy the real name collection requirement. */
export function isStubInboundContactName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): boolean {
  if ((firstName || "").trim() !== "Caller") return false;
  const last = (lastName || "").trim();
  return /^\d{4}$/.test(last);
}

export async function loadWorkflowFieldSession(
  callId: string,
): Promise<WorkflowFieldSession | null> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const raw = asRecord(meta[SESSION_META_KEY]);
  if (!raw.session_id) return null;
  return {
    session_id: String(raw.session_id),
    workflow: (raw.workflow as WorkflowAction) || "general",
    service_name: raw.service_name ? String(raw.service_name) : null,
    active_field: raw.active_field ? String(raw.active_field) : null,
    fields: asRecord(raw.fields) as WorkflowFieldSession["fields"],
    derived: asRecord(raw.derived) as WorkflowFieldSession["derived"],
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

export async function saveWorkflowFieldSession(
  callId: string,
  session: WorkflowFieldSession,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const next = { ...session, updated_at: new Date().toISOString() };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        [SESSION_META_KEY]: next,
      },
    },
  });
}

export async function ensureWorkflowFieldSession(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<WorkflowFieldSession> {
  const existing = await loadWorkflowFieldSession(input.callId);
  if (existing) {
    setCachedWorkflowFieldSession(input.callId, existing);
    return existing;
  }

  let session = emptyWorkflowFieldSession({
    sessionId: input.callId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { fromE164: true, contactId: true, createdAt: true },
  });

  const now = new Date().toISOString();
  session.derived.call_id = { value: input.callId, source: "derived", updated_at: now };
  session.derived.workspace_id = { value: input.workspaceId, source: "derived", updated_at: now };
  if (input.agentId) {
    session.derived.agent_id = { value: input.agentId, source: "derived", updated_at: now };
  }
  if (call?.createdAt) {
    session.derived.call_time = {
      value: call.createdAt.toISOString(),
      source: "derived",
      updated_at: now,
    };
  }

  if (call?.fromE164 && call.fromE164 !== "unknown") {
    try {
      session = setSessionField(
        session,
        "sys_phone",
        normalizeE164(call.fromE164),
        "caller_id",
        "Phone",
      );
    } catch {
      session = setSessionField(session, "sys_phone", call.fromE164, "caller_id", "Phone");
    }
    session.derived.caller_phone = session.fields.sys_phone;
    session.derived.source_number = session.fields.sys_phone;
  }

  if (call?.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: call.contactId, workspaceId: input.workspaceId },
    });
    if (contact) {
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      if (name && !isStubInboundContactName(contact.firstName, contact.lastName)) {
        session = setSessionField(session, "sys_name", name, "contact", "Name");
      }
      if (contact.phone) {
        try {
          session = setSessionField(
            session,
            "sys_phone",
            normalizeE164(contact.phone),
            "contact",
            "Phone",
          );
        } catch {
          session = setSessionField(session, "sys_phone", contact.phone, "contact", "Phone");
        }
      }
      if (contact.email) {
        session = setSessionField(session, "sys_email", contact.email, "contact", "Email");
      }
    }
  }

  await saveWorkflowFieldSession(input.callId, session);
  setCachedWorkflowFieldSession(input.callId, session);
  return session;
}

export function setSessionField(
  session: WorkflowFieldSession,
  fieldId: string,
  value: string | number | boolean | null,
  source: FieldValueSource,
  label?: string,
): WorkflowFieldSession {
  if (value == null || String(value).trim() === "") return session;
  return {
    ...session,
    fields: {
      ...session.fields,
      [fieldId]: {
        value,
        source,
        updated_at: new Date().toISOString(),
        label,
      },
    },
    updated_at: new Date().toISOString(),
  };
}

export function getSessionFieldValue(
  session: WorkflowFieldSession,
  fieldId: string,
): string | null {
  const entry = session.fields[fieldId];
  if (entry?.value == null || String(entry.value).trim() === "") return null;
  return String(entry.value).trim();
}

export function allSessionFieldsFlat(
  session: WorkflowFieldSession,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, entry] of Object.entries(session.fields)) {
    if (entry?.value != null && String(entry.value).trim() !== "") {
      out[id] = String(entry.value);
    }
  }
  return out;
}
