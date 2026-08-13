/**
 * Publish Harbor Home HVAC receptionist on +18663464256 with Jade @ 1.1 speed.
 * DB-only publish (no LiveKit SIP provision) — routing uses explicit dispatch metadata.
 * Usage: npx tsx scripts/publish-harbor-home-866.ts
 */
import { getPrisma } from "../src/lib/db";
import { wizardStateFromDraftConfig } from "../src/lib/receptionist-wizard/load-config";
import { advancedFromDraftConfig } from "../src/lib/receptionist-wizard/load-advanced";
import { RECEPTIONIST_ADVANCED_KEY } from "../src/lib/receptionist-wizard/advanced-types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "../src/lib/voice/receptionist/compile";
import { recompileReceptionistFromDraft } from "../src/lib/voice/receptionist/recompile";
import { updateVoiceAgentDraft } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { validateAgentForPublish, hasBlockingIssues } from "../src/lib/voice/validation";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";
import { livekitProfileFromConfig } from "../src/lib/voice/frontdesk/agent-config";
import {
  buildExplicitDispatchMetadata,
  explicitDispatchPatchForPhoneSettings,
} from "../src/lib/telephony/provisioning/dispatch-metadata";
import {
  getReceptionistElevenLabsVoice,
  normalizeWizardVoiceToElevenLabs,
} from "../src/lib/voice/elevenlabs/receptionist-voice-catalog";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = "cmsrk6b775h0m3n6o6z693i2l";
const PHONE_ID = "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = "+18663464256";
const JADE_VOICE_ID = "Bmj4Yi69e7b67di5IKVn";
const VOICE_SPEED = 1.1;
/** Expressive preset — same Jade voice, more dynamic delivery for A/B test vs balanced. */
const ELEVENLABS_STABILITY = 0.35;
const ELEVENLABS_SIMILARITY = 0.75;
const ELEVENLABS_STYLE = 0.1;

async function publishWithoutLiveKitProvision(
  workspaceId: string,
  agentId: string,
  publishedBy: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({ where: { id: agentId, workspaceId } });
  if (!agent) throw new Error("Agent not found");

  const { applyFlowToAgentDraft } = await import("../src/lib/voice/flow/apply");
  const applied = await applyFlowToAgentDraft({
    workspaceId,
    agentId,
    agentType: agent.agentType,
    draftConfig: parseVoiceAgentConfig(agent.draftConfig),
    strict: true,
  });
  const config = recompileReceptionistFromDraft(applied.config);
  const issues = validateAgentForPublish(agent.name, config, {
    requirePhone: true,
    phoneNumberId: agent.phoneNumberId,
  });
  if (hasBlockingIssues(issues)) {
    throw new Error(`Deploy validation failed: ${JSON.stringify(issues)}`);
  }

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId,
      version,
      config: config as object,
      publishedBy,
      testStatus: "skipped",
      deploymentStatus: "deployed",
      isMain: true,
    },
  });

  const updated = await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      publishedVersionId: versionRow.id,
      status: "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  await syncVoiceAgentPhoneAssignment({
    workspaceId,
    agentId,
    phoneNumberId: updated.phoneNumberId,
    exclusive: true,
  });

  return { agent: updated, version: versionRow, config };
}

