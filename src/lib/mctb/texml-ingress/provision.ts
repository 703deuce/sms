import "server-only";

import { getPrisma } from "@/lib/db";
import { mergePhoneCapabilitySettings } from "@/lib/numbers/phone-capabilities";
import { syncVoiceAgentPhoneAssignment } from "@/lib/voice/agent-phone";
import { scrubCompetingIngressTelephonyFields } from "@/lib/mctb/voice-ingress-guard";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import {
  MCTB_TEXML_ROUTING_MODE,
  MCTB_TEXML_ROUTING_OWNER,
  verifyMctbTexmlIngressRoute,
} from "./texml-route";

export type SwitchDidToMctbTexmlResult = {
  ok: boolean;
  e164: string;
  phoneNumberId: string;
  texmlRoute: Record<string, unknown>;
  verify: Awaited<ReturnType<typeof verifyMctbTexmlIngressRoute>>;
  amyUnassigned: boolean;
};

/**
 * Point a DID at MCTB TeXML ingress and unassign inbound AI without touching agent config.
 */
export async function switchDidToMctbTexmlIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  /** Unassign this agent from the DID (optional). */
  unassignAgentId?: string | null;
  friendlyName?: string;
  preferredTexmlAppId?: string | null;
  mctbRole?: "platform_demo" | "customer_mctb";
}): Promise<SwitchDidToMctbTexmlResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error("Phone number not found or missing providerNumberId");
  }

  let amyUnassigned = false;
  if (input.unassignAgentId) {
    await syncVoiceAgentPhoneAssignment({
      workspaceId: input.workspaceId,
      agentId: input.unassignAgentId,
      phoneNumberId: null,
    });
    await prisma.voiceAgent.updateMany({
      where: {
        id: input.unassignAgentId,
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
      },
      data: { phoneNumberId: null },
    });
    amyUnassigned = true;
  }

  // MCTB TeXML owns inbound — clear AI receptionist joins that steal the DID.
  const agentJoins = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: input.workspaceId, phoneNumberId: phone.id },
    select: { agentId: true },
  });
  for (const join of agentJoins) {
    await syncVoiceAgentPhoneAssignment({
      workspaceId: input.workspaceId,
      agentId: join.agentId,
      phoneNumberId: null,
    });
    await prisma.voiceAgent.updateMany({
      where: {
        id: join.agentId,
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
      },
      data: { phoneNumberId: null },
    });
    amyUnassigned = true;
  }
  await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { workspaceId: input.workspaceId, phoneNumberId: phone.id },
  });
  await prisma.voiceAgent.updateMany({
    where: { workspaceId: input.workspaceId, phoneNumberId: phone.id },
    data: { phoneNumberId: null },
  });

  const settings = mergePhoneCapabilitySettings(phone.settingsJson, {
    mctbEnabled: true,
    voiceEnabled: true,
    smsEnabled: true,
    aiAfterHoursEnabled: false,
  });
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};
  telephony.routingMode = MCTB_TEXML_ROUTING_MODE;
  telephony.routingOwner = MCTB_TEXML_ROUTING_OWNER;
  telephony.state = "active";
  telephony.lastError = null;
  telephony.lastProvisionedAt = new Date().toISOString();
  telephony.telnyxTexmlAppId = telephony.telnyxTexmlAppId || null;
  settings.telephony = scrubCompetingIngressTelephonyFields(telephony);
  settings.routingOwner = MCTB_TEXML_ROUTING_OWNER;
  settings.mctbSipIngress = true;
  settings.mctbRole = input.mctbRole || "customer_mctb";

  const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
    "./texml-mode-provision"
  );
  const modeProvision = await provisionMctbPhoneTexmlIngressModeForWorkspace(
    input.workspaceId,
    phone.id,
  );
  if (!modeProvision) {
    throw new Error("MCTB mode TeXML provision failed: no assigned phone");
  }

  const texmlRoute = {
    e164: phone.e164,
    texmlAppId: modeProvision.texmlAppId,
    voiceUrl: modeProvision.voiceUrl,
    handlerMode: modeProvision.handlerMode,
    liveConnectionId: modeProvision.texmlAppId,
    previousConnectionId: null as string | null,
    matched: true,
    path: `${phone.e164} → ${modeProvision.handlerMode} TeXML ${modeProvision.texmlAppId}`,
  };

  telephony.telnyxTexmlAppId = modeProvision.texmlAppId;
  settings.telephony = scrubCompetingIngressTelephonyFields(telephony);

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: settings },
  });

  invalidateMctbTexmlIngressCache(phone.e164);

  const verify = await verifyMctbTexmlIngressRoute({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    expectedTexmlAppId: modeProvision.texmlAppId,
    expectedVoiceUrl: modeProvision.voiceUrl,
  });

  if (!verify.ok) {
    throw new Error(`MCTB TeXML route verification failed: ${verify.failReason}`);
  }

  return {
    ok: texmlRoute.matched,
    e164: phone.e164,
    phoneNumberId: phone.id,
    texmlRoute: texmlRoute as unknown as Record<string, unknown>,
    verify,
    amyUnassigned,
  };
}
