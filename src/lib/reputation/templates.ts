import { createServiceClient } from "@/lib/db/client";
import {
  findUnknownTemplateTokens,
  validateReviewTemplateLanguage,
} from "@/lib/reputation/template-compliance";

export type TemplateChannel = "sms" | "email" | "print" | "generic";

export type TemplateInput = {
  organizationId: string;
  businessId: string;
  channel: TemplateChannel;
  name: string;
  subject?: string | null;
  body: string;
  tone?: string;
  isDefault?: boolean;
};

export async function listTemplates(businessId: string, includeArchived = false) {
  const supabase = createServiceClient();
  let q = supabase
    .from("review_request_templates")
    .select("*")
    .eq("business_id", businessId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function validateTemplateContent(body: string, subject?: string | null) {
  const warnings = [
    ...validateReviewTemplateLanguage(body),
    ...(subject ? validateReviewTemplateLanguage(subject) : []),
  ];
  const unknown = [
    ...findUnknownTemplateTokens(body),
    ...(subject ? findUnknownTemplateTokens(subject) : []),
  ];
  return { warnings, unknownTokens: [...new Set(unknown)] };
}

export async function createTemplate(input: TemplateInput) {
  const supabase = createServiceClient();
  const validation = validateTemplateContent(input.body, input.subject);
  if (input.isDefault) {
    await supabase
      .from("review_request_templates")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("business_id", input.businessId)
      .eq("channel", input.channel)
      .is("archived_at", null);
  }
  const { data, error } = await supabase
    .from("review_request_templates")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      channel: input.channel,
      name: input.name.trim(),
      subject: input.subject ?? null,
      body: input.body,
      tone: input.tone ?? "friendly",
      is_default: Boolean(input.isDefault),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { template: data, validation };
}

export async function updateTemplate(
  templateId: string,
  businessId: string,
  patch: Partial<TemplateInput>
) {
  const supabase = createServiceClient();
  const body = patch.body;
  const validation =
    body != null ? validateTemplateContent(body, patch.subject) : { warnings: [], unknownTokens: [] };

  if (patch.isDefault) {
    const { data: existing } = await supabase
      .from("review_request_templates")
      .select("channel")
      .eq("id", templateId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("review_request_templates")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("channel", existing.channel)
        .is("archived_at", null);
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body != null) update.body = patch.body;
  if (patch.tone != null) update.tone = patch.tone;
  if (patch.channel != null) update.channel = patch.channel;
  if (patch.isDefault != null) update.is_default = patch.isDefault;

  const { data, error } = await supabase
    .from("review_request_templates")
    .update(update)
    .eq("id", templateId)
    .eq("business_id", businessId)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Template not found");
  return { template: data, validation };
}

export async function duplicateTemplate(
  templateId: string,
  businessId: string,
  organizationId: string
) {
  const supabase = createServiceClient();
  const { data: orig } = await supabase
    .from("review_request_templates")
    .select("*")
    .eq("id", templateId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!orig) throw new Error("Template not found");
  return createTemplate({
    organizationId,
    businessId,
    channel: orig.channel as TemplateChannel,
    name: `${orig.name} (copy)`,
    subject: orig.subject,
    body: orig.body,
    tone: orig.tone,
    isDefault: false,
  });
}

export async function archiveTemplate(templateId: string, businessId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_request_templates")
    .update({ archived_at: new Date().toISOString(), is_default: false, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Template not found");
  return { ok: true };
}

export async function setDefaultTemplate(templateId: string, businessId: string) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("review_request_templates")
    .select("channel")
    .eq("id", templateId)
    .eq("business_id", businessId)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) throw new Error("Template not found");
  await supabase
    .from("review_request_templates")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("channel", existing.channel)
    .is("archived_at", null);
  const { data, error } = await supabase
    .from("review_request_templates")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
