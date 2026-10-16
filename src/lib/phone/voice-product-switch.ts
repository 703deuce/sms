import "server-only";

import { getPrisma } from "@/lib/db";
import {
  readCallHandlingBlock,
  resolvePersistedEffectiveCallHandler,
} from "@/lib/call-handling/phone-settings";
import { getPhoneNumberAiOwner } from "@/lib/voice/agent-phone";
import { loadMctbLineInboundConfig } from "@/lib/mctb/inbound-handling/line-config";
import {
  VOICE_INGRESS_PRODUCT_LABEL,
  type VoiceIngressProductId,
  type VoiceProductSwitchConflict,
} from "./voice-product-switch-types";

export type { VoiceIngressProductId, VoiceProductSwitchConflict } from "./voice-product-switch-types";
export { VOICE_INGRESS_PRODUCT_LABEL } from "./voice-product-switch-types";

export async function resolvePhoneVoiceIngressProduct(
  workspaceId: string,
  phoneNumberId: string,
): Promise<{
  product: VoiceIngressProductId;
  agentId: string | null;
  agentName: string | null;
}> {
  const phone = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) {
    return { product: "none", agentId: null, agentName: null };
  }

  const { isPhoneMctbSipIngress, isMctbTexmlIngressLocked } = await import(
    "@/lib/mctb/sip-ingress/sync"
  );
  const block = readCallHandlingBlock(phone.settingsJson);
  const effective = resolvePersistedEffectiveCallHandler(block);
  if (
    effective !== "ai_receptionist" &&
    (effective === "mctb" ||
      isMctbTexmlIngressLocked(phone.settingsJson) ||
      isPhoneMctbSipIngress(phone.settingsJson))
  ) {
    return { product: "mctb", agentId: null, agentName: null };
  }
  if (effective === "mctb") {
    return { product: "mctb", agentId: null, agentName: null };
  }
  if (effective === "ai_receptionist") {
    const owner = await getPhoneNumberAiOwner(workspaceId, phoneNumberId);
    return {
      product: "ai_receptionist",
      agentId: owner?.id ?? block.parkedAiReceptionistAgentId ?? null,
      agentName: owner?.name ?? null,
    };
  }

  const line = await loadMctbLineInboundConfig({
    workspaceId,
    phoneNumberId,
  });
  if (line?.phoneNumberId === phoneNumberId && line.inboundHandlingMode !== "VOICE_AGENT") {
    return { product: "mctb", agentId: null, agentName: null };
  }

  const owner = await getPhoneNumberAiOwner(workspaceId, phoneNumberId);
  if (owner?.status === "ACTIVE") {
    return {
      product: "ai_receptionist",
      agentId: owner.id,
      agentName: owner.name,
    };
  }

  return { product: "none", agentId: owner?.id ?? null, agentName: owner?.name ?? null };
}

export async function getVoiceProductSwitchConflict(input: {
  workspaceId: string;
  phoneNumberId: string;
  targetProduct: "mctb" | "ai_receptionist";
  targetAgentId?: string | null;
}): Promise<VoiceProductSwitchConflict | null> {
  const phone = await getPrisma().phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true },
  });
  if (!phone?.e164) return null;

  const current = await resolvePhoneVoiceIngressProduct(
    input.workspaceId,
    input.phoneNumberId,
  );

  if (input.targetProduct === "ai_receptionist") {
    if (current.product === "none") {
      return null;
    }
    if (
      current.product === "ai_receptionist" &&
      current.agentId &&
      input.targetAgentId &&
      current.agentId === input.targetAgentId
    ) {
      return null;
    }
    if (current.product === "mctb") {
      const targetLabel = VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist;
      const existingLabel = VOICE_INGRESS_PRODUCT_LABEL.mctb;
      return {
        code: "PHONE_VOICE_PRODUCT_SWITCH_REQUIRED",
        phoneNumberId: phone.id,
        e164: phone.e164,
        existingProduct: "mctb",
        existingProductLabel: existingLabel,
        targetProduct: "ai_receptionist",
        targetProductLabel: targetLabel,
        message: `This phone number is currently used by ${existingLabel}. Switching it to ${targetLabel} will replace its current incoming-call routing. ${existingLabel} will no longer receive calls on this number.`,
      };
    }
    if (current.product === "ai_receptionist") {
      const existingLabel =
        current.agentName
          ? `${VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist} (${current.agentName})`
          : VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist;
      const targetLabel = VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist;
      return {
        code: "PHONE_VOICE_PRODUCT_SWITCH_REQUIRED",
        phoneNumberId: phone.id,
        e164: phone.e164,
        existingProduct: "ai_receptionist",
        existingProductLabel: existingLabel,
        targetProduct: "ai_receptionist",
        targetProductLabel: targetLabel,
        existingAgentId: current.agentId,
        existingAgentName: current.agentName,
        message: `This phone number is currently used by ${existingLabel}. Switching it to this ${targetLabel} will replace its current incoming-call routing.`,
      };
    }
    return null;
  }

  // target mctb
  if (current.product === "mctb") return null;
  if (current.product === "none") return null;

  const existingLabel =
    current.agentName
      ? `${VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist} (${current.agentName})`
      : VOICE_INGRESS_PRODUCT_LABEL.ai_receptionist;
  const targetLabel = VOICE_INGRESS_PRODUCT_LABEL.mctb;
  return {
    code: "PHONE_VOICE_PRODUCT_SWITCH_REQUIRED",
    phoneNumberId: phone.id,
    e164: phone.e164,
    existingProduct: current.product,
    existingProductLabel: existingLabel,
    targetProduct: "mctb",
    targetProductLabel: targetLabel,
    existingAgentId: current.agentId,
    existingAgentName: current.agentName,
    message: `This phone number is currently used by ${existingLabel}. Switching it to ${targetLabel} will replace its current incoming-call routing. ${existingLabel} will no longer receive calls on this number.`,
  };
}
