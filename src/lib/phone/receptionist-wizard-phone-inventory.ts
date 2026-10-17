import "server-only";

import { getPrisma } from "@/lib/db";
import { isMctbTexmlIngressLocked } from "@/lib/mctb/sip-ingress/sync";
import { loadMctbSetupPhoneOptions } from "@/lib/numbers/workspace-accessible-numbers";
import { describeTelnyxVoiceInventory } from "@/lib/phone/telnyx-voice-inventory";
import type { VoiceIngressProductId } from "@/lib/phone/voice-product-switch-types";
import {
  isVoiceAgentOutboundSmsSelectablePhone,
} from "@/lib/voice/sms/voice-agent-outbound-sms-inventory";

type AiOwnerInfo = {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
};

export type ReceptionistWizardPhoneRow = {
  id: string;
  e164: string;
  friendlyName: string | null;
  status: string;
  provider: string;
  type: string | null;
  a2pStatus: string | null;
  aiOwner: { id: string; name: string; status: string } | null;
  hasSoftphoneAssignment: boolean;
  mctbTexmlLocked: boolean;
  voiceIngressProduct: VoiceIngressProductId | "mctb" | "ai_receptionist" | "none";
  telnyxVoiceConfigurable: boolean;
  voiceInventoryBlockReason: "non_telnyx_provider" | "released" | "inactive" | null;
};

/**
 * Numbers for AI receptionist wizard + /api/phone/numbers — same inventory as MCTB setup.
 */
export async function loadReceptionistWizardPhoneInventory(
  workspaceId: string,
  options?: { voiceAgentOutboundSmsOnly?: boolean },
): Promise<ReceptionistWizardPhoneRow[]> {
  const prisma = getPrisma();
  const accessible = await loadMctbSetupPhoneOptions(workspaceId);
  const rows = accessible.map((n) => ({
    id: n.id,
    e164: n.e164,
    friendlyName: n.friendlyName,
    status: n.status || "Active",
    provider: n.provider || "telnyx",
    type: n.type,
    a2pStatus: n.a2pStatus,
    settingsJson: n.settingsJson,
  }));

  const inventoryRows = options?.voiceAgentOutboundSmsOnly
    ? rows.filter((row) => isVoiceAgentOutboundSmsSelectablePhone(row))
    : rows;

  if (inventoryRows.length === 0) {
    return [];
  }

  const ids = inventoryRows.map((r) => r.id);

  const joinOwners: Array<{ phoneNumberId: string; agentId: string }> =
    await prisma.voiceAgentPhoneNumber.findMany({
      where: {
        workspaceId,
        phoneNumberId: { in: ids },
        inboundEnabled: true,
      },
      select: { phoneNumberId: true, agentId: true },
    });

  const columnOwners: Array<{
    id: string;
    name: string;
    displayName: string | null;
    status: string;
    phoneNumberId: string | null;
  }> = await prisma.voiceAgent.findMany({
    where: {
      workspaceId,
      phoneNumberId: { in: ids },
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      status: true,
      phoneNumberId: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const humanAssignments: Array<{ phoneNumberId: string }> =
    await prisma.phoneNumberAssignment.findMany({
      where: { phoneNumberId: { in: ids } },
      select: { phoneNumberId: true },
    });

  const agentIds = [
    ...new Set([
      ...joinOwners.map((j) => j.agentId),
      ...columnOwners.map((a) => a.id),
    ]),
  ];

  const agents: AiOwnerInfo[] =
    agentIds.length > 0
      ? await prisma.voiceAgent.findMany({
          where: { workspaceId, id: { in: agentIds } },
          select: { id: true, name: true, displayName: true, status: true },
        })
      : [];

  const agentById = new Map<string, AiOwnerInfo>(agents.map((a) => [a.id, a]));
  const joinByPhone = new Map<string, string>(
    joinOwners.map((j) => [j.phoneNumberId, j.agentId]),
  );
  const columnByPhone = new Map<string, (typeof columnOwners)[number]>();
  for (const a of columnOwners) {
    if (a.phoneNumberId && !columnByPhone.has(a.phoneNumberId)) {
      columnByPhone.set(a.phoneNumberId, a);
    }
  }
  const softphonePhones = new Set(humanAssignments.map((h) => h.phoneNumberId));

  const { resolvePhoneVoiceIngressProduct } = await import("@/lib/phone/voice-product-switch");

  const data: ReceptionistWizardPhoneRow[] = [];

  for (const row of inventoryRows) {
    const joinAgentId = joinByPhone.get(row.id);
    const joinAgent = joinAgentId ? agentById.get(joinAgentId) ?? null : null;
    const columnAgent = columnByPhone.get(row.id) ?? null;
    const candidates: AiOwnerInfo[] = [];
    if (joinAgent) candidates.push(joinAgent);
    if (columnAgent) {
      candidates.push({
        id: columnAgent.id,
        name: columnAgent.name,
        displayName: columnAgent.displayName,
        status: columnAgent.status,
      });
    }
    const owner =
      candidates.find((a) => a.status === "ACTIVE") || candidates[0] || null;

    let ingress: {
      product: VoiceIngressProductId;
      agentId: string | null;
      agentName: string | null;
    } = { product: "none", agentId: null, agentName: null };
    try {
      ingress = await resolvePhoneVoiceIngressProduct(workspaceId, row.id);
    } catch (err) {
      console.warn(
        "[phone-inventory] ingress resolve failed",
        row.id,
        err instanceof Error ? err.message : err,
      );
    }

    const voiceIngressProduct = ingress.product ?? "none";
    const displayOwner =
      voiceIngressProduct === "ai_receptionist" && ingress.agentId
        ? {
            id: ingress.agentId,
            name: ingress.agentName || owner?.displayName || owner?.name || "AI Receptionist",
            status: owner?.status ?? "ACTIVE",
          }
        : owner
          ? {
              id: owner.id,
              name: owner.displayName || owner.name,
              status: owner.status,
            }
          : null;

    const inventory = describeTelnyxVoiceInventory({
      provider: row.provider,
      status: row.status,
    });

    data.push({
      id: row.id,
      e164: row.e164,
      friendlyName: row.friendlyName,
      status: row.status,
      provider: row.provider,
      type: row.type,
      a2pStatus: row.a2pStatus,
      aiOwner: displayOwner,
      hasSoftphoneAssignment: softphonePhones.has(row.id),
      mctbTexmlLocked: isMctbTexmlIngressLocked(row.settingsJson),
      voiceIngressProduct,
      telnyxVoiceConfigurable: inventory.telnyxVoiceConfigurable,
      voiceInventoryBlockReason: inventory.voiceInventoryBlockReason,
    });
  }

  return data.sort((a, b) => a.e164.localeCompare(b.e164));
}
