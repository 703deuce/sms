/**
 * Switch ws_1 Amy (866) from Calendly + conversation-workflow SMS links
 * to live internal Transovo calendar booking via continue_workflow.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/setup-ws1-internal-booking-test.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "../src/lib/voice/types";
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import {
  CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS,
  filterToolsForCallerAmyPublish,
} from "../src/lib/voice/workflow-engine/tool-publish";
import { applyLatencyProfileToConfig } from "../src/lib/voice/latency-profiles";
import { AMY_FLUX_PROFILE, AMY_MINIMUM_SIDE_EFFECT_MODEL } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { OPENAI_API_KEY_REF } from "../src/lib/voice/telnyx/official-baseline";
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18666020680";
const PHONE_TELNYX_ID = process.env.PHONE_TELNYX_ID || "3020837399669245525";

function buildLegacyInternalBookingConfig(current: VoiceAgentConfig): VoiceAgentConfig {
  const enabledBuiltinTools = resolveEnabledBuiltinTools({
    agentType: "appointment_booking",
  });

  const advanced = {
    ...(current.advanced || {}),
    minimumSideEffectMode: false,
    conversationWorkflowMode: false,
    voiceArchitectureVersion: "telnyx-internal-booking-test-v1",
    internalBookingTestMode: true,
  };

  const tuned = applyLatencyProfileToConfig(
    {
      ...current,
      enabledBuiltinTools,
      advanced,
    },
    AMY_FLUX_PROFILE,
  );

  return {
    ...tuned,
    model: {
      ...(tuned.model || {}),
      provider: "telnyx",
      modelId: AMY_MINIMUM_SIDE_EFFECT_MODEL,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: tuned.model?.temperature ?? 0.35,
      maxTokens: tuned.model?.maxTokens ?? 800,
    },
    instructions: {
      ...(tuned.instructions || {}),
      system: [
        tuned.instructions?.system || "",
        "",
        "INTERNAL BOOKING TEST MODE:",
        "- Book appointments on Transovo's own calendar (not Calendly, not SMS booking links).",
        "- Collect caller name and phone, then use continue_workflow to check availability and book.",
        "- Offer 2-3 available times from calendar_availability before confirming.",
        "- After booking, confirm date, time, and service verbally.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  };
}

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();

  console.log("=== 1. Disconnect Calendly for internal calendar routing ===");
  const calendly = await prisma.integrationConnection.findFirst({
    where: { workspaceId: WORKSPACE_ID, provider: "calendly" },
  });
  if (calendly) {
    await prisma.integrationConnection.update({
      where: { id: calendly.id },
      data: {
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });
    console.log(`Disconnected Calendly connection ${calendly.id}`);
  } else {
    console.log("No Calendly connection found (already internal-only)");
  }

  const services = await prisma.voiceService.findMany({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { name: "asc" },
  });
  const enabled = services.filter((s) => (s.config as { enabled?: boolean })?.enabled !== false);
  console.log(
    "Enabled appointment types:",
    enabled.map((s) => `${s.name} (${s.durationMinutes}m)`).join(", ") ||
      "(none — enable at least one VoiceService)",
  );
  if (!enabled.length) {
    throw new Error("No enabled VoiceService appointment types on ws_1");
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent ${AMY_AGENT_ID} not found on ${WORKSPACE_ID}`);

  console.log("\n=== 2. Switch Amy to legacy continue_workflow booking surface ===");
  const current = parseVoiceAgentConfig(agent.draftConfig);
  const draftConfig = buildLegacyInternalBookingConfig(current);

  const publishedTools = filterToolsForCallerAmyPublish(
    draftConfig.enabledBuiltinTools || [],
    draftConfig,
  );
  console.log("Published webhook tools:", publishedTools.join(", "));

  for (const required of CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS) {
    if (!publishedTools.includes(required)) {
      throw new Error(`Missing required published tool: ${required}`);
    }
  }
  for (const forbidden of ["send_resource", "calendar_availability", "book_appointment"]) {
    if (publishedTools.includes(forbidden)) {
      throw new Error(`Tool ${forbidden} should be internal-only, not published`);
    }
  }

  const telnyxTools = buildAssistantTools({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: draftConfig.enabledBuiltinTools || [],
    agentType: "appointment_booking",
    voiceConfig: draftConfig,
  });
  const telnyxNames = telnyxTools
    .map((t) => {
      const w = (t as { webhook?: { name?: string } }).webhook;
      if (w?.name) return w.name;
      if ((t as { hangup?: unknown }).hangup) return "hangup";
      return null;
    })
    .filter(Boolean);
  console.log("Telnyx assistant tools:", telnyxNames.join(", "));
  if (!telnyxNames.includes("continue_workflow")) {
    throw new Error("Telnyx build missing continue_workflow");
  }
  if (!telnyxNames.includes("hangup")) {
    throw new Error("Telnyx build missing hangup");
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, { draftConfig });
  console.log("Updated Amy draft config");

  let phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: WORKSPACE_ID, e164: PHONE_E164 },
  });
  if (!phone) {
    phone = await prisma.phoneNumber.create({
      data: {
        workspaceId: WORKSPACE_ID,
        e164: PHONE_E164,
        provider: "telnyx",
        providerNumberId: PHONE_TELNYX_ID,
        type: "TollFree",
        status: "Active",
        settingsJson: {
          telephony: { routingMode: "telnyx_assistant", routingOwner: "voice_agent" },
          aiAfterHoursEnabled: true,
          voiceEnabled: true,
        },
      },
    });
    console.log(`Imported test DID ${PHONE_E164} into ${WORKSPACE_ID}`);
  } else {
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        providerNumberId: PHONE_TELNYX_ID,
        status: "Active",
        settingsJson: {
          ...(typeof phone.settingsJson === "object" ? phone.settingsJson : {}),
          telephony: { routingMode: "telnyx_assistant", routingOwner: "voice_agent" },
          aiAfterHoursEnabled: true,
          voiceEnabled: true,
          mctbTexmlIngress: undefined,
        },
      },
    });
    console.log(`Reused existing phone row for ${PHONE_E164}`);
  }

  await prisma.voiceAgent.update({
    where: { id: AMY_AGENT_ID },
    data: { phoneNumberId: phone.id, directions: ["inbound"] },
  });

  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: phone.id, agentId: { not: AMY_AGENT_ID } },
  });
  await prisma.voiceAgentPhoneNumber.upsert({
    where: { agentId_phoneNumberId: { agentId: AMY_AGENT_ID, phoneNumberId: phone.id } },
    create: {
      workspaceId: WORKSPACE_ID,
      agentId: AMY_AGENT_ID,
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
  console.log(`Assigned ${PHONE_E164} exclusively to Amy (bypassing MCTB-locked 866)`);

  console.log("\n=== 3. Publish + restore TeXML inbound route ===");
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "internal-booking-test",
  );
  console.log(
    JSON.stringify(
      {
        agent: published.agent.name,
        status: published.agent.status,
        version: published.version.version,
        telnyxAssistantId: published.agent.telnyxAssistantId,
      },
      null,
      2,
    ),
  );

  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phone.id,
    agentId: AMY_AGENT_ID,
  });
  console.log("TeXML route:", restored);

  console.log("\n=== READY — internal booking test ===");
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Agent: ${agent.name} (${AMY_AGENT_ID})`);
  console.log(`Call: ${PHONE_E164}`);
  console.log("Calendly: disconnected (internal calendar active)");
  console.log("Bookable types:", enabled.map((s) => s.name).join(", "));
  console.log("\nTest script:");
  console.log('  "Hi, I need to book a service visit for tomorrow afternoon."');
  console.log("  Give name + callback number when asked, pick a offered slot.");
  console.log("  Then verify appointment appears under /appointments on ws_1.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
