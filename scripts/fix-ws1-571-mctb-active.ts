/**
 * Fix ws_1 MCTB after bad phoneNumberId save — point at 571 and reassert TeXML.
 */
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig, loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { ensureDefaultTelnyxMctbAndSmsProvision } from "../src/lib/mctb/provisioning/dual-channel-repair";
import { syncVoiceAgentPhoneAssignment } from "../src/lib/voice/agent-phone";

const WS = "ws_1";
const PHONE_571_ID = "cmsgtjms84g6l2h0o255w1e3v";
const E164_571 = "+15714073615";

async function main() {
  const prisma = getPrisma();
  const before = await loadMissedCallTextConfig(WS);
  console.log("Before:", {
    phoneNumberId: before.phoneNumberId,
    smsPhoneNumberId: before.smsPhoneNumberId,
  });

  const phone571 = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_571_ID, workspaceId: WS },
  });
  if (!phone571?.e164) {
    throw new Error("571 phone row missing");
  }

  // Detach inbound AI agents from 571 so MCTB TeXML owns the DID.
  const joins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { phoneNumberId: PHONE_571_ID, inboundEnabled: true },
    select: { agentId: true },
  });
  for (const join of joins) {
    await syncVoiceAgentPhoneAssignment({
      workspaceId: WS,
      agentId: join.agentId,
      phoneNumberId: null,
    });
    await prisma.voiceAgent.updateMany({
      where: { id: join.agentId, workspaceId: WS, phoneNumberId: PHONE_571_ID },
      data: { phoneNumberId: null },
    });
    console.log("Detached agent", join.agentId, "from 571");
  }

  await updateMissedCallTextConfig({
    workspaceId: WS,
    patch: {
      enabled: true,
      phone_number_id: PHONE_571_ID,
      sms_phone_number_id: PHONE_571_ID,
    },
    source: "fix_ws1_571_mctb",
  });

  const provision = await ensureDefaultTelnyxMctbAndSmsProvision({
    workspaceId: WS,
    phoneNumberId: PHONE_571_ID,
  });

  const after = await loadMissedCallTextConfig(WS);
  console.log("After:", {
    phoneNumberId: after.phoneNumberId,
    smsPhoneNumberId: after.smsPhoneNumberId,
    provision,
    e164: E164_571,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
