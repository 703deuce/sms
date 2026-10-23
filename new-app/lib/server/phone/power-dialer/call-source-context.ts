import { getPrisma } from "@/lib/server/db";
import { buildPowerDialerCallSource, type PowerDialerCallSource } from "./call-source-label";

export async function loadPowerDialerCallSources(
  workspaceId: string,
  humanCallIds: string[],
): Promise<Map<string, PowerDialerCallSource>> {
  const out = new Map<string, PowerDialerCallSource>();
  if (!humanCallIds.length) return out;
  const prisma = getPrisma();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, humanCallId: { in: humanCallIds } },
    select: {
      humanCallId: true,
      session: {
        select: {
          campaign: { select: { id: true, name: true, listId: true } },
        },
      },
    },
  });
  const listIds = [
    ...new Set(
      attempts.map((a) => a.session.campaign.listId).filter(Boolean) as string[],
    ),
  ];
  const lists = listIds.length
    ? await prisma.contactList.findMany({
        where: { workspaceId, id: { in: listIds } },
        select: { id: true, name: true },
      })
    : [];
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const calls = await prisma.humanCall.findMany({
    where: { workspaceId, id: { in: humanCallIds } },
    select: { id: true, source: true, metadata: true },
  });
  const callById = new Map(calls.map((c) => [c.id, c]));
  for (const a of attempts) {
    if (!a.humanCallId) continue;
    const call = callById.get(a.humanCallId);
    const camp = a.session.campaign;
    out.set(
      a.humanCallId,
      buildPowerDialerCallSource({
        source: call?.source ?? "power_dialer",
        metadata: (call?.metadata || {}) as Record<string, unknown>,
        campaignId: camp.id,
        campaignName: camp.name,
        listId: camp.listId,
        listName: listName.get(camp.listId) || undefined,
      }),
    );
  }
  return out;
}
