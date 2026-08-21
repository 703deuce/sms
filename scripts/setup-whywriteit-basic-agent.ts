/**
 * One-shot: ensure target account has voice workspace, a phone number,
 * and a receptionist ready to call.
 *
 * Usage: TARGET_EMAIL=you@example.com AGENT_TEMPLATE=livekit_basic_voice npx tsx scripts/setup-whywriteit-basic-agent.ts
 */
import { getPrisma } from "@/lib/db";
import { createDefaultWizardState } from "@/lib/receptionist-wizard/defaults";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "@/lib/voice/receptionist/compile";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeAgentTemplateId } from "@/lib/voice/templates/agent-template-config";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import { publishVoiceAgent } from "@/lib/voice/agent-service";

const EMAIL = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
const TEMPLATE = normalizeAgentTemplateId(
  process.env.AGENT_TEMPLATE || "livekit_basic_voice",
);
const AGENT_LABEL = (process.env.AGENT_LABEL || "Basic Voice Test").trim();
const PREFERRED_E164 = (process.env.PREFERRED_E164 || "+15714073615").trim();

async function main() {
  const prisma = getPrisma();
  if (!EMAIL) throw new Error("Set TARGET_EMAIL");
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`User not found: ${EMAIL || "(set TARGET_EMAIL)"}`);

  console.log(`User: ${user.email} (${user.id})`);

  const ownedWorkspaces = await prisma.workspace.findMany({
    where: { ownerUserId: user.id },
    select: { id: true, name: true, type: true },
  });

  let numbersWorkspace: { id: string; name: string; type: string } | null = null;
  let numbers: Array<{
    id: string;
    e164: string;
    label: string | null;
    status: string;
    provider: string | null;
  }> = [];

  for (const ws of ownedWorkspaces) {
    const rows = await prisma.phoneNumber.findMany({
      where: { workspaceId: ws.id },
      select: { id: true, e164: true, label: true, status: true, provider: true },
    });
    if (rows.length) {
      numbersWorkspace = ws;
      numbers = rows;
      break;
    }
  }

  if (!numbersWorkspace || !numbers.length) {
    throw new Error("No phone numbers on account — assign or transfer a number first.");
  }

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: numbersWorkspace.id },
  });
  if (!membership) {
    membership = await prisma.membership.create({
      data: { userId: user.id, workspaceId: numbersWorkspace.id, role: "OWNER" },
    });
    console.log(`Linked membership to numbers workspace ${numbersWorkspace.id}`);
  }

  const workspaceId = numbersWorkspace.id;
  await grantProductEntitlement(workspaceId, "voice", "active");
  await grantProductEntitlement(workspaceId, "numbers", "active");
  console.log(`Voice workspace: ${workspaceId} (${numbersWorkspace.type})`);
  console.log(`Numbers in workspace: ${numbers.length}`);
  for (const n of numbers) console.log(`  ${n.e164} id=${n.id} provider=${n.provider}`);

  const phone =
    numbers.find((n) => n.e164 === PREFERRED_E164) ??
    numbers.find((n) => n.provider === "telnyx") ??
    numbers[0]!;
  const agentDisplayName = `Amy — ${AGENT_LABEL} (${TEMPLATE})`;
  let agent = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId,
      name: agentDisplayName,
    },
  });

  if (!agent) {
    const state = createDefaultWizardState();
    state.businessName = "Transovo Test Business";
    state.agentName = "Amy";
    state.livekitAgentTemplate = TEMPLATE;
    state.phoneNumberId = phone.id;
    state.phoneNumberE164 = phone.e164;

    const snapshot = compileReceptionistConfig({
      agentName: state.agentName,
      businessName: state.businessName,
      businessDescription: state.businessDescription,
      agentJobInstructions: state.agentJobInstructions,
      agentPersonalityNotes: state.agentPersonalityNotes,
      industry: state.industry,
      additionalInstructions: state.additionalInstructions,
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
    const draftConfig = applyCompiledToVoiceConfig(parseVoiceAgentConfig(null), snapshot, {
      receptionistWizard: state,
      livekitAgentTemplate: TEMPLATE,
    });

    agent = await prisma.voiceAgent.create({
      data: {
        workspaceId,
        name: agentDisplayName,
        description: "Phase A PSTN test agent",
        agentType: "receptionist",
        status: "DRAFT",
        phoneNumberId: phone.id,
        directions: ["inbound"],
        draftConfig: draftConfig as object,
        displayName: state.agentName,
      },
    });
    console.log(`Created agent ${agent.id}`);
  } else {
    console.log(`Reusing agent ${agent.id}`);
    const prev = parseVoiceAgentConfig(agent.draftConfig);
    const state = createDefaultWizardState();
    state.businessName = "Transovo Test Business";
    state.agentName = "Amy";
    state.livekitAgentTemplate = TEMPLATE;
    state.phoneNumberId = phone.id;
    state.phoneNumberE164 = phone.e164;
    state.capabilities = ["answer_questions", "book_appointments"];
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
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: { phoneNumberId: phone.id, draftConfig: draftConfig as object },
    });
    console.log(`Updated agent draft with template=${TEMPLATE}`);
  }

  try {
    const published = await publishVoiceAgent(workspaceId, agent.id, user.id);
    console.log(`Published agent ${published.agent.id} status=${published.agent.status}`);
  } catch (err) {
    console.error("Publish failed:", err instanceof Error ? err.message : err);
    console.log(`Agent draft ready at /voice/agents/${agent.id}/voice-test`);
    console.log(`Call number: ${phone.e164}`);
    process.exit(1);
  }

  console.log("\n=== READY TO CALL ===");
  console.log(`Account: ${EMAIL}`);
  console.log(`Template: ${TEMPLATE}`);
  console.log(`Phone: ${phone.e164}`);
  console.log(`Agent: ${agent.id}`);
  const appBase = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (appBase) {
    console.log(`Editor: ${appBase}/voice/agents/${agent.id}/voice-test`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
