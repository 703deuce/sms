/**
 * Switch Amy on +18663464256 to gpt-realtime-2.1-mini (DB-only republish).
 * Skips LiveKit reprovision — routing on 866 is already correct.
 *
 *   npx tsx scripts/switch-866-realtime-mini.ts
 */
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { recompileReceptionistFromDraft } from "../src/lib/voice/receptionist/recompile";
import { validateAgentForPublish, hasBlockingIssues } from "../src/lib/voice/validation";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = "+18663464256";
const TARGET_MODEL = "gpt-realtime-2.1-mini";

async function main() {
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: PHONE_E164 },
    select: { id: true, workspaceId: true },
  });
  if (!phone) throw new Error(`Phone ${PHONE_E164} not found`);

  const agent = await prisma.voiceAgent.findFirst({
    where: { phoneNumberId: phone.id, workspaceId: phone.workspaceId },
  });
  if (!agent) throw new Error(`No voice agent on ${PHONE_E164}`);

  console.log(`Agent: ${agent.name} (${agent.id}) status=${agent.status}`);

  const { applyFlowToAgentDraft } = await import("../src/lib/voice/flow/apply");
  const applied = await applyFlowToAgentDraft({
    workspaceId: WORKSPACE_ID,
    agentId: agent.id,
    agentType: agent.agentType,
    draftConfig: parseVoiceAgentConfig(agent.draftConfig),
    strict: true,
  });
  const config = recompileReceptionistFromDraft(applied.config);

  const compiled = (config.advanced as Record<string, unknown> | undefined)
    ?.receptionistCompiled as Record<string, unknown> | undefined;
  if (compiled?.realtimeModel !== TARGET_MODEL) {
    throw new Error(
      `Recompile did not produce ${TARGET_MODEL}: got ${compiled?.realtimeModel}`,
    );
  }

  const issues = validateAgentForPublish(agent.name, config, {
    requirePhone: true,
    phoneNumberId: agent.phoneNumberId,
  });
  if (hasBlockingIssues(issues)) {
    throw new Error(`Deploy validation failed: ${JSON.stringify(issues)}`);
  }

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: agent.id },
    orderBy: { version: "desc" },
  });

  let versionRow = lastVersion;
  const lastCfg = lastVersion ? parseVoiceAgentConfig(lastVersion.config) : null;
  const lastCompiled = (lastCfg?.advanced as Record<string, unknown> | undefined)
    ?.receptionistCompiled as Record<string, unknown> | undefined;
  const lastModel = lastCompiled?.realtimeModel;

  if (lastModel === TARGET_MODEL && lastVersion) {
    console.log(`Reusing version ${lastVersion.version} (${lastVersion.id}) — already mini`);
    versionRow = lastVersion;
  } else {
    const version = (lastVersion?.version ?? 0) + 1;
    versionRow = await prisma.voiceAgentVersion.create({
      data: {
        workspaceId: WORKSPACE_ID,
        agentId: agent.id,
        version,
        config: config as object,
        publishedBy: "switch-866-realtime-mini",
        testStatus: "skipped",
        deploymentStatus: "deployed",
        isMain: true,
      },
    });
    console.log(`Created version ${version} (${versionRow.id})`);
  }

  const updated = await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: {
      draftConfig: config as object,
      publishedVersionId: versionRow!.id,
      status: "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: agent.id,
    phoneNumberId: updated.phoneNumberId,
    exclusive: true,
  });

  const publishedCfg = parseVoiceAgentConfig(versionRow!.config);
  const afterCompiled = (publishedCfg.advanced as Record<string, unknown> | undefined)
    ?.receptionistCompiled as Record<string, unknown> | undefined;

  console.log({
    status: updated.status,
    publishedVersion: versionRow!.version,
    publishedVersionId: updated.publishedVersionId,
    realtimeModel: afterCompiled?.realtimeModel,
  });

  if (afterCompiled?.realtimeModel !== TARGET_MODEL) {
    throw new Error(`Expected ${TARGET_MODEL}, got ${afterCompiled?.realtimeModel}`);
  }

  console.log("OK — +18663464256 ACTIVE on gpt-realtime-2.1-mini");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
