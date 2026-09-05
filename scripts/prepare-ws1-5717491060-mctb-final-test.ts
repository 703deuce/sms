/**
 * Lock ws_1 new 571 (+15717491060) on frozen MCTB TeXML pipeline (mctb_texml_final_v1).
 *
 * Same frozen cert path as 866 press_1 test:
 *   cert=C3 → mctb-entry → Gather + Play consent audio → press 1 → SMS
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/prepare-ws1-5717491060-mctb-final-test.ts
 */
import { execSync } from "node:child_process";
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { switchDidToMctbTexmlIngress } from "../src/lib/mctb/texml-ingress/provision";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import {
  warmMctbInboundRoutingProfileForE164,
  peekMctbInboundRoutingProfileByE164,
} from "../src/lib/mctb/texml-ingress/routing-profile";
import { warmMctbTexmlIngressCache } from "../src/lib/mctb/texml-ingress/config-cache";
import { mctbEntryVoiceUrlWithCert } from "../src/lib/mctb/texml-ingress/cert-mode";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { isPhoneAuthorizedForOutboundSms } from "../src/lib/mctb/messaging/outbound-sms-route";

const WS = process.env.WORKSPACE_ID || "ws_1";
const PHONE_ID = process.env.PHONE_NUMBER_ID || "cmtokonyy57004g58242i4c2o";
const E164 = process.env.PHONE_E164 || "+15717491060";
const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || MCTB_TEXML_DEFAULT_APP_ID;
const CERT = "C3";

const nodeOpts = "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs'";

function run(cmd: string) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

async function main() {
  run(`${nodeOpts} npx tsx scripts/disable-ws1-mctb-cooldown.ts`);
  run(`${nodeOpts} npx tsx scripts/mctb-set-workspace-consent-mode.ts --workspace-id ${WS} --mode press_1`);

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WS },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error(`Phone ${PHONE_ID} not found or missing providerNumberId`);
  }

  const switchResult = await switchDidToMctbTexmlIngress({
    workspaceId: WS,
    phoneNumberId: phone.id,
    preferredTexmlAppId: TEXML_APP_ID,
    mctbRole: "customer_mctb",
  });

  await updateMissedCallTextConfig({
    workspaceId: WS,
    patch: {
      enabled: true,
      phone_number_id: phone.id,
      sms_phone_number_id: phone.id,
    },
    source: "prepare_ws1_5717491060_frozen_test",
  });

  const baseEntry = getTelnyxWebhookUrls().mctbEntry;
  const voiceUrl = mctbEntryVoiceUrlWithCert(baseEntry, CERT);
  const pre = await preflightTexmlVoiceUrl(voiceUrl);
  if (!pre.ok) {
    throw new Error(`Preflight failed for frozen cert ${CERT}: ${pre.error}`);
  }

  await telnyxRequest(`/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`, {
    method: "PATCH",
    body: {
      voice_url: voiceUrl,
      voice_method: "POST",
      active: true,
    },
  });

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: TEXML_APP_ID },
  });

  await warmMctbTexmlIngressCache(E164);
  await warmMctbInboundRoutingProfileForE164(E164);

  const entryRes = await fetch(voiceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164,
      CallSid: `frozen-cert-${Date.now()}`,
    }),
  });
  const entryXml = await entryRes.text();

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = listed.data?.[0];
  const smsAuth = await isPhoneAuthorizedForOutboundSms(phone.id);
  const profile = peekMctbInboundRoutingProfileByE164(E164);

  const card = {
    ok:
      switchResult.ok &&
      switchResult.verify.ok &&
      entryRes.ok &&
      entryXml.includes("Gather") &&
      pn?.connection_id === TEXML_APP_ID,
    frozenPipeline: "mctb_texml_final_v1",
    cert: CERT,
    voiceUrl,
    testDid: E164,
    phoneNumberId: phone.id,
    voiceIngress: {
      telnyxConnectionId: pn?.connection_id,
      telnyxConnectionName: pn?.connection_name,
      onMctbTexmlApp: pn?.connection_id === TEXML_APP_ID,
    },
    notLiveKit: pn?.connection_name !== "LiveKit SIP",
    consentMode: "press_1",
    smsOutbound: smsAuth,
    warmedProfile: profile
      ? {
          routingToken: profile.routingToken,
          consentMode: profile.consentMode,
          press1PlayUrl: profile.press1PlayUrl,
        }
      : null,
    entryProbe: {
      status: entryRes.status,
      hasGather: entryXml.includes("Gather"),
      hasPlay: entryXml.includes("Play"),
      preview: entryXml.slice(0, 220),
    },
    liveTest: {
      attForward: `*61*5717491060*10#`,
      expected: "CFNA → 571-749-1060 → press-1 consent audio → press 1 → SMS from same 571",
    },
  };

  console.log("\n" + JSON.stringify(card, null, 2));
  if (!card.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
