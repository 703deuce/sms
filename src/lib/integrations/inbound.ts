import { createHmac } from "crypto";
import { getPrisma } from "@/lib/db";
import { getConnection, upsertExternalContact } from "./connections";

type AnyRecord = Record<string, unknown>;

function pick(obj: AnyRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return undefined;
}

/**
 * Normalize an arbitrary CRM/e-commerce contact payload into our contact shape.
 * Handles nested `properties` (HubSpot), flat fields (Shopify/Salesforce), and
 * common key casings.
 */
function normalizeContact(raw: AnyRecord) {
  const props = (raw.properties && typeof raw.properties === "object"
    ? (raw.properties as AnyRecord)
    : raw) as AnyRecord;

  const address = (raw.default_address && typeof raw.default_address === "object"
    ? (raw.default_address as AnyRecord)
    : {}) as AnyRecord;

  return {
    phone: pick(props, ["phone", "mobilephone", "MobilePhone", "Phone", "mobile", "phone_number"]) ||
      pick(address, ["phone"]),
    email: pick(props, ["email", "Email", "emailAddress"]),
    firstName: pick(props, ["firstname", "first_name", "FirstName", "firstName", "given_name"]),
    lastName: pick(props, ["lastname", "last_name", "LastName", "lastName", "family_name"]),
    company: pick(props, ["company", "Company", "organization"]) || pick(address, ["company"]),
  };
}

/** Ingest a HubSpot / Salesforce / Shopify contact webhook payload. */
export async function ingestContactWebhook(
  workspaceId: string,
  provider: string,
  payload: AnyRecord,
): Promise<{ upserted: number }> {
  // Support single object, `{ records: [...] }`, `{ results: [...] }`, or bare array.
  let items: AnyRecord[] = [];
  if (Array.isArray(payload)) items = payload as AnyRecord[];
  else if (Array.isArray(payload.records)) items = payload.records as AnyRecord[];
  else if (Array.isArray(payload.results)) items = payload.results as AnyRecord[];
  else if (payload.customer && typeof payload.customer === "object") items = [payload.customer as AnyRecord];
  else items = [payload];

  let upserted = 0;
  for (const item of items) {
    const contact = normalizeContact(item);
    if (!contact.phone && !contact.email) continue;
    const result = await upsertExternalContact({ workspaceId, ...contact, source: provider });
    if (result) upserted += 1;
  }
  return { upserted };
}

// --- Calendly ------------------------------------------------------------

/** Verify a Calendly webhook signature. Returns true when no key is stored. */
export function verifyCalendlySignature(
  signingKey: string | undefined,
  signatureHeader: string | null,
  rawBody: string,
): boolean {
  if (!signingKey) return true; // no key configured — accept (best-effort)
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  return expected === v1;
}

function extractCalendlyPhone(payload: AnyRecord): string | undefined {
  const direct = pick(payload, ["text_reminder_number"]);
  if (direct) return direct;
  const qa = payload.questions_and_answers;
  if (Array.isArray(qa)) {
    for (const item of qa as AnyRecord[]) {
      const q = String(item.question || "").toLowerCase();
      const a = String(item.answer || "");
      if (/phone|mobile|cell/.test(q) && a.trim()) return a.trim();
    }
  }
  return undefined;
}

/** Handle a Calendly invitee.created / invitee.canceled webhook. */
export async function ingestCalendlyWebhook(
  workspaceId: string,
  event: string,
  payload: AnyRecord,
): Promise<{ ok: boolean; appointmentId?: string }> {
  const prisma = getPrisma();
  const scheduled = (payload.scheduled_event && typeof payload.scheduled_event === "object"
    ? (payload.scheduled_event as AnyRecord)
    : {}) as AnyRecord;

  const name = pick(payload, ["name"]) || "";
  const [firstName, ...rest] = name.split(" ");
  const email = pick(payload, ["email"]);
  const phone = extractCalendlyPhone(payload);

  const contact = await upsertExternalContact({
    workspaceId,
    phone,
    email,
    firstName: firstName || null,
    lastName: rest.join(" ") || null,
    source: "calendly",
  });

  const startTime = pick(scheduled, ["start_time"]);
  const endTime = pick(scheduled, ["end_time"]);
  if (!startTime) return { ok: true };

  const startsAt = new Date(startTime);
  const endsAt = endTime ? new Date(endTime) : new Date(startsAt.getTime() + 30 * 60_000);
  const externalId = pick(payload, ["uri"]) || pick(scheduled, ["uri"]) || null;
  const status = /cancel/i.test(event) ? "cancelled" : "confirmed";

  // Upsert appointment by externalId when we have one.
  const existing = externalId
    ? await prisma.voiceAppointment.findFirst({ where: { workspaceId, externalId } })
    : null;

  if (existing) {
    const updated = await prisma.voiceAppointment.update({
      where: { id: existing.id },
      data: { status, startsAt, endsAt },
    });
    return { ok: true, appointmentId: updated.id };
  }

  const created = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      contactId: contact?.contactId || null,
      serviceName: pick(scheduled, ["name"]) || "Calendly booking",
      startsAt,
      endsAt,
      status,
      externalId,
      metadata: { source: "calendly", event } as object,
    },
  });
  return { ok: true, appointmentId: created.id };
}

/** Look up the signing key stored for a workspace's Calendly connection. */
export async function getCalendlySigningKey(workspaceId: string) {
  const conn = await getConnection(workspaceId, "calendly");
  const config = (conn?.configJson || {}) as AnyRecord;
  return (config.signingKey as string | undefined) || undefined;
}
