#!/usr/bin/env npx tsx
/**
 * One-shot: Phase 2B PSTN cert path — Call Control inbound + publish + Telnyx repair.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/enable-phase-2b-pstn-call-control-cert.ts
 */
import { getPrisma } from "../src/lib/db";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { getInboundRoutingMode } from "../src/lib/voice/telnyx/texml-direct-route";
import { diagnoseAndRepairInboundNumber } from "../src/lib/voice/telnyx/inbound-diagnostics";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const E164 = process.env.PHONE_E164 || "+15714073615";
const PHONE_ID = process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";
  const prisma = getPrisma();

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found in ${WORKSPACE_ID}`);

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, e164: true, providerNumberId: true },
  });
  if (!phone?.e164) throw new Error(`Phone ${PHONE_ID} not found`);

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const next = {
    ...prev,
    callHandling: {
      ...(prev.callHandling || {}),
      inboundRoutingMode: "call_control" as const,
    },
    advanced: {
      ...(prev.advanced || {}),
      voiceV2PstnLiveBooking: true,
    },
  };

  await prisma.voiceAgent.update({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    data: {
      draftConfig: next as object,
      phoneNumberId: phone.id,
      status: "ACTIVE",
    },
  });

  await prisma.voiceAgentPhoneNumber.upsert({
    where: {
      agentId_phoneNumberId: { agentId: AGENT_ID, phoneNumberId: phone.id },
    },
    create: {
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      phoneNumberId: phone.id,
      inboundEnabled: true,
      outboundEnabled: true,
      isDefault: true,
    },
    update: {
      inboundEnabled: true,
      outboundEnabled: true,
      isDefault: true,
    },
  });

  console.log("Publishing with inboundRoutingMode:", getInboundRoutingMode(next));
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AGENT_ID,
    "phase-2b-pstn-call-control-cert",
  );
  console.log({
    publishedVersion: published.version.version,
    telnyxAssistantId: published.agent.telnyxAssistantId,
    inboundRoutingMode: getInboundRoutingMode(
      parseVoiceAgentConfig(published.agent.draftConfig),
    ),
  });

  console.log("\nRepairing Telnyx inbound → Call Control…");
  const diag = await diagnoseAndRepairInboundNumber({
    workspaceId: WORKSPACE_ID,
    e164: E164,
    repair: true,
  });
  console.log(JSON.stringify({ ready: diag.ready, repairs: diag.repairs, issues: diag.issues }, null, 2));

  let liveConnectionId: string | null = null;
  const pid = phone.providerNumberId;
  if (pid) {
    const pn = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(pid)}`,
    );
    const row = (pn.data || pn) as Record<string, unknown>;
    liveConnectionId = row.connection_id ? String(row.connection_id) : null;
  }

  console.log("\n=== READY FOR PHASE 2B PSTN CERT ===");
  console.log(
    JSON.stringify(
      {
        callThisNumber: E164,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_ID,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        inboundRoutingMode: "call_control",
        telnyxConnectionIdOnDid: liveConnectionId,
        recommendedCallControlAppId: diag.recommendedConnectionId,
        diagReady: diag.ready,
        afterCall: `CONV_ID from Telnyx or CALL_ID from VoiceCall; run certify-voice-v2-phase-2b-pstn-startup.ts`,
      },
      null,
      2,
    ),
  );

  if (!diag.ready) {
    console.error("Inbound not ready — fix issues above before cert call");
    process.exit(1);
  }

  console.log(
    "\nNOTE: Call Control cert requires app deploy with inbound E164 disambiguation fix. " +
      "If PSTN fails, run restore-texml path in ops runbook before retrying CC.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
