#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { resolveMctbSipIngressByDid, isMctbSipIngressTarget } from "@/lib/mctb/sip-ingress/resolver";
import {
  handleMctbEventOnlyTelnyxWebhook,
  resetMctbEventOnlyTelnyxStateForTests,
} from "@/lib/mctb/event-only/telnyx-handler";
import { isPhoneMctbSipIngress, isMctbCallControlVoiceIngress } from "@/lib/mctb/sip-ingress/sync";

const E164 = process.argv[2]?.trim() || "+15714073615";

async function main() {
  console.log("\n══ MCTB ingress debug ══\n");

  const resolved = await resolveMctbSipIngressByDid(E164);
  console.log("resolveMctbSipIngressByDid:", JSON.stringify(resolved, null, 2));
  console.log("isMctbSipIngressTarget:", await isMctbSipIngressTarget(E164));

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: E164 },
    select: { id: true, workspaceId: true, settingsJson: true, status: true },
  });
  console.log("\nPhone row workspace:", pn?.workspaceId);
  console.log("mctbSipIngress:", isPhoneMctbSipIngress(pn?.settingsJson));
  console.log("callControlVoice:", isMctbCallControlVoiceIngress(pn?.settingsJson));

  const runtime = await prisma.missedCallTextConfig.findMany({
    where: { phoneNumberId: pn?.id },
    select: { workspaceId: true, enabled: true },
  });
  console.log("\nRuntime configs pointing at this phone:", JSON.stringify(runtime));

  const missed = await prisma.missedCallEvent.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      createdAt: true,
      callerE164: true,
      businessE164: true,
      status: true,
      metadata: true,
    },
  });
  console.log("\nRecent missedCallEvent (7d):");
  for (const m of missed) {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    console.log(
      " ",
      m.createdAt.toISOString(),
      m.callerE164,
      "→",
      m.businessE164,
      m.status,
      meta.path || meta.captureMode || "",
    );
  }

  resetMctbEventOnlyTelnyxStateForTests();
  const initiated = await handleMctbEventOnlyTelnyxWebhook({
    eventType: "call.initiated",
    eventPayload: {
      call_control_id: "mock_v3:ingress-test",
      from: "+17038166017",
      to: E164,
      direction: "incoming",
    },
    fallbackWorkspaceId: "ws_1",
  });
  console.log("\nmock call.initiated:", JSON.stringify(initiated));

  const notInbound = await handleMctbEventOnlyTelnyxWebhook({
    eventType: "call.initiated",
    eventPayload: {
      call_control_id: "mock_v3:outbound-test",
      from: E164,
      to: "+17038166017",
      direction: "outgoing",
    },
    fallbackWorkspaceId: "ws_1",
  });
  console.log("mock outbound (should not handle):", JSON.stringify(notInbound));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
