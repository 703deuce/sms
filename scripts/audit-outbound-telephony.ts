/**
 * Pre-flight audit for LiveKit + Telnyx outbound telephony.
 * Run: npx tsx scripts/audit-outbound-telephony.ts
 */
import dotenv from "dotenv";
import { getPrisma } from "../src/lib/db";
import { requireLiveKitEnv } from "../src/lib/voice/runtime-provider/config";
import {
  findOutboundTrunkByName,
  TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME,
  getStoredLiveKitOutboundTrunkId,
} from "../src/lib/telephony/provisioning/livekit/outbound-trunk";
import { findInboundTrunkByName } from "../src/lib/telephony/provisioning/livekit/trunk";
import { TRANSOVO_LIVEKIT_TRUNK_NAME } from "../src/lib/telephony/provisioning/config";
import { diagnoseTelnyxOutboundVoice } from "../src/lib/phone/telnyx-outbound-voice";

dotenv.config();

async function main() {
  const report: Record<string, unknown> = { at: new Date().toISOString(), checks: [] as unknown[] };
  const checks = report.checks as Array<Record<string, unknown>>;

  try {
    requireLiveKitEnv();
    checks.push({ name: "livekit_env", ok: true });
  } catch (e) {
    checks.push({ name: "livekit_env", ok: false, error: String(e) });
  }

  const inbound = await findInboundTrunkByName(TRANSOVO_LIVEKIT_TRUNK_NAME).catch(() => null);
  checks.push({
    name: "inbound_trunk",
    ok: Boolean(inbound?.sipTrunkId),
    trunkId: inbound?.sipTrunkId || null,
    note: "Inbound trunk must remain — not modified by outbound audit",
  });

  const outboundStored = getStoredLiveKitOutboundTrunkId();
  const outbound = await findOutboundTrunkByName(TRANSOVO_LIVEKIT_OUTBOUND_TRUNK_NAME).catch(() => null);
  checks.push({
    name: "outbound_trunk",
    ok: Boolean(outbound?.sipTrunkId || outboundStored),
    trunkId: outbound?.sipTrunkId || outboundStored,
    hasTelnyxCreds: Boolean(
      process.env.TELNYX_SIP_OUTBOUND_USERNAME && process.env.TELNYX_SIP_OUTBOUND_PASSWORD,
    ),
  });

  const ovp = await diagnoseTelnyxOutboundVoice({}).catch((e) => ({
    ready: false,
    issues: [{ code: "audit_error", severity: "error", message: String(e) }],
  }));
  checks.push({ name: "telnyx_outbound_voice_profile", ...ovp });

  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { status: { in: ["ACTIVE", "TESTING", "DRAFT"] } },
    select: { id: true, name: true, draftConfig: true, phoneNumberId: true },
    take: 20,
  });
  const outboundAgents = agents.filter((a) => {
    const cfg = a.draftConfig as { advanced?: { livekitProfile?: string } } | null;
    return cfg?.advanced?.livekitProfile === "outbound_lead_qualification";
  });
  checks.push({
    name: "outbound_qualification_agents",
    count: outboundAgents.length,
    agents: outboundAgents.map((a) => ({ id: a.id, name: a.name })),
  });

  const allOk = checks.every((c) => c.ok !== false || c.name === "outbound_qualification_agents");
  console.log(JSON.stringify(report, null, 2));
  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
