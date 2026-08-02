import { getPrisma } from "@/lib/db";

export type ConsentGateResult = {
  allowed: boolean;
  reason?: string;
  channel: "sms" | "marketing" | "transactional";
  optedOut: boolean;
  blocked: boolean;
  suppressed: boolean;
};

/**
 * External CRM/list/form/order membership must NOT imply SMS marketing consent.
 * Transactional vs marketing are distinguishable via the channel argument.
 */
export async function checkCommunicationConsent(input: {
  workspaceId: string;
  contactId?: string | null;
  phone?: string | null;
  channel: "sms" | "marketing" | "transactional";
}): Promise<ConsentGateResult> {
  const prisma = getPrisma();
  let contact = null as null | {
    id: string;
    phone: string;
    status: string;
  };

  if (input.contactId) {
    contact = (await prisma.contact.findFirst({
      where: { id: input.contactId, workspaceId: input.workspaceId },
      select: { id: true, phone: true, status: true },
    })) as typeof contact;
  } else if (input.phone) {
    contact = (await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: input.phone },
      select: { id: true, phone: true, status: true },
    })) as typeof contact;
  }

  if (!contact) {
    return {
      allowed: false,
      reason: "contact_not_found",
      channel: input.channel,
      optedOut: false,
      blocked: false,
      suppressed: false,
    };
  }

  const optedOut = contact.status === "UNSUBSCRIBED";
  const blocked = contact.status === "BLOCKED" || contact.status === "INVALID";

  const phone = contact.phone;
  const suppression = await prisma.suppression.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [{ phone }, { suppressionKey: `p:${phone}` }],
    },
  });

  const suppressed = Boolean(suppression);

  if (blocked) {
    return {
      allowed: false,
      reason: "blocked",
      channel: input.channel,
      optedOut,
      blocked,
      suppressed,
    };
  }

  if (input.channel === "marketing" || input.channel === "sms") {
    if (optedOut || suppressed || contact.status !== "SUBSCRIBED") {
      return {
        allowed: false,
        reason: optedOut ? "opted_out" : suppressed ? "suppressed" : "not_subscribed",
        channel: input.channel,
        optedOut,
        blocked,
        suppressed,
      };
    }
  }

  // Transactional: allow SUBSCRIBED contacts; still block STOP/suppression for SMS channel delivery
  if (input.channel === "transactional" && (suppressed || optedOut)) {
    return {
      allowed: false,
      reason: "suppressed_or_opted_out",
      channel: input.channel,
      optedOut,
      blocked,
      suppressed,
    };
  }

  return {
    allowed: true,
    channel: input.channel,
    optedOut,
    blocked,
    suppressed,
  };
}
