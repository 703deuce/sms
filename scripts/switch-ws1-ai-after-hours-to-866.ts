/**
 * Move ws_1 AI After Hours inbound from +15714073615 → +18663464256 (866 toll-free).
 *
 * DEPRECATED for MCTB cert: 866 is locked to MCTB TeXML ingress. Use
 * scripts/decommission-866-competing-routes.ts instead.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-ws1-ai-after-hours-to-866.ts
 */
import { getPrisma } from "../src/lib/db";
import { mergePhoneCapabilitySettings } from "../src/lib/numbers/phone-capabilities";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60"; // Main Office Appointment Receptionist
const PHONE_866_ID =
  process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_866_E164 = process.env.PHONE_866_E164 || "+18663464256";
const PHONE_571_ID =
  process.env.PHONE_571_ID || "cmsgtjms84g6l2h0o255w1e3v";
const PHONE_571_E164 = process.env.PHONE_571_E164 || "+15714073615";

async function main() {
  const prisma = getPrisma();

  const phone866 = await prisma.phoneNumber.findFirst({ where: { id: PHONE_866_ID } });
  const phone571 = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_571_ID, workspaceId: WORKSPACE_ID },
  });
  if (!phone866?.e164) throw new Error(`866 phone ${PHONE_866_ID} not found`);
  if (!phone571?.e164) throw new Error(`571 phone ${PHONE_571_ID} not on ${WORKSPACE_ID}`);

  console.log("Before:");
  console.log(`  866: ${phone866.e164} ws=${phone866.workspaceId}`);
  console.log(`  571: ${phone571.e164} ws=${phone571.workspaceId}`);

  if (phone866.workspaceId !== WORKSPACE_ID) {
    await prisma.phoneNumber.update({
      where: { id: phone866.id },
      data: { workspaceId: WORKSPACE_ID },
    });
    console.log(`Moved ${phone866.e164} to workspace ${WORKSPACE_ID}`);
  }

  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { phoneNumberId: phone866.id },
  });
  console.log("Cleared prior 866 voice_agent_phone_numbers joins");

  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: phone571.id, agentId: AGENT_ID },
  });
  await prisma.voiceAgent.updateMany({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID, phoneNumberId: phone571.id },
    data: { phoneNumberId: null },
  });

  const telephony571 =
    phone571.settingsJson &&
    typeof phone571.settingsJson === "object" &&
    (phone571.settingsJson as Record<string, unknown>).telephony &&
    typeof (phone571.settingsJson as Record<string, unknown>).telephony === "object"
      ? { ...((phone571.settingsJson as Record<string, unknown>).telephony as Record<string, unknown>) }
      : {};

  const next571Settings = mergePhoneCapabilitySettings(phone571.settingsJson, {
    smsEnabled: true,
    voiceEnabled: true,
    aiAfterHoursEnabled: false,
    mctbEnabled: true,
  });
  const telephonyNext =
    next571Settings.telephony && typeof next571Settings.telephony === "object"
      ? { ...(next571Settings.telephony as Record<string, unknown>) }
      : { ...telephony571 };
  delete telephonyNext.explicitDispatch;
  delete telephonyNext.livekitDidDispatchRuleId;
  if (telephonyNext.routingMode === "livekit_sip") {
    delete telephonyNext.routingMode;
  }
  next571Settings.telephony = telephonyNext;

  await prisma.phoneNumber.update({
    where: { id: phone571.id },
    data: { settingsJson: next571Settings },
  });
  console.log(`Removed AI After Hours from ${phone571.e164} (MCTB retained)`);

  await syncVoiceAgentPhoneAssignment({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneNumberId: phone866.id,
    exclusive: true,
  });
  console.log(`Staged agent ${AGENT_ID} → ${phone866.e164}; running full LiveKit setup...`);

  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/setup-ws1-ai-after-hours-callable.ts"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
        WORKSPACE_ID,
        PHONE_NUMBER_ID: phone866.id,
        PHONE_E164: phone866.e164,
        AGENT_ID,
        PUBLISHED_BY: "switch_ws1_ai_to_866",
      },
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
