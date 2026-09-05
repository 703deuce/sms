/**
 * Purchase a fresh 571 local DID for ws_1 and wire single-number MCTB:
 * same DID for conditional-forward voice + press-1 consent + outbound SMS.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/provision-ws1-new-571-mctb.ts
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/provision-ws1-new-571-mctb.ts --apply
 */
import { randomBytes } from "crypto";
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";
import { isPhoneAuthorizedForOutboundSms } from "../src/lib/mctb/messaging/outbound-sms-route";
import { switchDidToMctbTexmlIngress } from "../src/lib/mctb/texml-ingress/provision";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import {
  peekMctbInboundRoutingProfileByE164,
  warmMctbInboundRoutingProfileForWorkspace,
} from "../src/lib/mctb/texml-ingress/routing-profile";
import { telnyxLocalA2pSettings } from "../src/lib/messaging/compliance/phone-number-class";
import { getMessagingProvider } from "../src/lib/messaging/get-provider";
import { telnyxProvider } from "../src/lib/messaging/telnyx/provider";
import { getRegistrationByWorkspace } from "../src/lib/messaging/store";
import { assignNumberToCampaignAndReady } from "../src/lib/messaging/telnyx/ten-dlc-ops";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { pollTelnyxPhoneNumberId } from "../src/lib/messaging/telnyx/phone-numbers";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AREA_CODE = process.env.AREA_CODE || "571";
const EXCLUDE_E164 = new Set(
  (process.env.EXCLUDE_E164 || "+15714073615")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

async function pickCandidate571(): Promise<string> {
  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, status: { not: "Released" } },
    select: { e164: true },
  });
  const ownedSet = new Set(owned.map((r) => r.e164));

  const results = await telnyxProvider.searchNumbers(AREA_CODE);
  const candidate = results
    .map((r) => r.phoneNumber)
    .find(
      (e164) =>
        e164?.startsWith("+1571") &&
        !ownedSet.has(e164) &&
        !EXCLUDE_E164.has(e164) &&
        !e164.includes("4073615"),
    );

  if (!candidate) {
    throw new Error(`No available ${AREA_CODE} numbers found from Telnyx search`);
  }
  return candidate;
}

async function orderNumberOnMctbTexml(input: {
  workspaceId: string;
  e164: string;
  messagingProfileId: string;
}) {
  const orderBody: Record<string, unknown> = {
    phone_numbers: [{ phone_number: input.e164 }],
    customer_reference: `ws:${input.workspaceId}:mctb-single-571`,
    connection_id: MCTB_TEXML_DEFAULT_APP_ID,
    messaging_profile_id: input.messagingProfileId,
  };

  const res = await telnyxRequest<{
    data: {
      id: string;
      phone_numbers?: Array<{ id?: string; phone_number?: string; status?: string }>;
    };
  }>("/number_orders", {
    method: "POST",
    body: orderBody,
    idempotencyKey: `mctb-571-order:${input.e164}:${randomBytes(4).toString("hex")}`,
  });

  const orderId = res.data.id;
  const purchased = res.data.phone_numbers?.[0];
  let providerNumberId =
    purchased?.id && purchased.status === "success" ? purchased.id : null;
  if (!providerNumberId) {
    providerNumberId = await pollTelnyxPhoneNumberId({
      orderId,
      phoneNumber: input.e164,
      attempts: 12,
      delayMs: 2000,
    });
  }
  if (!providerNumberId) {
    throw new Error(`Telnyx order ${orderId} accepted but phone number id not ready yet`);
  }
  return { providerNumberId, orderId };
}

async function upsertPhoneRow(input: {
  workspaceId: string;
  e164: string;
  providerNumberId: string;
}) {
  const prisma = getPrisma();
  const digits = input.e164.replace(/\D/g, "");
  const npa = digits.slice(1, 4);
  const settings = {
    ...telnyxLocalA2pSettings({ role: "customer_production", a2pApproved: false }),
    routingOwner: "mctb_texml",
    mctbRole: "customer_mctb",
    mctbSipIngress: true,
    mctbEnabled: true,
    voiceEnabled: true,
    smsEnabled: true,
    telephony: {
      routingMode: "mctb_texml",
      routingOwner: "mctb_texml",
      state: "active",
      telnyxTexmlAppId: MCTB_TEXML_DEFAULT_APP_ID,
    },
    provisioning: { state: "purchased", source: "provision-ws1-new-571-mctb" },
  };

  return prisma.phoneNumber.upsert({
    where: { workspaceId_e164: { workspaceId: input.workspaceId, e164: input.e164 } },
    create: {
      workspaceId: input.workspaceId,
      e164: input.e164,
      type: "Local",
      areaCode: npa,
      provider: "telnyx",
      providerNumberId: input.providerNumberId,
      status: "Active",
      purchasedAt: new Date(),
      a2pStatus: "PENDING",
      settingsJson: settings,
      capabilitiesJson: { voice: true, sms: true, source: "mctb_provision" },
    },
    update: {
      providerNumberId: input.providerNumberId,
      status: "Active",
      releasedAt: null,
      settingsJson: settings,
    },
  });
}

