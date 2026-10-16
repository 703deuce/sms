/**
 * Compare LiveKit/Telnyx ingress for working receptionist DIDs vs wizard test agents.
 *
 * Usage (prod container with DATABASE_URL):
 *   WORKSPACE_ID=ws_1 REFERENCE_E164=+15717491060 COMPARE_AGENT_ID=cmu42zyel... npx tsx scripts/compare-receptionist-ingress-pipeline.ts
 */
import { getPrisma } from "@/lib/db";
import { getMediaBackendMode, getLiveKitBackendConfig } from "@/lib/voice/media-backend/config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/from-published-agent";
import { readTelephonyProvisionFromSettings } from "@/lib/voice-v3/receptionist-livekit-policy";

const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
const referenceE164 = process.env.REFERENCE_E164?.trim() || "+15717491060";
const compareAgentId = process.env.COMPARE_AGENT_ID?.trim() || "";

type Row = {
  label: string;
  agentId: string;
  agentName: string;
  status: string;
  e164: string;
  phoneNumberId: string;
  routingMode: string | undefined;
  provisionState: string | undefined;
  livekitInboundTrunkId: string | undefined;
  livekitDidDispatchRuleId: string | undefined;
  telnyxFqdnConnectionId: string | undefined;
  bookingStrategy: string;
  capabilityPack: string;
  voiceTransport: string;
  publishPath: string;
};

function pickAdvanced(config: ReturnType<typeof parseVoiceAgentConfig>) {
  const a = (config.advanced || {}) as Record<string, unknown>;
  return {
    bookingStrategy: String(a.bookingStrategy || a.schedulingStrategy || "—"),
    capabilityPack: String(a.capabilityPack || "—"),
    voiceTransport: String(a.voiceTransport || a.runtimeTransport || "livekit_default"),
  };
}

async function rowForPhone(input: {
  label: string;
  phoneNumberId: string;
  e164: string;
  publishPath: string;
}): Promise<Row | null> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId },
    select: { settingsJson: true },
  });
  const prov = readTelephonyProvisionFromSettings(phone?.settingsJson);

  const agent =
    (await prisma.voiceAgent.findFirst({
      where: {
        workspaceId,
        phoneNumberId: input.phoneNumberId,
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        publishedVersionId: true,
        draftConfig: true,
      },
    })) ||
    (compareAgentId
      ? await prisma.voiceAgent.findFirst({
          where: { id: compareAgentId, workspaceId },
          select: {
            id: true,
            name: true,
            status: true,
            publishedVersionId: true,
            draftConfig: true,
          },
        })
      : null);

  if (!agent) return null;

  const ver = agent.publishedVersionId
    ? await prisma.voiceAgentVersion.findFirst({
        where: { id: agent.publishedVersionId, workspaceId },
        select: { config: true },
      })
    : null;
  const config = parseVoiceAgentConfig(ver?.config || agent.draftConfig);
  const adv = pickAdvanced(config);

  return {
    label: input.label,
    agentId: agent.id,
    agentName: agent.name,
    status: agent.status,
    e164: input.e164,
    phoneNumberId: input.phoneNumberId,
    routingMode: prov.routingMode,
    provisionState: prov.state,
    livekitInboundTrunkId: prov.livekitInboundTrunkId,
    livekitDidDispatchRuleId: prov.livekitDidDispatchRuleId,
    telnyxFqdnConnectionId: prov.telnyxFqdnConnectionId,
    bookingStrategy: adv.bookingStrategy,
    capabilityPack: adv.capabilityPack,
    voiceTransport: adv.voiceTransport,
    publishPath: input.publishPath,
  };
}

async function main() {
  const prisma = getPrisma();
  const backend = getMediaBackendMode();
  const cloudCfg = getLiveKitBackendConfig("livekit_cloud");

  const refPhone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: referenceE164 },
    select: { id: true, e164: true, status: true, provider: true },
  });

  const compareAgentRow = compareAgentId
    ? await prisma.voiceAgent.findFirst({
        where: { id: compareAgentId, workspaceId },
        select: { phoneNumberId: true },
      })
    : null;
  const comparePhone = compareAgentRow?.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: compareAgentRow.phoneNumberId, workspaceId },
        select: { id: true, e164: true, status: true, provider: true },
      })
    : await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164: { contains: "3615" } },
        select: { id: true, e164: true, status: true, provider: true },
      });

  const rows: Row[] = [];
  if (refPhone) {
    const r = await rowForPhone({
      label: "reference_working",
      phoneNumberId: refPhone.id,
      e164: refPhone.e164,
      publishPath: "publishVoiceAgent (trigger-activate or /api/voice/agents publish)",
    });
    if (r) rows.push(r);
  }

  if (comparePhone) {
    const r = await rowForPhone({
      label: "wizard_or_test",
      phoneNumberId: comparePhone.id,
      e164: comparePhone.e164,
      publishPath:
        "appointment-receptionist activate → activateFlowTriggers → publishVoiceAgent",
    });
    if (r) rows.push(r);
  }

  const pipelineCode = {
    livekitProvisionEntry: "provisionAppointmentReceptionistLiveKit → reconcileAppointmentReceptionistLiveKit → ensureNumberProvisioned",
    telnyxIngress: "ensureTelnyxLiveKitFqdnConnection + routeTelnyxNumberToConnection",
    runtimeBootstrap: "buildPythonRuntimeBootstrapSnapshot in publishVoiceAgent + syncDidDispatchRuleSnapshot",
    bookingVariant: "Only published agent config (bookingStrategy / calendar hooks) — not separate ingress pipeline",
  };

  console.log(
    JSON.stringify(
      {
        workspaceId,
        processMediaBackendMode: backend,
        livekitCloudApiUrl: cloudCfg.url,
        livekitCloudSipHost: cloudCfg.sipHost,
        frozenCloudTrunkId: cloudCfg.inboundTrunkId,
        referencePhone: refPhone,
        comparePhone,
        ingressRows: rows,
        pipelineCode,
        sameCodePath:
          "Wizard Activate and manual publish both call publishVoiceAgent → same LiveKit provision functions",
        priorFailureNote:
          "502 Bad Gateway was MEDIA_BACKEND_MODE=self_hosted targeting voice.transovo.ai — not a wizard-only code path",
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
