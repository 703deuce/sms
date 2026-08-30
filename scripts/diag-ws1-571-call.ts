/**
 * Diagnose ws_1 571 "all circuits busy" — DB config, Telnyx connection, TeXML entry.
 */
import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";

const WS = "ws_1";
const E164_571 = "+15714073615";
const E164_866 = "+18663464256";

async function telnyxPn(e164: string) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": e164 } },
  );
  return res.data?.[0] || null;
}

async function main() {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig(WS);
  const consentMode = await loadMctbConsentMode(WS);

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WS, status: { not: "Released" } },
    select: {
      id: true,
      e164: true,
      status: true,
      voiceForwardTo: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });

  const orphan = config.phoneNumberId
    ? await prisma.phoneNumber.findUnique({ where: { id: config.phoneNumberId } })
    : null;

  const accessible = await import("../src/lib/numbers/workspace-accessible-numbers").then((m) =>
    m.loadWorkspaceAccessiblePhoneNumbers(WS),
  );

  const activePhone = config.phoneNumberId
    ? phones.find((p) => p.id === config.phoneNumberId)
    : null;

  const pn571 = await telnyxPn(E164_571);
  const pn866 = await telnyxPn(E164_866);

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;
  const entryRes = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164_571,
      CallSid: `diag-571-${Date.now()}`,
    }),
  });
  const entryXml = await entryRes.text();

  const agentJoins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { phoneNumberId: { in: phones.map((p) => p.id) } },
    include: { agent: { select: { id: true, name: true, status: true, agentType: true } } },
  });

  console.log(
    JSON.stringify(
      {
        consentMode,
        mctbConfig: {
          enabled: config.enabled,
          phoneNumberId: config.phoneNumberId,
          smsPhoneNumberId: config.smsPhoneNumberId,
          requireCarrierForward: config.requireCarrierForward,
        },
        activePhone: activePhone
          ? {
              id: activePhone.id,
              e164: activePhone.e164,
              workspaceId: activePhone.workspaceId,
              voiceForwardTo: activePhone.voiceForwardTo,
            }
          : { id: config.phoneNumberId, error: "phone row not found" },
        orphanPhoneLookup: orphan
          ? {
              id: orphan.id,
              e164: orphan.e164,
              workspaceId: orphan.workspaceId,
              status: orphan.status,
            }
          : null,
        accessiblePhoneIds: accessible.map((p) => ({ id: p.id, e164: p.e164, source: p.source })),
        phones: phones.map((p) => ({
          id: p.id,
          e164: p.e164,
          routingMode: (p.settingsJson as Record<string, unknown>)?.telephony
            ? ((p.settingsJson as Record<string, unknown>).telephony as Record<string, unknown>)
                ?.routingMode
            : null,
          routingOwner: (p.settingsJson as Record<string, unknown>)?.routingOwner,
        })),
        telnyx: {
          [E164_571]: {
            connection_id: pn571?.connection_id,
            connection_name: pn571?.connection_name,
            onMctbApp: String(pn571?.connection_id) === MCTB_TEXML_DEFAULT_APP_ID,
            status: pn571?.status,
          },
          [E164_866]: {
            connection_id: pn866?.connection_id,
            connection_name: pn866?.connection_name,
            onMctbApp: String(pn866?.connection_id) === MCTB_TEXML_DEFAULT_APP_ID,
          },
        },
        entryProbe: {
          status: entryRes.status,
          ok: entryRes.ok,
          hasResponse: entryXml.includes("<Response"),
          preview: entryXml.slice(0, 180),
        },
        agentPhoneJoins: agentJoins.map((j) => ({
          phoneNumberId: j.phoneNumberId,
          e164: phones.find((p) => p.id === j.phoneNumberId)?.e164,
          agent: j.agent,
          inbound: j.inbound,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
