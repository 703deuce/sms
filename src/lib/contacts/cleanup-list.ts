import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const FAILED_THRESHOLD = 3;

export type ListCleanupResult = {
  scanned: number;
  suppressed: number;
  invalidMarked: number;
  unsubscribedMarked: number;
  details: Array<{ contactId: string; phone: string; reason: string }>;
};

export async function runListCleanup(workspaceId: string): Promise<ListCleanupResult> {
  const prisma = getPrisma();
  const result: ListCleanupResult = {
    scanned: 0,
    suppressed: 0,
    invalidMarked: 0,
    unsubscribedMarked: 0,
    details: [],
  };

  const invalidContacts = await prisma.contact.findMany({
    where: { workspaceId, status: "INVALID" },
    select: { id: true, phone: true },
  });

  const failedByPhone = await prisma.campaignMessage.groupBy({
    by: ["to"],
    where: {
      workspaceId,
      status: "failed",
    },
    _count: { _all: true },
  });

  const repeatedFailPhones = failedByPhone
    .filter((g: { _count: { _all: number }; to: string | null }) => g._count._all >= FAILED_THRESHOLD && g.to)
    .map((g: { to: string | null }) => g.to as string);

  const contactIds = new Set<string>();
  const reasons = new Map<string, string>();

  for (const c of invalidContacts) {
    contactIds.add(c.id);
    reasons.set(c.id, "invalid_status");
  }

  for (const phone of repeatedFailPhones) {
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone } },
      select: { id: true, phone: true },
    });
    if (contact) {
      contactIds.add(contact.id);
      reasons.set(contact.id, "repeated_send_failures");
    }
  }

  result.scanned = contactIds.size;

  for (const contactId of contactIds) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true, status: true },
    });
    if (!contact) continue;

    let phone = contact.phone;
    try {
      phone = normalizeE164(contact.phone);
    } catch {
      // keep raw
    }

    const reason = reasons.get(contactId) || "cleanup";
    const suppressionKey = `${workspaceId}:p:${phone}`;

    try {
      await prisma.suppression.create({
        data: {
          workspaceId,
          phone,
          suppressionKey,
          reason: reason === "invalid_status" ? "INVALID" : "REPEATED_FAILURES",
          source: "list_cleanup",
        },
      });
      result.suppressed += 1;
    } catch (err) {
      if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
        throw err;
      }
    }

    if (reason === "invalid_status") {
      await prisma.contact.updateMany({
        where: { id: contactId },
        data: { status: "INVALID" },
      });
      result.invalidMarked += 1;
    } else {
      await prisma.contact.updateMany({
        where: { id: contactId, status: { not: "INVALID" } },
        data: { status: "UNSUBSCRIBED" },
      });
      result.unsubscribedMarked += 1;
    }

    result.details.push({ contactId, phone, reason });
  }

  return result;
}

export async function runListCleanupAllWorkspaces() {
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  const summaries: Array<{ workspaceId: string; result: ListCleanupResult }> = [];
  for (const w of workspaces) {
    const result = await runListCleanup(w.id);
    summaries.push({ workspaceId: w.id, result });
  }
  return summaries;
}
