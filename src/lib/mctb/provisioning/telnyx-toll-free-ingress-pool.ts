import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { isMctbTexmlIngressConnection } from "@/lib/mctb/texml-ingress/texml-route";
import { listTelnyxOwnedNumbers } from "@/lib/voice/telnyx/number-import";
import { workspaceNumberUsesTexmlDirect } from "@/lib/voice/telnyx/texml-direct-route";

const PREFERRED_TOLL_FREE_NPAS = new Set(["800", "866"]);

export function isNorthAmericaTollFreeE164(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("1")) return false;
  const npa = digits.slice(1, 4);
  return /^(800|833|844|855|866|877|888)$/.test(npa);
}

export function isPreferredMctbIngressTollFreeE164(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("1")) return false;
  const npa = digits.slice(1, 4);
  return PREFERRED_TOLL_FREE_NPAS.has(npa);
}

export type TelnyxTollFreeIngressCandidate = {
  e164: string;
  telnyxProviderNumberId: string;
  dbPhoneNumberId: string | null;
  dbWorkspaceId: string | null;
  blockers: string[];
  assignable: boolean;
};

/** Telnyx-owned 800/866 numbers eligible for per-workspace CFNA ingress (ws_1 model). */
export async function listTelnyxTollFreeIngressCandidates(
  forWorkspaceId: string,
): Promise<TelnyxTollFreeIngressCandidate[]> {
  const owned = await listTelnyxOwnedNumbers();
  const tollFree = owned.filter((n) => isPreferredMctbIngressTollFreeE164(n.e164));
  const prisma = getPrisma();

  const phoneRows = await prisma.phoneNumber.findMany({
    where: {
      status: "Active",
      provider: "telnyx",
      e164: { in: tollFree.map((n) => n.e164) },
    },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
  const byE164 = new Map(phoneRows.map((r) => [r.e164, r]));

  const mctbIngress = await prisma.missedCallTextConfig.findMany({
    select: { workspaceId: true, phoneNumberId: true },
  });
  const ingressByPhoneId = new Map(mctbIngress.map((c) => [c.phoneNumberId, c.workspaceId]));

  let voiceAssignments: Array<{ phoneNumberId: string; workspaceId: string; agentId: string }> =
    [];
  try {
    voiceAssignments = await prisma.voiceAgentPhoneNumber.findMany({
      select: { phoneNumberId: true, workspaceId: true, agentId: true },
    });
  } catch {
    voiceAssignments = [];
  }
  const voiceByPhoneId = new Map(voiceAssignments.map((v) => [v.phoneNumberId, v]));

  const rows: TelnyxTollFreeIngressCandidate[] = [];

  for (const n of tollFree) {
    const db = byE164.get(n.e164);
    let voiceV3TexmlDirect = false;
    if (db) {
      voiceV3TexmlDirect = await workspaceNumberUsesTexmlDirect({
        workspaceId: db.workspaceId,
        phoneNumberId: db.id,
      });
    }
    const mctbRole = db ? parseMctbPhoneRole(db.settingsJson) : null;
    const mctbIngressWs = db ? ingressByPhoneId.get(db.id) : null;
    const voiceAgent = db ? voiceByPhoneId.get(db.id) : null;

    const blockers: string[] = [];
    if (mctbRole === "platform_mctb_sender") blockers.push("platform_mctb_sender");
    if (db && isPlatformMctbSenderPhoneRecord({ settingsJson: db.settingsJson })) {
      blockers.push("platform_mctb_sender");
    }
    if (mctbIngressWs && mctbIngressWs !== forWorkspaceId) {
      blockers.push(`mctb_ingress_for_${mctbIngressWs}`);
    }
    if (voiceAgent) blockers.push(`voice_agent_${voiceAgent.agentId}`);
    if (voiceV3TexmlDirect) blockers.push("voice_v3_texml_direct");
    if (db && db.workspaceId !== forWorkspaceId) {
      blockers.push(`phone_row_in_${db.workspaceId}`);
    }

    rows.push({
      e164: n.e164,
      telnyxProviderNumberId: n.id,
      dbPhoneNumberId: db?.id ?? null,
      dbWorkspaceId: db?.workspaceId ?? null,
      blockers,
      assignable: blockers.length === 0,
    });
  }

  return rows;
}

export async function pickTelnyxTollFreeIngressE164(
  forWorkspaceId: string,
): Promise<string | null> {
  const candidates = await listTelnyxTollFreeIngressCandidates(forWorkspaceId);
  const pick = candidates.find((c) => c.assignable);
  return pick?.e164 ?? null;
}

export async function telnyxOwnedIngressIsOnMctbTexml(e164: string): Promise<boolean> {
  const owned = await listTelnyxOwnedNumbers();
  const row = owned.find((n) => n.e164 === e164);
  if (!row?.connectionId) return false;
  return isMctbTexmlIngressConnection(row.connectionId);
}
