import "server-only";

import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { ensureNumberProvisioned } from "@/lib/telephony/provisioning/number-assignment";
import { clearMctbSipIngressCache } from "@/lib/mctb/sip-ingress/resolver";
import { isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
import { ensureMctbVoicemailBoxProvisioned } from "@/lib/mctb/voicemail-provisioning";

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

export type ProvisionMctbTelnyxSipIngressResult = {
  ok: boolean;
  phoneNumberId: string;
  e164: string;
  actions: string[];
  error?: string;
};

/**
 * Idempotent: mark a Telnyx DID for MCTB SIP ingress and wire Telnyx FQDN → LiveKit.
 * Does not modify the frozen Python SIP handler — only provider routing + DB flags.
 */
export async function provisionMctbTelnyxSipIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  messageTemplate?: string;
  delaySeconds?: number;
  /** platform_demo = shared Try It DID; customer_mctb = paid production DID */
  mctbRole?: "platform_demo" | "customer_mctb";
}): Promise<ProvisionMctbTelnyxSipIngressResult> {
  const prisma = getPrisma();
  let phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: {
      id: true,
      e164: true,
      provider: true,
      settingsJson: true,
      status: true,
      workspaceId: true,
    },
  });

  if (!phone) {
    const candidate = await prisma.phoneNumber.findFirst({
      where: { id: input.phoneNumberId },
      select: {
        id: true,
        e164: true,
        provider: true,
        settingsJson: true,
        status: true,
        workspaceId: true,
      },
    });
    if (
      candidate &&
      (await isWorkspaceAuthorizedForPlatformDemoNumber(input.workspaceId))
    ) {
      phone = candidate;
    }
  }

  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      actions: [],
      error: "phone_not_found",
    };
  }

  if (String(phone.provider || "").toLowerCase() !== "telnyx") {
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions: [],
      error: "not_telnyx_number",
    };
  }

  const role = input.mctbRole || "customer_mctb";
  const mctbSettings = telnyxLocalA2pSettings({
    role: role === "platform_demo" ? "platform_demo" : "customer_production",
  });
  const nextSettings = mergeSettings(phone.settingsJson, {
    ...mctbSettings,
    mctbSipIngress: true,
    mctbRole: role,
    routingOwner: "mctb_sip",
  });

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: nextSettings as object },
  });

  const provision = await ensureNumberProvisioned({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
    routingMode: "livekit_sip",
  });

  await activateJohnOnPhoneNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
    smsPhoneNumberId: phone.id,
    delaySeconds: input.delaySeconds ?? 0,
    messageTemplate: input.messageTemplate,
  }).catch(() => undefined);

  await enqueueMessagingRegistrationAdvance(input.workspaceId).catch(() => undefined);
  await ensureMctbVoicemailBoxProvisioned(input.workspaceId, phone.e164).catch((err) => {
    console.warn("[mctb-sip-ingress] voicemail box provisioning skipped", err);
  });
  clearMctbSipIngressCache();

  const actions = [
    "mctb_sip_ingress_tagged",
    ...provision.actions,
    ...(provision.ok ? ["mctb_john_activated"] : []),
  ];

  if (!provision.ok) {
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions,
      error: provision.error || "livekit_provision_failed",
    };
  }

  return {
    ok: true,
    phoneNumberId: phone.id,
    e164: phone.e164,
    actions,
  };
}
