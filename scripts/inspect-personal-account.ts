import dotenv from "dotenv";

dotenv.config();

import { getPrisma } from "../src/lib/db";
import { getLiveParentClient } from "../src/lib/messaging/twilio-client";
import { assertLiveTwilioConfigured } from "../src/lib/messaging/twilio-config";
import { listTelnyxOwnedNumbers } from "../src/lib/voice/telnyx/number-import";

async function main() {
  const prisma = getPrisma();
  const email = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { workspace: true } } },
  });
  if (!user) {
    console.log("user not found");
    return;
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
  });
  console.log("memberships:");
  for (const m of memberships) {
    const nums = await prisma.phoneNumber.findMany({
      where: { workspaceId: m.workspaceId },
      select: {
        id: true,
        e164: true,
        provider: true,
        twilioSid: true,
        providerNumberId: true,
        settingsJson: true,
      },
    });
    console.log(`  ${m.workspace.name} (${m.workspace.type}) ${m.workspaceId}`);
    for (const n of nums) {
      const settings = n.settingsJson as Record<string, unknown> | null;
      console.log(
        `    ${n.e164} provider=${n.provider} id=${n.id} parked=${settings?.parked ?? settings?.personalParked}`,
      );
    }
  }

  const telnyx = await listTelnyxOwnedNumbers();
  console.log("\nTelnyx account numbers:", telnyx.length);
  telnyx.slice(0, 15).forEach((n) => console.log(`  ${n.e164} id=${n.id}`));

  try {
    assertLiveTwilioConfigured();
    const client = getLiveParentClient();
    const parent = await client.api.accounts.list({ limit: 1 });
    console.log("\nTwilio parent account:", parent[0]?.sid);

    const incoming = await client.incomingPhoneNumbers.list({ limit: 30 });
    console.log("Twilio parent incoming numbers:", incoming.length);
    incoming.forEach((n) =>
      console.log(`  ${n.phoneNumber} sid=${n.sid} friendly=${n.friendlyName}`),
    );
  } catch (e) {
    console.log("Twilio list failed:", e instanceof Error ? e.message : e);
  }
}

main().catch(console.error);
