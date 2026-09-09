import "server-only";

import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  DEFAULT_MCTB_REQUEST_FORM_FIELDS,
  type MctbRequestFormField,
} from "@/lib/mctb/request-form-shared";

export type { MctbRequestFormField } from "@/lib/mctb/request-form-shared";
export { DEFAULT_MCTB_REQUEST_FORM_FIELDS } from "@/lib/mctb/request-form-shared";

export function generateMctbRequestFormToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildMctbRequestFormPublicUrl(token: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/f/mctb/${encodeURIComponent(token)}`;
}

export async function ensureMctbRequestFormToken(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const config = await prisma.missedCallTextConfig.findUnique({
    where: { workspaceId },
    select: { requestFormToken: true },
  });
  if (config?.requestFormToken) return config.requestFormToken;

  const token = generateMctbRequestFormToken();
  await prisma.missedCallTextConfig.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      requestFormToken: token,
      requestFormEnabled: false,
    },
    update: { requestFormToken: token },
  });
  return token;
}

export async function loadMctbRequestFormByToken(token: string) {
  const prisma = getPrisma();
  const config = await prisma.missedCallTextConfig.findFirst({
    where: { requestFormToken: token, requestFormEnabled: true },
    select: {
      workspaceId: true,
      requestFormToken: true,
      requestFormFieldsJson: true,
      leadCaptureEnabled: true,
      defaultLinkUrl: true,
    },
  });
  if (!config) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: config.workspaceId },
    select: { name: true },
  });

  const fields =
    Array.isArray(config.requestFormFieldsJson) && config.requestFormFieldsJson.length > 0
      ? (config.requestFormFieldsJson as MctbRequestFormField[])
      : DEFAULT_MCTB_REQUEST_FORM_FIELDS;

  return {
    workspaceId: config.workspaceId,
    workspaceName: workspace?.name || "Business",
    token: config.requestFormToken!,
    fields,
    leadCaptureEnabled: config.leadCaptureEnabled,
  };
}

async function upsertContactFromSubmission(input: {
  workspaceId: string;
  payload: Record<string, string>;
}): Promise<string | null> {
  const prisma = getPrisma();
  const phoneRaw =
    input.payload.phone || input.payload.Phone || input.payload.mobile || input.payload.Mobile || "";
  const phone = phoneRaw ? normalizeE164(phoneRaw) : null;
  const nameRaw = input.payload.name || input.payload.Name || "";
  const [firstName, ...rest] = nameRaw.trim().split(/\s+/);
  const lastName = rest.join(" ") || null;
  const email = (input.payload.email || input.payload.Email || "").trim() || null;

  if (!phone && !email && !nameRaw) return null;

  let contact =
    phone &&
    (await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone },
      select: { id: true },
    }));

  if (!contact && email) {
    contact = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email },
      select: { id: true },
    });
  }

  if (contact) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      },
    });
    return contact.id;
  }

  const created = await prisma.contact.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      phone: phone || `unknown-${createId().slice(0, 8)}`,
      firstName: firstName || null,
      lastName,
      email,
      source: "mctb_request_form",
    },
    select: { id: true },
  });
  return created.id;
}

export async function createMctbRequestFormSubmission(input: {
  token: string;
  payload: Record<string, string>;
  missedCallEventId?: string | null;
}) {
  const form = await loadMctbRequestFormByToken(input.token);
  if (!form) {
    return { ok: false as const, error: "form_not_found" };
  }

  for (const field of form.fields) {
    if (!field.required) continue;
    const val = input.payload[field.id]?.trim();
    if (!val) {
      return { ok: false as const, error: `missing_field:${field.id}` };
    }
  }

  const prisma = getPrisma();
  let contactId: string | null = null;
  if (form.leadCaptureEnabled) {
    contactId = await upsertContactFromSubmission({
      workspaceId: form.workspaceId,
      payload: input.payload,
    });
  }

  const row = await prisma.mctbRequestFormSubmission.create({
    data: {
      id: createId(),
      workspaceId: form.workspaceId,
      formToken: input.token,
      missedCallEventId: input.missedCallEventId || null,
      contactId,
      payloadJson: input.payload,
    },
  });

  return { ok: true as const, submission: row, workspaceId: form.workspaceId };
}
