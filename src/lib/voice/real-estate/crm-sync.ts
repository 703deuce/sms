import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { createCrmNoteForVoice, createCrmTaskForVoice } from "@/lib/voice/tools/crm-writes";
import type { RealEstateCallState, RealEstateIntent } from "./types";
import { REAL_ESTATE_INTENT_LABELS } from "./types";

function activeIntents(state: RealEstateCallState): RealEstateIntent[] {
  const intents: RealEstateIntent[] = [];
  if (state.primaryIntent) intents.push(state.primaryIntent);
  for (const secondary of state.secondaryIntents) {
    if (!intents.includes(secondary)) intents.push(secondary);
  }
  return intents;
}

function buildLeadSummary(state: RealEstateCallState, businessName: string): string {
  const intents = activeIntents(state)
    .map((i) => REAL_ESTATE_INTENT_LABELS[i])
    .join(" + ");
  const fields = Object.entries(state.collectedFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return [
    `Real estate front desk intake — ${businessName}`,
    `Intent(s): ${intents || "unknown"}`,
    `Lead status: ${state.leadStatus}`,
    `Caller type: ${state.callerType}`,
    "",
    "Collected fields:",
    fields || "(none)",
  ].join("\n");
}

async function resolveContactId(input: {
  workspaceId: string;
  callId: string;
  callerE164?: string | null;
  name?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { contactId: true, fromE164: true },
  });
  if (call?.contactId) return call.contactId;

  const phoneRaw = (input.callerE164 || call?.fromE164 || "").trim();
  let phone = "";
  if (phoneRaw) {
    try {
      phone = normalizeE164(phoneRaw);
    } catch {
      phone = "";
    }
  }

  if (phone) {
    const byPhone = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone },
      select: { id: true },
    });
    if (byPhone) return byPhone.id;
  }

  const email = input.email?.trim() || "";
  if (email) {
    const byEmail = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  if (!phone && !email) return null;

  const nameParts = (input.name || "").trim().split(/\s+/).filter(Boolean);
  const created = await prisma.contact.create({
    data: {
      workspaceId: input.workspaceId,
      phone: phone || email,
      email: email || null,
      firstName: nameParts[0] || "Caller",
      lastName: nameParts.slice(1).join(" ") || null,
      consentSource: "voice_real_estate",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Sync RE intake fields to local contact + CRM note/task when intake completes or message taken.
 */
export async function syncRealEstateLeadToCrm(input: {
  workspaceId: string;
  callId: string;
  callState: RealEstateCallState;
  callerE164?: string | null;
  businessName: string;
  trigger: "intake_complete" | "message_taken" | "call_end";
}): Promise<{ ok: boolean; contactId?: string | null }> {
  const prisma = getPrisma();
  const name = input.callState.collectedFields.name || input.callState.contactName || "";
  const email = input.callState.collectedFields.email || "";

  const contactId =
    input.callState.contactId ||
    (await resolveContactId({
      workspaceId: input.workspaceId,
      callId: input.callId,
      callerE164: input.callerE164,
      name,
      email,
    }));

  if (contactId) {
    const parts = name.split(/\s+/).filter(Boolean);
    await prisma.contact
      .update({
        where: { id: contactId },
        data: {
          ...(parts[0] ? { firstName: parts[0] } : {}),
          ...(parts.length > 1 ? { lastName: parts.slice(1).join(" ") } : {}),
          ...(email ? { email } : {}),
        },
      })
      .catch(() => undefined);

    await prisma.voiceCall.updateMany({
      where: { id: input.callId, workspaceId: input.workspaceId },
      data: { contactId },
    });
  }

  const summary = buildLeadSummary(input.callState, input.businessName);
  const intentLabel = activeIntents(input.callState).join(" + ") || "inquiry";

  await createCrmNoteForVoice({
    workspaceId: input.workspaceId,
    subject: `RE front desk — ${intentLabel} (${input.trigger})`,
    body: summary,
    phone: input.callerE164 || undefined,
    email: email || undefined,
    callId: input.callId,
  }).catch(() => ({ ok: false }));

  if (input.callState.intakeComplete || input.callState.messageTaken) {
    await createCrmTaskForVoice({
      workspaceId: input.workspaceId,
      title: `Follow up: ${intentLabel} lead`,
      notes: summary,
      phone: input.callerE164 || undefined,
      email: email || undefined,
      callId: input.callId,
    }).catch(() => ({ ok: false }));
  }

  await prisma.auditLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        event: "voice.real_estate_lead_sync",
        detail: JSON.stringify({
          callId: input.callId,
          contactId,
          trigger: input.trigger,
          leadStatus: input.callState.leadStatus,
          intents: activeIntents(input.callState),
        }),
      },
    })
    .catch(() => undefined);

  return { ok: true, contactId };
}
