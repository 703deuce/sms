/**
 * Hook MCTB 8-step voice agent to the shared MCTB DID with company knowledge for PSTN test.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-voice-agent-call-ready.ts
 */
import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { syncCompanyBrainFromWizard } from "../src/lib/agents/appointment-booking/sync-company-brain-from-wizard";
import { setInboundHandlingMode } from "../src/lib/mctb/inbound-handling/switch-mode";
import { persistMctbLineInboundConfig } from "../src/lib/mctb/inbound-handling/line-config";
import { getVoiceAgentReadiness } from "../src/lib/mctb/inbound-handling/voice-readiness";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
/** 571 test line for ws_1 voice agent; override with MCTB_PHONE_ID / MCTB_E164. */
const MCTB_PHONE_ID = process.env.MCTB_PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v";
const MCTB_E164 = process.env.MCTB_E164 || "+15714073615";

function loadWizardFromConfig(config: Record<string, unknown>): AppointmentReceptionistWizardState {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const stored = advanced.appointmentReceptionistWizard as
    | Partial<AppointmentReceptionistWizardState>
    | undefined;
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "After-Hours Voice Agent",
    role: "After-hours voice assistant",
    ...(stored || {}),
  } as AppointmentReceptionistWizardState;
}

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();
  const phoneId = MCTB_PHONE_ID;

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneId, workspaceId: WORKSPACE_ID },
    select: { id: true, e164: true, providerNumberId: true },
  });
  if (!phone?.e164) throw new Error(`MCTB phone ${phoneId} not found`);

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found`);

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  let wizard = applyHarborDrainProsWizardKnowledge(loadWizardFromConfig(prev as Record<string, unknown>));
  wizard = {
    ...wizard,
    agentId: AGENT_ID,
    agentName: wizard.agentName || "Amy",
    businessName: "Harbor Drain Pros",
    phoneNumberId: phone.id,
    phoneNumberE164: phone.e164,
    numberSource: "forward_existing",
    answerWhen: "after_hours",
    preset: "after_hours",
    capabilities: [
      "answer_questions",
      "take_messages",
      "transfer_calls",
      "book_appointments",
      "send_sms_confirmations",
    ],
    openingGreeting:
      "Thank you for calling Harbor Drain Pros. This is Amy, the after-hours assistant. How can I help you?",
    appointmentTypes: [
      {
        id: "service-visit",
        name: "Service Visit",
        durationMin: 60,
        calendar: "default",
        status: "ready",
        requiredFields: [],
        bookingPermission: "book_directly",
        enabled: true,
      },
    ],
    calendarConnected: true,
  };

  let draftConfig = buildWizardAgentConfig(wizard);
  draftConfig = applyAmyMinimumSideEffectConfig(draftConfig);
  draftConfig = {
    ...draftConfig,
    advanced: {
      ...(draftConfig.advanced || {}),
      voiceCanonicalAiBooking: true,
      voiceBookingMode: "AI_BOOK",
    },
  };

  if (!phone.providerNumberId) {
    throw new Error(`Phone ${phone.e164} missing providerNumberId — cannot route Telnyx`);
  }

  await prisma.voiceAgent.update({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    data: {
      draftConfig: draftConfig as object,
      displayName: wizard.agentName,
      status: "ACTIVE",
    },
  });

  await syncCompanyBrainFromWizard(WORKSPACE_ID, wizard);

  console.log("Publishing voice agent + syncing Telnyx (workflow, tools, instructions)…");
  const built = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "mctb-voice-call-ready-reactivate");
  console.log({
    status: built.agent.status,
    telnyxAssistantId: built.agent.telnyxAssistantId,
    version: built.version.version,
  });

  await persistMctbLineInboundConfig({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phone.id,
    patch: { voiceAgentId: AGENT_ID },
  });

  const modeResult = await setInboundHandlingMode({
    workspaceId: WORKSPACE_ID,
    mode: "VOICE_AGENT",
    phoneNumberId: phone.id,
    voiceAgentId: AGENT_ID,
  });
  if (!modeResult.ok) {
    throw new Error(
      `Could not switch to VOICE_AGENT: ${modeResult.error} ${(modeResult.blockingReasons || []).join(", ")}`,
    );
  }

  const readiness = await getVoiceAgentReadiness({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneNumberId: phone.id,
  });

  let liveConnectionId: string | null = null;
  if (phone.providerNumberId) {
    const pn = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
    );
    const row = (pn.data || pn) as Record<string, unknown>;
    liveConnectionId = row.connection_id ? String(row.connection_id) : null;
  }

  console.log("\n=== READY TO CALL ===");
  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_ID,
        agentName: "Amy — Harbor Drain Pros (after-hours)",
        callThisNumber: phone.e164,
        inboundHandlingMode: "VOICE_AGENT",
        telephonyPath: modeResult.telephonyPath,
        telnyxAssistantId: built.agent.telnyxAssistantId,
        telnyxConnectionId: liveConnectionId,
        readiness,
        sampleQuestions: [
          "What time do you close?",
          "What do you guys do?",
          "How much is a diagnostic visit?",
          "Do you serve Oakland?",
        ],
      },
      null,
      2,
    ),
  );
  console.log(`\nCall ${phone.e164} (same MCTB forwarding DID — voice agent should answer, not Press-1).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
