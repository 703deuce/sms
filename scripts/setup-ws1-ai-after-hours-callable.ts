/**
 * Wire ws_1 AI After Hours for PSTN: assign ACTIVE agent to +18663464256 (866 toll-free),
 * provision LiveKit Cloud SIP route, republish dispatch snapshot.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/setup-ws1-ai-after-hours-callable.ts
 */
import { getPrisma } from "../src/lib/db";
import { mergePhoneCapabilitySettings } from "../src/lib/numbers/phone-capabilities";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";
import { ensureNumberProvisioned, verifyNumberRouting } from "../src/lib/telephony/provisioning";
import { resolveAgentByCalledNumber } from "../src/lib/telephony/provisioning/agent-routing";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { loadExplicitDispatchForDid } from "../src/lib/telephony/provisioning/dispatch-metadata";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60"; // Main Office Appointment Receptionist
const PUBLISHED_BY = process.env.PUBLISHED_BY || "ai_after_hours_setup";

async function main() {
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_NUMBER_ID, workspaceId: WORKSPACE_ID },
  });
  if (!phone?.e164) {
    throw new Error(`Phone ${PHONE_NUMBER_ID} not found on ${WORKSPACE_ID}`);
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found`);

  console.log(`Phone: ${phone.e164} (${phone.id})`);
  console.log(`Agent: ${agent.name} (${agent.id}) status=${agent.status}`);

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = { ...(config.advanced as Record<string, unknown>) };
  const wizard = {
    ...((advanced.receptionistWizard as Record<string, unknown>) || {}),
    answerTiming: "always",
    phoneNumberId: phone.id,
    phoneNumberE164: phone.e164,
  };
  advanced.receptionistWizard = wizard;
  if (!advanced.livekitAgentTemplate) {
    advanced.livekitAgentTemplate = "transovo_receptionist_v1";
  }

  const nextConfig = {
    ...config,
    advanced,
    callHandling: {
      ...(config.callHandling || {}),
      greeting:
        config.callHandling?.greeting ||
        "Hi, thanks for calling. This is your after-hours assistant. How can I help you?",
      ringSeconds: 0,
    },
  };

  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: {
      phoneNumberId: phone.id,
      draftConfig: nextConfig as object,
      directions: ["inbound"],
    },
  });
  console.log("Updated agent draft (always answer, phone assigned)");

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      settingsJson: mergePhoneCapabilitySettings(phone.settingsJson, {
        smsEnabled: true,
        voiceEnabled: true,
        aiAfterHoursEnabled: true,
        mctbEnabled: true,
      }),
    },
  });
  console.log("Stamped phone capability flags (sms + voice + ai + mctb)");

  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: agent.id,
    phoneNumberId: phone.id,
    exclusive: true,
  });
  console.log("Synced voice agent phone join table");

  console.log("Publishing agent (LiveKit provision + dispatch snapshot)...");
  const published = await publishVoiceAgent(WORKSPACE_ID, agent.id, PUBLISHED_BY);
  console.log(`Published version v${published.version.version}`);

  const provision = await ensureNumberProvisioned({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phone.id,
    agentId: agent.id,
    routingMode: "livekit_sip",
    publishedVersionId: published.version.id,
    publishedConfig: parseVoiceAgentConfig(published.version.config),
  });
  console.log("ensureNumberProvisioned:", {
    ok: provision.ok,
    actions: provision.actions,
    error: provision.error,
  });

  const routing = await resolveAgentByCalledNumber(phone.e164);
  const verify = await verifyNumberRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phone.id,
  });
  const didDispatch = await loadExplicitDispatchForDid(phone.e164);

  console.log("\n=== READY TO CALL ===");
  console.log(`Call: ${phone.e164}`);
  console.log(`Agent: ${agent.name} (${agent.id})`);
  console.log(`resolveAgentByCalledNumber:`, routing);
  console.log(`verifyNumberRouting ok=${verify.ok} issues=${verify.issues.join(",") || "none"}`);
  console.log(`explicitDispatch agentId=${didDispatch?.agentId || "missing"}`);

  if (!routing) {
    throw new Error("Inbound agent resolution still null after setup");
  }
  if (!provision.ok) {
    throw new Error(provision.error || "LiveKit provisioning failed");
  }
  if (verify.issues.length > 0) {
    console.warn("Routing verify issues (call may still work):", verify.issues);
  }

  console.log("\nManual: place a PSTN call to", phone.e164);
  console.log("Expect: LiveKit worker picks up, workspace ws_1, agent Tom/Main Office");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
