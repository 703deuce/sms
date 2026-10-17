import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { isMctbTexmlIngressLocked } from "@/lib/mctb/sip-ingress/sync";
import { describeTelnyxVoiceInventory } from "@/lib/phone/telnyx-voice-inventory";
import {
  isVoiceAgentOutboundSmsSelectablePhone,
  VOICE_AGENT_OUTBOUND_SMS_NUMBERS_QUERY,
} from "@/lib/voice/sms/voice-agent-outbound-sms-inventory";
type AiOwnerInfo = {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
};

export async function GET(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const eligibleFor = new URL(req.url).searchParams.get("eligibleFor");
    const voiceAgentOutboundSmsOnly =
      eligibleFor === VOICE_AGENT_OUTBOUND_SMS_NUMBERS_QUERY;
    const prisma = getPrisma();
    const rows: Array<{
      id: string;
      e164: string;
      friendlyName: string | null;
      status: string;
      provider: string;
      type: string | null;
      a2pStatus: string | null;
      settingsJson: unknown;
    }> = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { e164: "asc" },
      select: {
        id: true,
        e164: true,
        friendlyName: true,
        status: true,
        provider: true,
        type: true,
        a2pStatus: true,
        settingsJson: true,
      },
    });

    const inventoryRows = voiceAgentOutboundSmsOnly
      ? rows.filter((row) => isVoiceAgentOutboundSmsSelectablePhone(row))
      : rows;

    if (inventoryRows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const ids = inventoryRows.map((r) => r.id);

    const joinOwners: Array<{ phoneNumberId: string; agentId: string }> =
      await prisma.voiceAgentPhoneNumber.findMany({
        where: {
          workspaceId: auth.workspaceId,
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
        workspaceId: auth.workspaceId,
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
            where: { workspaceId: auth.workspaceId, id: { in: agentIds } },
            select: { id: true, name: true, displayName: true, status: true },
          })
        : [];

    const agentById = new Map<string, AiOwnerInfo>(
      agents.map((a) => [a.id, a]),
    );
    const joinByPhone = new Map<string, string>(
      joinOwners.map((j) => [j.phoneNumberId, j.agentId]),
    );
    const columnByPhone = new Map<string, (typeof columnOwners)[number]>();
    for (const a of columnOwners) {
      if (a.phoneNumberId && !columnByPhone.has(a.phoneNumberId)) {
        columnByPhone.set(a.phoneNumberId, a);
      }
    }
    const softphonePhones = new Set(
      humanAssignments.map((h) => h.phoneNumberId),
    );

    const { resolvePhoneVoiceIngressProduct } = await import(
      "@/lib/phone/voice-product-switch"
    );
    const ingressByPhone = await Promise.all(
      inventoryRows.map(async (row) => ({
        id: row.id,
        ingress: await resolvePhoneVoiceIngressProduct(auth.workspaceId, row.id),
      })),
    );
    const ingressMap = new Map(ingressByPhone.map((e) => [e.id, e.ingress]));

    const data = inventoryRows.map((row) => {
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
      const ingress = ingressMap.get(row.id);
      const voiceIngressProduct = ingress?.product ?? "none";
      const displayOwner =
        voiceIngressProduct === "ai_receptionist" && ingress?.agentId
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
      return {
        ...row,
        aiOwner: displayOwner,
        hasSoftphoneAssignment: softphonePhones.has(row.id),
        mctbTexmlLocked: isMctbTexmlIngressLocked(row.settingsJson),
        voiceIngressProduct,
        telnyxVoiceConfigurable: inventory.telnyxVoiceConfigurable,
        voiceInventoryBlockReason: inventory.voiceInventoryBlockReason,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
