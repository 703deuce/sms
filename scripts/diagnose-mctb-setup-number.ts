/**
 * Diagnose MCTB setup number routing + voice agent conflicts.
 * Usage: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diagnose-mctb-setup-number.ts [email]
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { verifyEventOnlyRouteForE164 } from "@/lib/mctb/consent-prompt/telnyx-event-only-route";
import { classifyTelnyxConnectionId } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";
import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";

const email = process.argv[2]?.trim() || "703deuce@gmail.com";

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, phone: true, email: true },
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const mem = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  if (!mem) {
    console.error("No workspace membership");
    process.exit(1);
  }

  const wsId = mem.workspaceId;
  const [runtime, ws, consent] = await Promise.all([
    prisma.missedCallTextConfig.findUnique({ where: { workspaceId: wsId } }),
    prisma.workspace.findUnique({
      where: { id: wsId },
      select: { name: true, customFieldsConfig: true },
    }),
    loadMctbConsentPrompt(wsId),
  ]);

  const cfg =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  console.log("\n══ MCTB Setup Diagnosis ══\n");
  console.log("User:", user.email, user.phone);
  console.log("Workspace:", ws?.name, wsId);
  console.log("Consent mode:", mctb.consentMode);
  console.log("Business line:", mctb.businessLineE164);
  console.log("Runtime enabled:", runtime?.enabled);
  console.log("Runtime phoneNumberId:", runtime?.phoneNumberId);
  console.log("Consent published:", consent.publishedAt, consent.publishedAudioAssetId);

  const pnId = runtime?.phoneNumberId;
  if (!pnId) {
    console.log("\n⚠ No MCTB phone assigned in runtime config");
    process.exit(0);
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { id: pnId },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      providerNumberId: true,
      settingsJson: true,
      status: true,
    },
  });

  const settings = pn?.settingsJson as Record<string, unknown> | null;
  console.log("\nAssigned number:");
  console.log("  E164:", pn?.e164);
  console.log("  Owner workspace:", pn?.workspaceId);
  console.log("  Provider:", pn?.provider);
  console.log("  Status:", pn?.status);
  console.log("  mctbSipIngress:", isPhoneMctbSipIngress(pn?.settingsJson));
  console.log("  telephony:", settings?.telephony);
  console.log("  callHandlingMode:", settings?.callHandlingMode);

  if (pn?.e164 && String(pn.provider || "").toLowerCase() === "telnyx") {
    const verify = await verifyEventOnlyRouteForE164(pn.e164);
    console.log("\nTelnyx live route:");
    console.log("  OK:", verify.ok);
    console.log("  Detail:", verify.detail);
    if (verify.liveConnectionId) {
      console.log("  Connection kind:", await classifyTelnyxConnectionId(verify.liveConnectionId));
    }
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { phoneNumberId: pnId },
    select: { id: true, name: true, status: true, agentType: true, workspaceId: true },
  });
  console.log("\nVoice agents bound to this number:", agents.length);
  for (const a of agents) {
    console.log(`  - ${a.name} (${a.agentType}) status=${a.status} ws=${a.workspaceId}`);
  }

  const activeAgents = await prisma.voiceAgent.findMany({
    where: { workspaceId: wsId, status: "ACTIVE", phoneNumberId: { not: null } },
    select: { id: true, name: true, phoneNumberId: true, agentType: true },
  });
  if (activeAgents.length) {
    console.log("\nActive voice agents in workspace (any number):");
    for (const a of activeAgents) {
      console.log(`  - ${a.name} phone=${a.phoneNumberId}`);
    }
  }

  const flows = await prisma.smartRoutingFlow.findMany({
    where: { workspaceId: wsId, status: "active" },
    select: { id: true, name: true, assignedPhoneNumberId: true, type: true },
  });
  console.log("\nActive Smart Routing flows:", flows.length);
  for (const f of flows) {
    console.log(`  - ${f.name} (${f.type}) phone=${f.assignedPhoneNumberId}`);
  }

  const setup = await prisma.solutionSetup.findFirst({
    where: { workspaceId: wsId, solutionType: "missed_call_text_back" },
    select: { status: true, linkedPhoneNumberIds: true },
  });
  console.log("\nSolution setup status:", setup?.status);

  const allPn = await prisma.phoneNumber.findMany({
    where: { workspaceId: wsId, releasedAt: null },
    select: { id: true, e164: true, settingsJson: true },
  });
  console.log("\nAll workspace numbers:");
  for (const row of allPn) {
    const v = row.e164 ? await verifyEventOnlyRouteForE164(row.e164) : null;
    const kind =
      v?.liveConnectionId ? await classifyTelnyxConnectionId(v.liveConnectionId) : "n/a";
    console.log(
      `  ${row.e164} id=${row.id.slice(0, 8)}… mctbSip=${isPhoneMctbSipIngress(row.settingsJson)} eventOnly=${v?.ok} kind=${kind} mode=${(row.settingsJson as Record<string, unknown>)?.callHandlingMode}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
