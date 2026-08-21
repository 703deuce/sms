/**
 * Repair booking agent: persist livekit_frontdesk_booking and republish.
 *
 * Usage:
 *   TARGET_EMAIL=you@example.com AGENT_ID=... PREFERRED_E164=+1... npx tsx scripts/fix-whywriteit-booking-agent.ts
 */
import { getPrisma } from "../src/lib/db";
import { createDefaultWizardState } from "../src/lib/receptionist-wizard/defaults";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "../src/lib/voice/receptionist/compile";
import { recompileReceptionistFromDraft } from "../src/lib/voice/receptionist/recompile";
import {
  getLiveKitAgentTemplateFromAdvanced,
  normalizeAgentTemplateId,
} from "../src/lib/voice/templates/agent-template-config";
import { publishVoiceAgent, updateVoiceAgentDraft } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

const EMAIL = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
const AGENT_ID = (process.env.AGENT_ID || "cmt33t45w6s5i213o34702e2r").trim();
const TEMPLATE = normalizeAgentTemplateId(
  process.env.AGENT_TEMPLATE || "livekit_frontdesk_booking",
);
const PREFERRED_E164 = (process.env.PREFERRED_E164 || "+18663464256").trim();

async function main() {
  const prisma = getPrisma();
  if (!EMAIL) throw new Error("Set TARGET_EMAIL");
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`User not found: ${EMAIL}`);

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID },
    include: { phoneNumber: true, workspace: true },
  });
  if (!agent) throw new Error(`Agent not found: ${AGENT_ID}`);
  if (agent.workspace.ownerUserId !== user.id) {
    throw new Error(`Agent ${AGENT_ID} is not owned by ${EMAIL}`);
  }

  const phone =
    agent.phoneNumber?.e164 === PREFERRED_E164
      ? agent.phoneNumber
      : await prisma.phoneNumber.findFirst({
          where: { workspaceId: agent.workspaceId, e164: PREFERRED_E164 },
        });
  if (!phone) throw new Error(`Phone not found: ${PREFERRED_E164}`);

  const state = createDefaultWizardState();
  state.businessName = "Transovo Test Business";
  state.agentName = "Amy";
  state.livekitAgentTemplate = TEMPLATE;
  state.phoneNumberId = phone.id;
  state.phoneNumberE164 = phone.e164;
  state.capabilities = ["answer_questions", "book_appointments"];
  state.greeting = "Hi, thanks for calling. I can help you book an appointment — what day works for you?";

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
    voiceId: state.voiceId,
    advanced: {
      receptionistWizard: state,
      livekitAgentTemplate: TEMPLATE,
    },
  });
  const draftConfig = applyCompiledToVoiceConfig(prev, snapshot, {
    receptionistWizard: state,
    livekitAgentTemplate: TEMPLATE,
  });

  await updateVoiceAgentDraft(agent.workspaceId, agent.id, {
    phoneNumberId: phone.id,
    draftConfig,
  });

  const republished = await publishVoiceAgent(agent.workspaceId, agent.id, user.id);
  const publishedAdvanced = recompileReceptionistFromDraft(
    parseVoiceAgentConfig(republished.version.config),
  ).advanced as Record<string, unknown>;

  const resolved = getLiveKitAgentTemplateFromAdvanced(publishedAdvanced);
  console.log(`Agent: ${agent.id}`);
  console.log(`Phone: ${phone.e164}`);
  console.log(`Published version: ${republished.version.id}`);
  console.log(`Resolved template: ${resolved}`);
  if (resolved !== TEMPLATE) {
    throw new Error(`Expected template ${TEMPLATE}, got ${resolved}`);
  }
  console.log("\n=== BOOKING AGENT FIXED ===");
  console.log(`Call ${phone.e164} and ask to book — agent should use list_available_slots / schedule_appointment.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
