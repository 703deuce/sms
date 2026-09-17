import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import type { VoiceV2IntakeSchema, VoiceV2IntakeState } from "./types";

function intakeKeyForContactField(
  schema: VoiceV2IntakeSchema,
  key: "name" | "email" | "phone",
): keyof VoiceV2IntakeState | null {
  if (schema.fields.some((f) => f.key === key)) return key;
  return null;
}

/** Best-effort CRM prefill — does not overwrite caller-confirmed intake values. */
export async function prefillIntakeStateFromContact(input: {
  workspaceId: string;
  intakeSchema: VoiceV2IntakeSchema;
  intakeState: VoiceV2IntakeState;
  fromE164?: string | null;
  trustedPrismaCallId?: string | null;
}): Promise<VoiceV2IntakeState> {
  const prisma = getPrisma();
  let contactId: string | null = null;
  let contact: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null = null;

  const trusted = input.trustedPrismaCallId?.trim();
  if (trusted) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: trusted, workspaceId: input.workspaceId },
      select: { contactId: true },
    });
    contactId = call?.contactId ?? null;
  }

  const ani = normalizeCallerAni(input.fromE164 || "");
  if (!contactId && ani) {
    try {
      const e164 = normalizeE164(ani);
      const byPhone = await prisma.contact.findFirst({
        where: { workspaceId: input.workspaceId, phone: e164 },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
      if (byPhone) {
        contactId = byPhone.id;
        contact = byPhone;
      }
    } catch {
      const byPhone = await prisma.contact.findFirst({
        where: { workspaceId: input.workspaceId, phone: ani },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
      if (byPhone) {
        contactId = byPhone.id;
        contact = byPhone;
      }
    }
  }

  if (contactId && !contact) {
    contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId: input.workspaceId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
  }

  if (!contact) return input.intakeState;

  const now = new Date().toISOString();
  const next: VoiceV2IntakeState = { ...input.intakeState };

  const nameKey = intakeKeyForContactField(input.intakeSchema, "name");
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  if (nameKey && fullName && !next[nameKey]?.value?.trim()) {
    next[nameKey] = {
      value: fullName,
      status: "PREFILLED",
      source: "CONTACT",
      updatedAt: now,
    };
  }

  const emailKey = intakeKeyForContactField(input.intakeSchema, "email");
  const email = contact.email?.trim();
  if (emailKey && email && !next[emailKey]?.value?.trim()) {
    next[emailKey] = {
      value: email.toLowerCase(),
      status: "PREFILLED",
      source: "CONTACT",
      updatedAt: now,
    };
  }

  const phoneKey = intakeKeyForContactField(input.intakeSchema, "phone");
  const phone = contact.phone?.trim();
  if (phoneKey && phone && !next[phoneKey]?.value?.trim()) {
    try {
      next[phoneKey] = {
        value: normalizeE164(phone),
        status: "PREFILLED",
        source: "CONTACT",
        updatedAt: now,
      };
    } catch {
      next[phoneKey] = {
        value: phone,
        status: "PREFILLED",
        source: "CONTACT",
        updatedAt: now,
      };
    }
  }

  return next;
}
