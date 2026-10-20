import { getPrisma } from "@/lib/server/db";

export type ForwardingEntitlements = {
  destinations: { used: number; max: number; atLimit: boolean };
  ringGroups: { used: number; max: number; atLimit: boolean };
  ivrMenus: { used: number; max: number; atLimit: boolean };
  nestedMenus: boolean;
  simultaneousRing: boolean;
  callScreening: boolean;
  includedForwardedMinutes: number;
  planLabel: string;
};

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getForwardingEntitlements(workspaceId: string): Promise<ForwardingEntitlements> {
  const prisma = getPrisma();
  const [destCount, groupCount, menuCount] = await Promise.all([
    prisma.forwardingDestination.count({ where: { workspaceId } }),
    prisma.forwardingGroup.count({ where: { workspaceId } }),
    prisma.autoAttendantMenu.count({ where: { workspaceId } }),
  ]);

  const maxDest = envInt("PHONE_FORWARDING_MAX_DESTINATIONS", 25);
  const maxGroups = envInt("PHONE_FORWARDING_MAX_RING_GROUPS", 10);
  const maxMenus = envInt("PHONE_FORWARDING_MAX_IVR_MENUS", 15);

  return {
    destinations: {
      used: destCount,
      max: maxDest,
      atLimit: destCount >= maxDest,
    },
    ringGroups: {
      used: groupCount,
      max: maxGroups,
      atLimit: groupCount >= maxGroups,
    },
    ivrMenus: {
      used: menuCount,
      max: maxMenus,
      atLimit: menuCount >= maxMenus,
    },
    nestedMenus: process.env.PHONE_FORWARDING_NESTED_MENUS !== "0",
    simultaneousRing: process.env.PHONE_FORWARDING_SIMULTANEOUS !== "0",
    callScreening: true,
    includedForwardedMinutes: envInt("PHONE_FORWARDING_INCLUDED_MINUTES", 500),
    planLabel: process.env.PHONE_FORWARDING_PLAN_LABEL || "Phone forwarding",
  };
}