async function assignPhoneDispatch(workspaceId: string, agentId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { publishedVersionId: true, draftConfig: true },
  });
  if (!agent) throw new Error("Agent not found");

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const dispatch = buildExplicitDispatchMetadata({
    workspaceId,
    agentId,
    publishedVersionId: agent.publishedVersionId,
    livekitProfile: livekitProfileFromConfig(config.advanced as Record<string, unknown>),
    toE164: PHONE_E164,
    dispatchSource: "phone_provision",
  });

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { settingsJson: true },
  });
  const settings =
    phone?.settingsJson && typeof phone.settingsJson === "object"
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};

  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      settingsJson: {
        ...settings,
        telephony: {
          ...telephony,
          ...explicitDispatchPatchForPhoneSettings(dispatch),
        },
      },
    },
  });

  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { phoneNumberId, status: "ACTIVE" },
  });

  return dispatch;
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found`);

  const state = wizardStateFromDraftConfig(agent.draftConfig, AGENT_ID, agent.name);
  const voiceId = normalizeWizardVoiceToElevenLabs(JADE_VOICE_ID);
  state.voiceId = voiceId;
  state.voiceLabel = getReceptionistElevenLabsVoice(voiceId)?.label || "Jade";
  state.voiceSpeed = VOICE_SPEED;
  state.elevenLabsStability = ELEVENLABS_STABILITY;
  state.elevenLabsClarity = ELEVENLABS_SIMILARITY;
  state.elevenLabsStyle = ELEVENLABS_STYLE;
  state.elevenLabsSpeakerBoost = false;

  const advanced = advancedFromDraftConfig(agent.draftConfig, state.capabilities);
  const prev = parseVoiceAgentConfig(agent.draftConfig);

  const snapshot = compileReceptionistConfig({
    agentName: state.agentName,
    businessName: state.businessName,
    businessDescription: state.businessDescription,
    greeting: state.greeting,
    language: state.language,
    timezone: state.timezone,
    answerTiming: state.answerTiming,
    capabilities: state.capabilities,
    collectFields: state.collectFields,
    voiceId,
    voiceLabel: state.voiceLabel,
    advanced: {
      [RECEPTIONIST_ADVANCED_KEY]: advanced,
      receptionistWizard: state,
    },
  });

  const merged = applyCompiledToVoiceConfig(prev, snapshot);
  const draftConfig = {
    ...merged,
    voiceLanguage: {
      ...(merged.voiceLanguage || {}),
      speed: VOICE_SPEED,
      elevenLabsTuning: true,
      elevenLabsStability: ELEVENLABS_STABILITY,
      elevenLabsSimilarityBoost: ELEVENLABS_SIMILARITY,
      elevenLabsStyle: ELEVENLABS_STYLE,
      elevenLabsSpeakerBoost: false,
    },
    advanced: {
      ...(merged.advanced as object),
      receptionistWizard: state,
      [RECEPTIONIST_ADVANCED_KEY]: advanced,
      realtimeVoice: voiceId,
      elevenLabsVoiceId: voiceId,
      realtimeOutputMode: "elevenlabs",
    },
  };

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, {
    phoneNumberId: PHONE_ID,
    draftConfig,
  });

  const published = await publishWithoutLiveKitProvision(
    WORKSPACE_ID,
    AGENT_ID,
    "publish-harbor-home-866",
  );
  const dispatch = await assignPhoneDispatch(WORKSPACE_ID, AGENT_ID, PHONE_ID);

  const joins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: PHONE_ID, inboundEnabled: true },
    select: { agentId: true },
  });

  const cfg = published.config;
  const adv = (cfg.advanced as Record<string, unknown>) || {};
  const compiled = (adv.receptionistCompiled as Record<string, unknown>) || {};

  console.log(
    JSON.stringify({
      ok: true,
      agentId: AGENT_ID,
      agentName: published.agent.name,
      phoneE164: PHONE_E164,
      voiceId,
      voiceLabel: state.voiceLabel,
      voiceSpeed: VOICE_SPEED,
      elevenLabsStability: ELEVENLABS_STABILITY,
      elevenLabsSimilarityBoost: ELEVENLABS_SIMILARITY,
      elevenLabsStyle: ELEVENLABS_STYLE,
      elevenLabsSpeakerBoost: false,
      voiceLanguageSpeed: cfg.voiceLanguage?.speed,
      compiledVoiceSpeed: compiled.voiceSpeed,
      publishedVersionId: published.version.id,
      explicitDispatch: dispatch,
      inboundJoins: joins.map((j) => j.agentId),
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
