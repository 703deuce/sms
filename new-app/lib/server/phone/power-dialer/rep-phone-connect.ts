/** M03 — rep connects via verified cell/desk phone instead of browser WebRTC. */

import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

export type RepConnectMode = "browser" | "cell" | "desk";

export type RepPhoneConnectConfig = {
  mode: RepConnectMode;
  verifiedE164: string | null;
  costAccounted: boolean;
};

export async function getRepPhoneConnectConfig(
  workspaceId: string,
  repUserId: string | null,
): Promise<RepPhoneConnectConfig> {
  const settings = await getPowerDialerSettings(workspaceId);
  const assignments = settings.repNumberAssignments || {};
  const repKey = repUserId || "";
  const nums = repKey ? assignments[repKey] : undefined;
  const prisma = getPrisma();
  if (nums?.length) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, id: nums[0], status: "active" },
    });
    if (pn?.e164) {
      return {
        mode: "cell",
        verifiedE164: normalizeE164(pn.e164),
        costAccounted: true,
      };
    }
  }
  const row = await prisma.workspacePhoneSettings.findUnique({ where: { workspaceId } });
  const prefs = (row?.prefsJson || {}) as Record<string, unknown>;
  const desk = typeof prefs.repDeskPhoneE164 === "string" ? prefs.repDeskPhoneE164 : null;
  if (desk) {
    return {
      mode: "desk",
      verifiedE164: normalizeE164(desk),
      costAccounted: true,
    };
  }
  return { mode: "browser", verifiedE164: null, costAccounted: false };
}

export function repLegBillingNote(config: RepPhoneConnectConfig): string {
  if (config.mode === "browser") return "Rep audio via browser WebRTC";
  return `Rep audio via ${config.mode} ${config.verifiedE164 || ""} (PSTN leg billed)`;
}
