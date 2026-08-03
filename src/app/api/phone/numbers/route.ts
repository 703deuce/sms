import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

type AiOwnerInfo = {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
};

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows: Array<{
      id: string;
      e164: string;
      friendlyName: string | null;
      status: string;
    }> = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { e164: "asc" },
      select: { id: true, e164: true, friendlyName: true, status: true },
    });

    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const ids = rows.map((r) => r.id);

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

    const data = rows.map((row) => {
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
      return {
        ...row,
        aiOwner: owner
          ? {
              id: owner.id,
              name: owner.displayName || owner.name,
              status: owner.status,
            }
          : null,
        hasSoftphoneAssignment: softphonePhones.has(row.id),
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
