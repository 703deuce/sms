/**
 * Create or upgrade the inbound frontdesk booking agent to OpenAI Realtime.
 *
 * Usage:
 *   npx tsx scripts/setup-frontdesk-booking-agent-realtime.ts
 *   PHONE_E164=+18663464256 npx tsx scripts/setup-frontdesk-booking-agent-realtime.ts
 */
import dotenv from "dotenv";
import { getPrisma } from "@/lib/db";
import { assignNumberToAgent } from "@/lib/telephony/provisioning";
import { ensureFrontDeskRealtimeAgent } from "@/lib/voice/frontdesk/ensure-realtime-agent";
import { FRONTDESK_REALTIME_PROFILE } from "@/lib/voice/frontdesk/agent-config";

dotenv.config();

const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: PHONE_E164 },
    select: { id: true, workspaceId: true, e164: true },
  });
  if (!phone) {
    throw new Error(`Phone number ${PHONE_E164} not found in database`);
  }

  const result = await ensureFrontDeskRealtimeAgent({ workspaceId: phone.workspaceId });

  const assign = await assignNumberToAgent({
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    agentId: result.agentId,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        phoneE164: phone.e164,
        livekitProfile: FRONTDESK_REALTIME_PROFILE,
        assign,
        env: {
          model: process.env.VOICE_REALTIME_MODEL?.trim() || result.realtimeModel,
          voice: process.env.VOICE_REALTIME_VOICE?.trim() || result.realtimeVoice,
          vadMode: process.env.VOICE_REALTIME_VAD_MODE?.trim() || "semantic",
          vadEagerness: process.env.VOICE_REALTIME_VAD_EAGERNESS?.trim() || "high",
          outputMode: process.env.VOICE_REALTIME_OUTPUT_MODE?.trim() || "native",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