async function main() {
  const reg = await getRegistrationByWorkspace(WORKSPACE_ID);
  if (!reg?.messagingProfileId || !reg.campaignId) {
    throw new Error("ws_1 messaging registration missing approved profile/campaign");
  }

  const candidate = await pickCandidate571();
  const plan = {
    mode: apply ? "APPLY" : "DRY_RUN",
    workspaceId: WORKSPACE_ID,
    candidateE164: candidate,
    messagingProfileId: reg.messagingProfileId,
    campaignId: reg.campaignId,
    texmlAppId: MCTB_TEXML_DEFAULT_APP_ID,
    mctbConfig: "voice + SMS on same DID",
  };

  console.log(JSON.stringify(plan, null, 2));
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to purchase and wire.");
    return;
  }

  const { providerNumberId, orderId } = await orderNumberOnMctbTexml({
    workspaceId: WORKSPACE_ID,
    e164: candidate,
    messagingProfileId: reg.messagingProfileId,
  });

  const phoneRow = await upsertPhoneRow({
    workspaceId: WORKSPACE_ID,
    e164: candidate,
    providerNumberId,
  });

  const campaign = await assignNumberToCampaignAndReady({
    workspaceId: WORKSPACE_ID,
    phoneE164: candidate,
    campaignId: reg.campaignId,
    brandId: reg.brandId || reg.brandSid,
    messagingProfileId: reg.messagingProfileId,
    providerNumberId,
  });

  const switchResult = await switchDidToMctbTexmlIngress({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phoneRow.id,
    preferredTexmlAppId: MCTB_TEXML_DEFAULT_APP_ID,
    mctbRole: "customer_mctb",
  });

  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      enabled: true,
      phone_number_id: phoneRow.id,
      sms_phone_number_id: phoneRow.id,
    },
    source: "provision_ws1_new_571_mctb",
  });

  await warmMctbInboundRoutingProfileForWorkspace(WORKSPACE_ID);

  const consentMode = await loadMctbConsentMode(WORKSPACE_ID);
  const smsAuth = await isPhoneAuthorizedForOutboundSms(phoneRow.id);
  const profile = peekMctbInboundRoutingProfileByE164(candidate);

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;
  const entryRes = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: candidate,
      CallSid: `ready-${Date.now()}`,
    }),
  });
  const entryXml = await entryRes.text();

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": candidate } },
  );
  const pn = listed.data?.[0];

  const card = {
    ok: switchResult.ok && switchResult.verify.ok && campaign.ready && smsAuth.allowed,
    purchased: { e164: candidate, phoneNumberId: phoneRow.id, providerNumberId, orderId },
    testDid: candidate,
    voiceAndSmsSameNumber: true,
    messagingCampaign: {
      profileId: reg.messagingProfileId,
      campaignId: reg.campaignId,
      attachedNumber: candidate,
      campaignAssign: campaign,
    },
    voiceIngress: {
      telnyxConnectionId: pn?.connection_id,
      telnyxConnectionName: pn?.connection_name,
      onMctbTexmlApp: pn?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
    },
    smartRouting: "none (new number)",
    aiAgent: "none (new number)",
    consentMode,
    smsOutbound: smsAuth,
    warmedProfile: profile
      ? { consentMode: profile.consentMode, automationActive: profile.automationActive }
      : null,
    entryProbe: {
      status: entryRes.status,
      hasGather: entryXml.includes("Gather"),
      preview: entryXml.slice(0, 220),
    },
    liveTestInstructions: {
      forwardCarrierConditionalTo: candidate,
      expectedSmsFrom: candidate,
      expectedFlow:
        "CFNA → new 571 → MCTB TeXML → press 1 → SMS from same 571",
    },
    readyForLiveConditionalForwardTest:
      Boolean(smsAuth.allowed) &&
      pn?.connection_id === MCTB_TEXML_DEFAULT_APP_ID &&
      entryRes.ok &&
      entryXml.includes("Gather"),
  };

  console.log("\n" + JSON.stringify(card, null, 2));
  if (!card.readyForLiveConditionalForwardTest) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
