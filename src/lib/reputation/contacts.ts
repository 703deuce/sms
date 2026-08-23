import { createServiceClient } from "@/lib/db/client";
import {
  contactIdentity,
  normalizeContactPhone,
  normalizeEmail,
} from "@/lib/reputation/contacts-normalize";

export type ContactInput = {
  organizationId: string;
  businessId: string;
  firstName?: string | null;
  lastName?: string | null;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  tags?: string[];
  source?: string | null;
  externalCustomerId?: string | null;
  /** When set, update this contact instead of phone/email match. */
  preferredContactId?: string | null;
  customerDate?: string | null;
  lastServiceDate?: string | null;
  notes?: string | null;
  consentState?: "unknown" | "implied" | "express" | "revoked";
  consentSource?: string | null;
};

function displayName(input: ContactInput): string | null {
  if (input.customerName?.trim()) return input.customerName.trim();
  const parts = [input.firstName, input.lastName].filter((p) => p?.trim());
  return parts.length ? parts.join(" ") : null;
}

type ExistingContact = {
  id: string;
  sms_opt_out?: boolean;
  email_unsubscribed?: boolean;
  phone_e164?: string | null;
  email_normalized?: string | null;
  external_customer_id?: string | null;
  customer_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Upsert a contact within a business using preferred id / external id / phone / email.
 * Opt-outs are never cleared by import/upsert. Missing phone/email fields are not wiped.
 */
export async function upsertBusinessContact(input: ContactInput): Promise<{ id: string; created: boolean }> {
  const supabase = createServiceClient();
  const { phoneE164, emailNormalized } = contactIdentity({
    phone: input.phone,
    email: input.email,
  });

  if (!phoneE164 && !emailNormalized && !input.preferredContactId) {
    throw new Error("Contact requires a valid phone or email.");
  }

  let existing: ExistingContact | null = null;
  const selectCols =
    "id, sms_opt_out, email_unsubscribed, phone_e164, email_normalized, external_customer_id, customer_name, first_name, last_name";

  if (input.preferredContactId) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select(selectCols)
      .eq("business_id", input.businessId)
      .eq("id", input.preferredContactId)
      .maybeSingle();
    existing = data;
  }

  const externalId = input.externalCustomerId?.trim() || null;
  if (!existing && externalId) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select(selectCols)
      .eq("business_id", input.businessId)
      .eq("external_customer_id", externalId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && phoneE164) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select(selectCols)
      .eq("business_id", input.businessId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    existing = data;
  }
  if (!existing && emailNormalized) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select(selectCols)
      .eq("business_id", input.businessId)
      .eq("email_normalized", emailNormalized)
      .maybeSingle();
    existing = data;
  }

  if (!existing && !phoneE164 && !emailNormalized) {
    throw new Error("Contact requires a valid phone or email.");
  }

  const name = displayName(input);
  const now = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = {
      organization_id: input.organizationId,
      business_id: input.businessId,
      updated_at: now,
    };
    if (input.firstName !== undefined && input.firstName !== null) {
      patch.first_name = input.firstName.trim() || null;
    }
    if (input.lastName !== undefined && input.lastName !== null) {
      patch.last_name = input.lastName.trim() || null;
    }
    if (name) patch.customer_name = name;
    if (phoneE164) {
      patch.phone_e164 = phoneE164;
      patch.customer_phone = phoneE164;
    }
    if (emailNormalized) {
      patch.email_normalized = emailNormalized;
      patch.customer_email = emailNormalized;
    }
    if (externalId) patch.external_customer_id = externalId;
    if (input.source) patch.source = input.source;
    if (input.customerDate) patch.customer_date = input.customerDate;
    if (input.lastServiceDate) patch.last_service_date = input.lastServiceDate;
    if (input.notes !== undefined && input.notes !== null) patch.notes = input.notes;
    if (input.consentState) {
      patch.consent_state = input.consentState;
      patch.consent_source = input.consentSource ?? null;
      if (input.consentState === "express" || input.consentState === "implied") {
        patch.consent_at = now;
      }
    }

    await supabase.from("review_request_contacts").update(patch).eq("id", existing.id);
    if (input.tags?.length) {
      const { data: row } = await supabase
        .from("review_request_contacts")
        .select("tags")
        .eq("id", existing.id)
        .maybeSingle();
      const prior = Array.isArray(row?.tags) ? (row!.tags as string[]) : [];
      const merged = [...new Set([...prior, ...input.tags])];
      await supabase.from("review_request_contacts").update({ tags: merged }).eq("id", existing.id);
    }
    return { id: existing.id, created: false };
  }

  const insertPatch: Record<string, unknown> = {
    organization_id: input.organizationId,
    business_id: input.businessId,
    first_name: input.firstName?.trim() || null,
    last_name: input.lastName?.trim() || null,
    customer_name: name,
    customer_phone: phoneE164 ?? input.phone?.trim() ?? null,
    customer_email: emailNormalized ?? input.email?.trim() ?? null,
    phone_e164: phoneE164,
    email_normalized: emailNormalized,
    source: input.source ?? null,
    external_customer_id: externalId,
    customer_date: input.customerDate || null,
    last_service_date: input.lastServiceDate || null,
    notes: input.notes ?? null,
    updated_at: now,
    consent_state: input.consentState ?? "unknown",
    tags: input.tags ?? [],
  };
  if (input.consentState) {
    insertPatch.consent_source = input.consentSource ?? null;
    if (input.consentState === "express" || input.consentState === "implied") {
      insertPatch.consent_at = now;
    }
  }

  const { data, error } = await supabase
    .from("review_request_contacts")
    .insert(insertPatch)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, created: true };
}

