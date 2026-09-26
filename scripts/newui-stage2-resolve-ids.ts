import { resolveDevAutoSession } from "@/lib/auth/dev-auto-session";
import { getPrisma } from "@/lib/db";

async function main() {
  process.env.DEV_AUTH_BYPASS = "1";
  const dev = await resolveDevAutoSession();
  if (!dev?.workspaceId) {
    console.error("No dev workspace");
    process.exit(1);
  }
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { workspaceId: dev.workspaceId },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  const missed = await prisma.missedCallEvent.findFirst({
    where: { workspaceId: dev.workspaceId },
    orderBy: { detectedAt: "desc" },
    select: { id: true, detectedAt: true },
  });
  console.log(
    JSON.stringify({
      workspaceId: dev.workspaceId,
      voiceCallId: call?.id ?? null,
      voiceCallStartedAt: call?.startedAt?.toISOString() ?? null,
      mctbMissedId: missed?.id ?? null,
      mctbMissedDetectedAt: missed?.detectedAt?.toISOString() ?? null,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
