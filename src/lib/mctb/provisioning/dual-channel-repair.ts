import "server-only";

import { getPrisma } from "@/lib/db";
import { DEFAULT_NUMBER_CAPABILITY_PATCH } from "@/lib/mctb/provisioning/default-number-capabilities";
import {
  telnyxLocalA2pSettings,
  tollFreeComplianceSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { mergePhoneCapabilitySettings } from "@/lib/numbers/phone-capabilities";
import { assertMctbProvisionPhoneInWorkspace } from "@/lib/mctb/provision-policy";
import { readPhoneMctbSettings } from "@/lib/mctb/sip-ingress/sync";
import { MCTB_TEXML_ROUTING_OWNER } from "@/lib/mctb/texml-ingress/constants";
import { switchDidToMctbTexmlIngress } from "@/lib/mctb/texml-ingress/provision";
import {
  diagnoseWorkspaceNumber,
  persistProvisioning,
  repairMessagingOnWorkspaceNumber,
  verifyAndPersistNumber,
  type NumberDiagnostics,
} from "@/lib/phone/telnyx-dual-provision";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { resolveMctbProvisionRole } from "@/lib/mctb/provisioning/resolve-mctb-role";

function mergeSettings(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
}

export type ReassertMctbTexmlVoiceRouteResult = {
  ok: boolean;
  e164: string;
  phoneNumberId: string;
  actions: string[];
  error?: string;
};

/**
 * Every Telnyx workspace number ships dual-channel from day one (carrier policy).
 * App entitlements gate usage; never skip carrier wire based on product SKU.
 * Switching the active MCTB number is config-only — siblings stay provisioned.
 */
export async function ensureDefaultTelnyxMctbAndSmsProvision(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  traceMctbDebug("provision", "dual_channel_start", {
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) throw new Error("Number not found");
  if (String(phone.provider || "").toLowerCase() !== "telnyx") {
    throw new Error("Telnyx number required for default MCTB+SMS provision");
  }
  if (!phone.providerNumberId || phone.providerNumberId.startsWith("ORDER:")) {
    await persistProvisioning(phone.id, { state: "pending_activation" });
    return diagnoseWorkspaceNumber(input);
  }

  const settings = readPhoneMctbSettings(phone.settingsJson);
  const mctbRole = await resolveMctbProvisionRole({ phoneNumberId: phone.id });
  if (String(settings.mctbRole || "").toLowerCase() !== mctbRole) {
    traceMctbDebug("provision", "role_corrected", {
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      fromRole: settings.mctbRole ?? null,
      toRole: mctbRole,
    });
  }

  const priorSettings = readPhoneMctbSettings(phone.settingsJson);
  const priorTelephony = priorSettings.telephony;
  const taggedSettings = mergePhoneCapabilitySettings(
    mergeSettings(phone.settingsJson, {
      ...telnyxLocalA2pSettings({
        role: mctbRole === "platform_demo" ? "platform_demo" : "customer_production",
      }),
      routingOwner: priorSettings.routingOwner || MCTB_TEXML_ROUTING_OWNER,
      mctbRole,
      ...(priorTelephony ? { telephony: priorTelephony } : {}),
    }),
    DEFAULT_NUMBER_CAPABILITY_PATCH,
  );

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: taggedSettings as object },
  });

  const routed = await switchDidToMctbTexmlIngress({
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    friendlyName: `MCTB ${phone.e164}`,
    mctbRole,
  });
  if (!routed.ok || !routed.verify.ok) {
    throw new Error(routed.verify.failReason || "mctb_texml_route_failed");
  }

  await repairMessagingOnWorkspaceNumber(input);
  const diagnostics = await verifyAndPersistNumber(input);
  traceMctbDebug("provision", "dual_channel_complete", {
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    e164: phone.e164,
    mctbRole,
    diagnostics,
  });
  const { warmMctbInboundRoutingProfileForE164 } = await import(
    "@/lib/mctb/texml-ingress/routing-profile"
  );
  void warmMctbInboundRoutingProfileForE164(phone.e164).catch(() => undefined);
  return diagnostics;
}

/**
 * Re-point voice at the frozen MCTB TeXML pipeline without touching runtime config.
 */
export async function reassertMctbTexmlVoiceRoute(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<ReassertMctbTexmlVoiceRouteResult> {
  const phone = await assertMctbProvisionPhoneInWorkspace(input);
  const mctbRole = await resolveMctbProvisionRole({ phoneNumberId: phone.id });

  const actions = ["mctb_texml_voice_reassert"];
  try {
    const routed = await switchDidToMctbTexmlIngress({
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      friendlyName: `MCTB ${phone.e164}`,
      mctbRole,
    });
    actions.push(
      `mctb_texml_app:${String((routed.texmlRoute as { texmlAppId?: string }).texmlAppId || "")}`,
      `mctb_texml_route:${routed.verify.ok ? "verified" : "unverified"}`,
    );
    if (!routed.ok || !routed.verify.ok) {
      throw new Error(routed.verify.failReason || "mctb_texml_route_failed");
    }
    return {
      ok: true,
      e164: phone.e164,
      phoneNumberId: phone.id,
      actions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      e164: phone.e164,
      phoneNumberId: phone.id,
      actions,
      error: message || "mctb_texml_voice_reassert_failed",
    };
  }
}

/** @deprecated Use ensureDefaultTelnyxMctbAndSmsProvision */
export async function repairMctbDualChannelNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  return ensureDefaultTelnyxMctbAndSmsProvision(input);
}

/** Twilio and other providers: stamp MCTB+SMS capability flags and ensure voice webhook. */
export async function ensureDefaultNonTelnyxNumberProvision(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) throw new Error("Number not found");

  const provider = String(phone.provider || "").toLowerCase();
  const compliance =
    provider === "twilio" ? tollFreeComplianceSettings() : {};
  const taggedSettings = mergePhoneCapabilitySettings(
    mergeSettings(phone.settingsJson, {
      ...compliance,
      mctbSipIngress: true,
      routingOwner: MCTB_TEXML_ROUTING_OWNER,
    }),
    DEFAULT_NUMBER_CAPABILITY_PATCH,
  );

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: taggedSettings as object },
  });

  if (provider === "twilio" && phone.twilioSid) {
    const { twilioNumberProvider } = await import(
      "@/lib/numbers/providers/twilio-number-provider"
    );
    await twilioNumberProvider.configureVoiceWebhook(phone.twilioSid, input.workspaceId);
  }

  return diagnoseWorkspaceNumber(input);
}
