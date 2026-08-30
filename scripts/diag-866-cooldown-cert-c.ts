/**
 * Diagnose cert-C press-1 SMS + cooldown for 866 testing.
 */
import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { readAdminTestWorkspaceIds } from "../src/lib/mctb/platform-demo-access-shared";
import { resolveMctbSipIngressByDid } from "../src/lib/mctb/sip-ingress/resolver";

const PHONE_866_ID = "cmsc3numa1j17084g391t2z5l";
const WS = "ws_1";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  const cfg = await loadMissedCallTextConfig(WS);
  const ingress = await resolveMctbSipIngressByDid(phone?.e164 || "+18663464256");

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recent = await prisma.missedCallEvent.findMany({
    where: { workspaceId: WS, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      status: true,
      suppressionReason: true,
      smsSentAt: true,
      metadata: true,
    },
  });

  const cooldownSince = new Date(Date.now() - cfg.cooldownMinutes * 60_000);
  const sentInCooldown = await prisma.missedCallEvent.count({
    where: {
      workspaceId: WS,
      smsSentAt: { gte: cooldownSince },
    },
  });

  console.log(
    JSON.stringify(
      {
        adminTestIds: readAdminTestWorkspaceIds(phone?.settingsJson),
        ingress,
        cooldownMinutes: cfg.cooldownMinutes,
        maxMessagesPerCaller: cfg.maxMessagesPerCaller,
        sentInCooldownWindow: sentInCooldown,
        cooldownExpiresApprox: new Date(
          cooldownSince.getTime() + cfg.cooldownMinutes * 60_000,
        ).toISOString(),
        recentWs1Events: recent,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
