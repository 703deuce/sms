/**
 * One-shot: lock 866 on MCTB TeXML only — strip LiveKit/AI/after-hours steals.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/decommission-866-competing-routes.ts
 *
 * Optional cert stage (Telnyx voice_url only, no redeploy):
 *   CERT=C npx tsx scripts/decommission-866-competing-routes.ts
 */
import { getPrisma } from "../src/lib/db";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import { switchDidToMctbTexmlIngress } from "../src/lib/mctb/texml-ingress/provision";
import { mctbEntryVoiceUrlWithCert } from "../src/lib/mctb/texml-ingress/cert-mode";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const E164 = process.env.PHONE_E164 || "+18663464256";
const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || "3037587396909598261";
const CERT = (process.env.CERT || process.argv[2] || "C").trim();

async function clearAgentClaims(prisma: ReturnType<typeof getPrisma>) {
  const clearedJoins = await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { phoneNumberId: PHONE_866_ID },
  });

  const clearedAgents = await prisma.voiceAgent.updateMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId: PHONE_866_ID },
    data: { phoneNumberId: null },
  });

  const agentsWithLink = await prisma.voiceAgent.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, linkedPhoneNumberIds: true },
  });
  let linkedCleared = 0;
  for (const agent of agentsWithLink) {
    const ids = Array.isArray(agent.linkedPhoneNumberIds) ? agent.linkedPhoneNumberIds : [];
    if (!ids.includes(PHONE_866_ID)) continue;
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        linkedPhoneNumberIds: ids.filter((id) => id !== PHONE_866_ID),
      },
    });
    linkedCleared += 1;
  }

  return { clearedJoins: clearedJoins.count, clearedAgents: clearedAgents.count, linkedCleared };
}

async function applyCertMode() {
  const baseEntry = getTelnyxWebhookUrls().mctbEntry;
  const voiceUrl = mctbEntryVoiceUrlWithCert(baseEntry, CERT);
  const pre = await preflightTexmlVoiceUrl(voiceUrl);
  if (!pre.ok) {
    throw new Error(`Preflight failed for ${voiceUrl}: ${pre.error}`);
  }

  await telnyxRequest(`/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`, {
    method: "PATCH",
    body: {
      voice_url: voiceUrl,
      voice_method: "POST",
      active: true,
    },
  });

  return { cert: CERT, voiceUrl, preflight: pre };
}

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  if (!phone?.e164) throw new Error("866 not found");

  console.log("=== Before decommission ===");
  console.log(JSON.stringify({ e164: phone.e164, settingsJson: phone.settingsJson }, null, 2));

  const cleared = await clearAgentClaims(prisma);
  console.log("Cleared agent claims:", cleared);

  const switchResult = await switchDidToMctbTexmlIngress({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    preferredTexmlAppId: TEXML_APP_ID,
  });

  const cert = await applyCertMode();

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = listed.data?.[0];

  const after = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });

  console.log(
    JSON.stringify(
      {
        ok: switchResult.ok && switchResult.verify.ok,
        cleared,
        switch: {
          texmlAppId: switchResult.texmlRoute.texmlAppId,
          verify: switchResult.verify,
        },
        cert,
        telnyxNumber: {
          connection_id: pn?.connection_id,
          connection_name: pn?.connection_name,
        },
        dbRouting: (after?.settingsJson as Record<string, unknown>)?.telephony,
        routingOwner: (after?.settingsJson as Record<string, unknown>)?.routingOwner,
        aiAfterHoursEnabled: after?.settingsJson
          ? readPhoneCapabilities({ settingsJson: after.settingsJson }).aiAfterHoursEnabled
          : null,
      },
      null,
      2,
    ),
  );

  if (!switchResult.verify.ok) process.exit(1);
  console.log(`\nREADY — 866 locked to MCTB TeXML cert ${CERT}. Conditional-forward and press 1 to test SMS.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
