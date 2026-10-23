import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import type { ContactForEligibility } from "@/lib/server/phone/power-dialer/types";
import { getOrCreateWorkspaceCrmSettings } from "./crm-settings";

export type DialPhoneCandidate = { e164: string; field: string; phoneId?: string };

type PhoneRow = { id?: string; e164: string; priority: number; isPreferred?: boolean; outcome?: string | null };

export function listDialCandidates(
  contact: ContactForEligibility,
  priority: string[],
): DialPhoneCandidate[] {
  const out: DialPhoneCandidate[] = [];
  const seen = new Set<string>();
  const push = (e164: string, field: string, phoneId?: string) => {
    try {
      const n = normalizeE164(e164);
      if (seen.has(n)) return;
      seen.add(n);
      out.push({ e164: n, field, phoneId });
    } catch {
      /* skip invalid */
    }
  };
  for (const field of priority) {
    if (field === "phone") {
      push(contact.phone, "phone");
      continue;
    }
    if (field === "phones" && contact.phones?.length) {
      for (const p of [...(contact.phones as PhoneRow[])].sort((a, b) => a.priority - b.priority)) {
        if (p.outcome && p.outcome !== "retry") continue;
        push(p.e164, "phones", p.id);
      }
      continue;
    }
    const custom =
      contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)
        : {};
    const raw = custom[field];
    if (typeof raw === "string" && raw.trim()) push(raw, field);
  }
  if (!out.length) push(contact.phone, "phone");
  return out;
}

export async function resolveSessionDialPhone(input: {
  workspaceId: string;
  sessionId: string;
  contact: ContactForEligibility;
  priority: string[];
}): Promise<DialPhoneCandidate> {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
  const progress =
    session?.progressJson && typeof session.progressJson === "object"
      ? (session.progressJson as {
          dialOverride?: { contactId: string; e164: string; field: string };
        })
      : {};
  if (
    progress.dialOverride?.contactId === input.contact.id &&
    progress.dialOverride.e164
  ) {
    return {
      e164: progress.dialOverride.e164,
      field: progress.dialOverride.field || "phone",
    };
  }
  const candidates = listDialCandidates(input.contact, input.priority);
  return candidates[0] || { e164: input.contact.phone, field: "phone" };
}

/** M14 — after failed dial, schedule next number or clear override for next contact. */
export async function applyPhoneFallthroughAfterAttempt(input: {
  workspaceId: string;
  sessionId: string;
  contactId: string;
  disposition: string;
  dialedPhoneE164: string | null;
  phoneFieldPriority: string[];
}) {
  const settings = await getOrCreateWorkspaceCrmSettings(input.workspaceId);
  const mode = settings.phoneFallthroughMode === "next_contact" ? "next_contact" : "next_number";
  const terminal = ["no answer", "voicemail", "busy", "wrong number"];
  if (!terminal.includes(input.disposition.trim().toLowerCase())) {
    return { applied: false, reason: "disposition_not_fallthrough" };
  }

  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    include: { phones: { orderBy: { priority: "asc" } } },
  });
  if (!contact) return { applied: false, reason: "contact_missing" };

  const contactForEligibility: ContactForEligibility = {
    id: contact.id,
    phone: contact.phone,
    status: contact.status,
    timezone: contact.timezone,
    customFields: contact.customFields,
    phones: contact.phones.map((p) => ({
      e164: p.e164,
      priority: p.priority,
      isPreferred: p.isPreferred,
      outcome: p.outcome,
    })),
  };
  const candidates = listDialCandidates(contactForEligibility, input.phoneFieldPriority);
  const idx = candidates.findIndex((c) => c.e164 === input.dialedPhoneE164);
  if (idx >= 0 && candidates[idx + 1] && mode === "next_number") {
    const next = candidates[idx + 1];
    const session = await prisma.powerDialerSession.findFirst({
      where: { id: input.sessionId },
    });
    const progress = (session?.progressJson || {}) as Record<string, unknown>;
    await prisma.powerDialerSession.update({
      where: { id: input.sessionId },
      data: {
        progressJson: {
          ...progress,
          dialOverride: { contactId: input.contactId, e164: next.e164, field: next.field },
        },
      },
    });
    if (candidates[idx].phoneId) {
      await prisma.contactPhone.updateMany({
        where: { id: candidates[idx].phoneId },
        data: { outcome: "no_answer" },
      });
    }
    return { applied: true, mode: "next_number", nextE164: next.e164 };
  }

  await prisma.powerDialerSession.update({
    where: { id: input.sessionId },
    data: {
      progressJson: {
        ...((await prisma.powerDialerSession.findUnique({ where: { id: input.sessionId } }))
          ?.progressJson as object),
        dialOverride: null,
      },
    },
  });
  return { applied: true, mode: "next_contact" };
}
