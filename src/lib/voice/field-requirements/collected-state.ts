import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type {
  CollectedFieldEntry,
  CustomerCollectedState,
  FieldValueSource,
  NormalizedCustomerPayload,
  WorkflowAction,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyCustomerCollectedState(): CustomerCollectedState {
  return {
    fields: {},
    custom_fields: {},
    updated_at: new Date().toISOString(),
  };
}

export async function loadCustomerCollectedState(
  callId: string,
): Promise<CustomerCollectedState> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const raw = asRecord(meta.customerCollectedState);
  if (!Object.keys(raw).length) return emptyCustomerCollectedState();
  return {
    ...emptyCustomerCollectedState(),
    ...raw,
    fields: asRecord(raw.fields) as CustomerCollectedState["fields"],
    custom_fields: asRecord(raw.custom_fields) as CustomerCollectedState["custom_fields"],
    active_workflow: raw.active_workflow as WorkflowAction | undefined,
    updated_at: String(raw.updated_at || new Date().toISOString()),
  };
}

export async function saveCustomerCollectedState(
  callId: string,
  state: CustomerCollectedState,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const next = { ...state, updated_at: new Date().toISOString() };
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        customerCollectedState: next,
      },
    },
  });
}

function setField(
  state: CustomerCollectedState,
  key: string,
  value: string | number | boolean | null,
  source: FieldValueSource,
  bucket: "fields" | "custom_fields" = "fields",
): void {
  if (value == null || String(value).trim() === "") return;
  const target = bucket === "custom_fields" ? state.custom_fields : state.fields;
  target[key] = {
    value,
    source,
    updated_at: new Date().toISOString(),
  };
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function normalizeCustomerToolPayload(
  raw: Record<string, unknown>,
): NormalizedCustomerPayload {
  const custom =
    raw.custom_fields && typeof raw.custom_fields === "object"
      ? { ...(raw.custom_fields as Record<string, unknown>) }
      : {};
  const problem = pickString(
    raw.problem_description,
    raw.problem,
    raw.issue,
    raw.notes,
    raw.description,
    raw.additional_notes,
    custom.problem_description,
    custom.notes,
    custom.problem,
  );
  if (problem) {
    custom.problem_description = problem;
    custom.notes = problem;
  }
  const name = String(
    raw.name || raw.customerName || raw.customer_name || raw.full_name || "",
  ).trim();
  const first = String(raw.first_name || raw.firstName || "").trim();
  const last = String(raw.last_name || raw.lastName || "").trim();
  const composedName = name || [first, last].filter(Boolean).join(" ");
  return {
    name: composedName || null,
    first_name: first || null,
    last_name: last || null,
    phone: raw.phone || raw.customerPhone || raw.customer_phone
      ? String(raw.phone || raw.customerPhone || raw.customer_phone)
      : null,
    email: raw.email || raw.customerEmail || raw.customer_email
      ? String(raw.email || raw.customerEmail || raw.customer_email)
      : null,
    address: raw.address || raw.service_address || raw.location
      ? String(raw.address || raw.service_address || raw.location)
      : null,
    company: raw.company ? String(raw.company) : null,
    message: raw.message || raw.reason ? String(raw.message || raw.reason) : null,
    problem_description: problem || null,
    notes: problem || null,
    service_name: raw.serviceName || raw.service || raw.service_name
      ? String(raw.serviceName || raw.service || raw.service_name)
      : null,
    custom_fields: custom,
    workflow: raw.workflow ? (String(raw.workflow) as WorkflowAction) : undefined,
  };
}

export function applyCustomerPayloadToState(
  state: CustomerCollectedState,
  payload: NormalizedCustomerPayload,
  source: FieldValueSource = "tool",
): CustomerCollectedState {
  const next: CustomerCollectedState = {
    ...state,
    fields: { ...state.fields },
    custom_fields: { ...state.custom_fields },
    updated_at: new Date().toISOString(),
  };
  if (payload.workflow) next.active_workflow = payload.workflow;
  if (payload.name) setField(next, "full_name", payload.name, source);
  if (payload.phone) {
    try {
      setField(next, "phone", normalizeE164(payload.phone), source);
    } catch {
      setField(next, "phone", payload.phone, source);
    }
  }
  if (payload.email) setField(next, "email", payload.email, source);
  if (payload.address) setField(next, "address", payload.address, source);
  if (payload.message) setField(next, "message", payload.message, source);
  const problem = payload.problem_description || payload.notes;
  if (problem) {
    setField(next, "problem_description", problem, source);
    setField(next, "notes", problem, source);
  }
  if (payload.service_name) setField(next, "service", payload.service_name, source);
  if (payload.company) setField(next, "company", payload.company, source);
  for (const [key, val] of Object.entries(payload.custom_fields || {})) {
    if (val == null) continue;
    setField(next, key, val as string | number | boolean, source, "custom_fields");
  }
  return next;
}

export async function seedCollectedStateFromCall(input: {
  callId: string;
  workspaceId: string;
}): Promise<CustomerCollectedState> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: {
      metadata: true,
      fromE164: true,
      contactId: true,
    },
  });
  if (!call) return emptyCustomerCollectedState();

  let state = await loadCustomerCollectedState(input.callId);

  if (call.fromE164 && call.fromE164 !== "unknown" && !state.fields.phone?.value) {
    try {
      state = applyCustomerPayloadToState(
        state,
        { phone: normalizeE164(call.fromE164) },
        "caller_id",
      );
    } catch {
      state = applyCustomerPayloadToState(state, { phone: call.fromE164 }, "caller_id");
    }
  }

  if (call.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: call.contactId, workspaceId: input.workspaceId },
    });
    if (contact) {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      state = applyCustomerPayloadToState(
        state,
        {
          name: fullName || undefined,
          phone: contact.phone || undefined,
          email: contact.email || undefined,
          company: contact.company || undefined,
        },
        "contact",
      );
    }
  }

  return state;
}

export function flattenCollectedForBookingArgs(
  state: CustomerCollectedState,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const name = state.fields.full_name?.value;
  if (name != null) {
    out.name = String(name);
    out.customerName = String(name);
  }
  const phone = state.fields.phone?.value;
  if (phone != null) {
    out.phone = String(phone);
    out.customerPhone = String(phone);
  }
  const email = state.fields.email?.value;
  if (email != null) {
    out.email = String(email);
    out.customerEmail = String(email);
  }
  const address = state.fields.address?.value;
  if (address != null) out.address = String(address);
  const service = state.fields.service?.value;
  if (service != null) {
    out.serviceName = String(service);
    out.service = String(service);
  }
  const problem =
    state.fields.problem_description?.value ||
    state.fields.notes?.value ||
    state.custom_fields.problem_description?.value;
  if (problem != null) {
    out.problem_description = String(problem);
    out.notes = String(problem);
    out.problem = String(problem);
  }
  for (const [key, entry] of Object.entries(state.custom_fields)) {
    if (entry?.value != null) out[key] = entry.value;
  }
  return out;
}
