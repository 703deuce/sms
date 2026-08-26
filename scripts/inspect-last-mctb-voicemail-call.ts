/**
 * Inspect last MCTB SIP call voicemail state.
 * Run: npx tsx scripts/inspect-last-mctb-voicemail-call.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveMctbVoicemailFallbackPlayback } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);

  const missed = await prisma.missedCallEvent.findFirst({
    where: {
      createdAt: { gte: since },
      businessE164: MCTB_PLATFORM_DEMO_E164,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log("last missedCallEvent:", JSON.stringify(missed, null, 2));

  const vms = await prisma.voicemailMessage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("\nrecent voicemailMessage:", JSON.stringify(vms, null, 2));

  const workspaceId = "ws_1";
  const boxes = await prisma.voicemailBox.findMany({
    where: { workspaceId },
    select: {
      id: true,
      greetingUrl: true,
      greetingText: true,
      phoneNumberId: true,
      transcriptionEnabled: true,
    },
  });
  console.log("\nvoicemailBox:", JSON.stringify(boxes, null, 2));

  const playback = await resolveMctbVoicemailFallbackPlayback(workspaceId, MCTB_PLATFORM_DEMO_E164);
  console.log("\nresolveMctbVoicemailFallbackPlayback:", JSON.stringify(playback, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
