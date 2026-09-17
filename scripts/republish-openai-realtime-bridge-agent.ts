/**
 * Republish live Voice V2 agent for OpenAI Realtime media bridge (Call Control + DID route).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/republish-openai-realtime-bridge-agent.ts
 */
import { getPrisma } from "@/lib/db";
import { publishVoiceAgent, updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { applyAmyMinimumSideEffectConfig } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import { shouldUseOpenAiRealtimeMediaBridge } from "@/lib/voice/telnyx/openai-realtime-bridge/flags";
import { getInboundRoutingMode } from "@/lib/voice/telnyx/texml-direct-route";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { diagnoseAndRepairInboundNumber } from "@/lib/voice/telnyx/inbound-diagnostics";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

/**
 * ws_1 OpenAI Realtime bridge republish — 571 cert line only (override via env).
 * Default: +15714073615 / cmshz2lc25c622c4i58303501
 */
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = process.env.PHONE_E164 || "+15714073615";
const PHONE_ID = process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v";
const AGENT_ID =
  process.env.VOICE_AGENT_ID || process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const PUBLISHED_BY = process.env.PUBLISHED_BY || "openai-realtime-bridge-republish";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";
  const prisma = getPrisma();

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { phoneNumber: { select: { id: true, e164: true, providerNumberId: true } } },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found in ${WORKSPACE_ID}`);

  const phone571 = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, e164: true, providerNumberId: true },
  });
  if (!phone571?.e164) {
    throw new Error(`571 phone ${PHONE_ID} not found in ${WORKSPACE_ID}`);
  }
  if (phone571.e164 !== PHONE_E164) {
    console.warn(`571 phone e164 ${phone571.e164} differs from expected ${PHONE_E164}`);
  }

  if (agent.id === AGENT_ID && agent.phoneNumberId !== phone571.id) {
    await prisma.voiceAgent.update({
      where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
      data: { phoneNumberId: phone571.id },
    });
    const { syncVoiceAgentPhoneAssignment } = await import("@/lib/voice/agent-phone");
    await syncVoiceAgentPhoneAssignment({
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      phoneNumberId: phone571.id,
      exclusive: true,
      allowMctbTexmlVoiceAgentTakeover: true,
    });
    console.log("Assigned agent to 571", phone571.e164);
  }

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const next = applyAmyMinimumSideEffectConfig({
    ...prev,
    compliance: {
      ...(prev.compliance || {}),
      recordingDisclosure: false,
      recordingDisclosureText: "",
    },
    voiceLanguage: {
      ...(prev.voiceLanguage || {}),
      voiceId: "marin",
    },
    advanced: {
      ...(prev.advanced as object),
      bookingStrategy: "MICROSOFT_365",
      voiceV2PstnLiveBooking: true,
      conversationWorkflowMode: true,
      realtimeVoice: "marin",
    },
  });

  if (!shouldUseOpenAiRealtimeMediaBridge(next)) {
    throw new Error("Bridge not enabled after applyAmyMinimumSideEffectConfig — check draft flags");
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, next);

  console.log("Publishing", agent.name, AGENT_ID);
  console.log("inboundRoutingMode (draft):", getInboundRoutingMode(next));
  console.log("voiceTransport:", (next.advanced as Record<string, unknown>)?.voiceTransport);

  const published = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, PUBLISHED_BY);
  const publishedCfg = parseVoiceAgentConfig(published.version.config);

  const refreshedAgent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { phoneNumber: { select: { id: true, e164: true, providerNumberId: true } } },
  });
  const e164 = refreshedAgent?.phoneNumber?.e164 || phone571.e164;
  const pid = refreshedAgent?.phoneNumber?.providerNumberId || phone571.providerNumberId;
  let telnyxConnectionId: string | null = null;
  if (pid) {
    const pn = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(pid)}`,
    );
    const row = (pn.data || pn) as Record<string, unknown>;
    telnyxConnectionId = row.connection_id ? String(row.connection_id) : null;
  }

  let diag: Awaited<ReturnType<typeof diagnoseAndRepairInboundNumber>> | null = null;
  if (e164) {
    diag = await diagnoseAndRepairInboundNumber({
      workspaceId: WORKSPACE_ID,
      e164,
      repair: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId: AGENT_ID,
        agentName: agent.name,
        version: published.version.version,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        inboundRoutingMode: getInboundRoutingMode(publishedCfg),
        voiceTransport: (publishedCfg.advanced as Record<string, unknown>)?.voiceTransport,
        bridgeEnabled: shouldUseOpenAiRealtimeMediaBridge(publishedCfg),
        phoneE164: e164,
        telnyxConnectionIdOnDid: telnyxConnectionId,
        publishRoute: published.texmlRoute,
        inboundDiagReady: diag?.ready,
        inboundRepairs: diag?.repairs,
        inboundIssues: diag?.issues,
      },
      null,
      2,
    ),
  );

  if (e164 && diag && !diag.ready) {
    console.error("Inbound diagnostics not ready — review issues before PSTN test");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
