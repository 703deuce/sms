import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getOrCreateWorkspaceCrmSettings } from "./crm-settings";

/** M85 — create or update contact after inbound call with sufficient duration. */
export async function maybeAutoCreateOrUpdateInboundContact(input: {
  workspaceId: string;
  humanCallId: string;
  fromE164: string;
  billableSeconds: number | null;
}) {
  const settings = await getOrCreateWorkspaceCrmSettings(input.workspaceId);
  const rules = settings.inboundContactRules;
  if (!rules.enabled) return { action: "skipped", reason: "disabled" };

  const minSec = rules.minConnectedSeconds ?? 15;
  const seconds = input.billableSeconds ?? 0;
  if (seconds < minSec) return { action: "skipped", reason: "below_min_duration" };

  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const existing = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });

  if (existing) {
    if (!rules.updateLastCallOnExisting) return { action: "skipped", reason: "update_disabled" };
    await prisma.contactActivityEvent.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: existing.id,
        kind: "inbound_call",
        title: "Inbound call",
        body: `Connected ${seconds}s`,
        metadata: { humanCallId: input.humanCallId },
      },
    });
    await prisma.humanCall.updateMany({
      where: { id: input.humanCallId, workspaceId: input.workspaceId },
      data: { contactId: existing.id },
    });
    return { action: "updated", contactId: existing.id };
  }

  if (!rules.createOnMissed) return { action: "skipped", reason: "create_disabled" };

  const created = await prisma.contact.create({
    data: {
      workspaceId: input.workspaceId,
      phone: from,
      leadSource: "inbound_call",
      consentSource: "inbound_voice",
    },
  });
  await prisma.contactActivityEvent.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: created.id,
      kind: "inbound_call",
      title: "Inbound call (new contact)",
      body: `Auto-created after ${seconds}s connected`,
      metadata: { humanCallId: input.humanCallId },
    },
  });
  await prisma.humanCall.updateMany({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
    data: { contactId: created.id },
  });
  return { action: "created", contactId: created.id };
}
