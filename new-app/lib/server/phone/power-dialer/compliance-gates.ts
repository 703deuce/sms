import { getPrisma } from "@/lib/server/db";
import { isOnInternalDnc } from "./internal-dnc";

export type DialComplianceResult =
  | { ok: true }
  | { ok: false; reason: string; userMessage: string };

export async function auditComplianceDecision(input: {
  workspaceId: string;
  action: string;
  actorUserId?: string | null;
  detail?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  await prisma.powerDialerComplianceAuditLog.create({
    data: {
      workspaceId: input.workspaceId,
      action: input.action,
      actorUserId: input.actorUserId || undefined,
      detailJson: input.detail as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}

/** M56 — contact-level consent for outbound dial/SMS when workspace requires it. */
export async function checkContactConsentForDial(input: {
  workspaceId: string;
  contactId: string;
  requireExplicitConsent: boolean;
}): Promise<DialComplianceResult> {
  if (!input.requireExplicitConsent) return { ok: true };
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { consentSource: true, consentDate: true, status: true },
  });
  if (!contact) return { ok: false, reason: "contact_not_found", userMessage: "Contact not found" };
  if (!contact.consentSource || !contact.consentDate) {
    return {
      ok: false,
      reason: "missing_consent",
      userMessage: "No recorded consent for this contact — update consent before dialing",
    };
  }
  return { ok: true };
}

export async function checkDialCompliance(input: {
  workspaceId: string;
  contactId: string;
  phoneE164: string;
  requireExplicitConsent?: boolean;
  externalDncConnected?: boolean;
  campaignListId?: string | null;
}): Promise<DialComplianceResult> {
  if (await isOnInternalDnc(input.workspaceId, input.phoneE164)) {
    return {
      ok: false,
      reason: "internal_dnc",
      userMessage: "Number is on your workspace do-not-call list",
    };
  }
  let requireConsent = Boolean(input.requireExplicitConsent);
  if (requireConsent && input.campaignListId) {
    const { contactHasListConsentException } = await import("./list-consent");
    if (await contactHasListConsentException(input.workspaceId, input.contactId, input.campaignListId)) {
      requireConsent = false;
    }
  }
  const consent = await checkContactConsentForDial({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    requireExplicitConsent: requireConsent,
  });
  if (!consent.ok) return consent;

  if (input.externalDncConnected) {
    const prisma = getPrisma();
    const ws = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    const flags = (ws?.limits || {}) as { powerDialerExternalDncHit?: Record<string, boolean> };
    if (flags.powerDialerExternalDncHit?.[input.phoneE164]) {
      return {
        ok: false,
        reason: "external_dnc",
        userMessage: "Number matched external DNC screening for this workspace",
      };
    }
  }
  return { ok: true };
}