export async function listBusinessContacts(
  businessId: string,
  options?: { cursor?: string | null; limit?: number; q?: string }
) {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  let query = supabase
    .from("review_request_contacts")
    .select(
      "id, first_name, last_name, customer_name, phone_e164, email_normalized, customer_phone, customer_email, tags, source, sms_opt_out, email_unsubscribed, last_contacted_at, campaign_attempts, latest_reply_at, review_completion, created_at, updated_at"
    )
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false })
    .limit(limit + 1);

  if (options?.cursor) {
    query = query.lt("updated_at", options.cursor);
  }
  if (options?.q?.trim()) {
    const q = options.q.trim();
    query = query.or(
      `customer_name.ilike.%${q}%,email_normalized.ilike.%${q}%,phone_e164.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1]?.updated_at ?? "") : null;
  return { items, nextCursor };
}

export async function setContactSuppression(params: {
  organizationId: string;
  businessId: string;
  contactId: string;
  smsOptOut?: boolean;
  emailUnsubscribed?: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: contact } = await supabase
    .from("review_request_contacts")
    .select("id, phone_e164, email_normalized, sms_opt_out, email_unsubscribed")
    .eq("id", params.contactId)
    .eq("business_id", params.businessId)
    .maybeSingle();
  if (!contact) throw new Error("Contact not found");

  const smsOptOut =
    params.smsOptOut !== undefined ? params.smsOptOut : Boolean(contact.sms_opt_out);
  const emailUnsubscribed =
    params.emailUnsubscribed !== undefined
      ? params.emailUnsubscribed
      : Boolean(contact.email_unsubscribed);
  const now = new Date().toISOString();

  await supabase
    .from("review_request_contacts")
    .update({
      sms_opt_out: smsOptOut,
      email_unsubscribed: emailUnsubscribed,
      updated_at: now,
    })
    .eq("id", contact.id);

  if (params.smsOptOut !== undefined) {
    if (smsOptOut && contact.phone_e164) {
      const { data: existing } = await supabase
        .from("review_request_suppression")
        .select("id")
        .eq("business_id", params.businessId)
        .eq("phone", contact.phone_e164)
        .limit(1);
      if (!existing?.length) {
        await supabase.from("review_request_suppression").insert({
          organization_id: params.organizationId,
          business_id: params.businessId,
          phone: contact.phone_e164,
          reason: "manual_sms_opt_out",
        });
      }
    } else if (!smsOptOut && contact.phone_e164) {
      await supabase
        .from("review_request_suppression")
        .delete()
        .eq("business_id", params.businessId)
        .eq("phone", contact.phone_e164);
    }
  }

  if (params.emailUnsubscribed !== undefined) {
    if (emailUnsubscribed && contact.email_normalized) {
      const { data: existing } = await supabase
        .from("review_request_suppression")
        .select("id")
        .eq("business_id", params.businessId)
        .eq("email", contact.email_normalized)
        .limit(1);
      if (!existing?.length) {
        await supabase.from("review_request_suppression").insert({
          organization_id: params.organizationId,
          business_id: params.businessId,
          email: contact.email_normalized,
          reason: "manual_email_unsubscribe",
        });
      }
    } else if (!emailUnsubscribed && contact.email_normalized) {
      await supabase
        .from("review_request_suppression")
        .delete()
        .eq("business_id", params.businessId)
        .eq("email", contact.email_normalized);
    }
  }
}

export async function clearSmsSuppression(params: {
  organizationId: string;
  businessId: string;
  phone: string;
}) {
  const supabase = createServiceClient();
  const phone = normalizeContactPhone(params.phone);
  if (!phone) return;

  await supabase
    .from("review_request_suppression")
    .delete()
    .eq("business_id", params.businessId)
    .eq("phone", phone);

  await supabase
    .from("review_request_contacts")
    .update({ sms_opt_out: false, updated_at: new Date().toISOString() })
    .eq("business_id", params.businessId)
    .eq("phone_e164", phone);
}

export { normalizeContactPhone, normalizeEmail };
