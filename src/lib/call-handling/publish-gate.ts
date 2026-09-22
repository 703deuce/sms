import "server-only";

import { getPrisma } from "@/lib/db";
import { hasExplicitCallHandlingSelection, readCallHandlingBlock } from "./phone-settings";
import { resolveCanonicalVoiceIngressPhoneNumberId } from "./resolve-canonical-voice-ingress";
import type { ActiveCallHandler } from "./types";

export type CallHandlingPublishPolicy = {
  explicitSelection: boolean;
  selectedHandler: ActiveCallHandler | null;
  voiceIngressPhoneNumberId: string | null;
  /** When true, publish/save must not repoint Telnyx on the canonical voice ingress DID. */
  skipIngressRouting: boolean;
};

export async function getCallHandlingPublishPolicy(input: {
  workspaceId: string;
  phoneNumberId: string | null | undefined;
}): Promise<CallHandlingPublishPolicy> {
  const voiceIngressPhoneNumberId = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: input.workspaceId,
  });

  if (!voiceIngressPhoneNumberId) {
    return {
      explicitSelection: false,
      selectedHandler: null,
      voiceIngressPhoneNumberId: null,
      skipIngressRouting: false,
    };
  }

  const prisma = getPrisma();
  const ingressPhone = await prisma.phoneNumber.findFirst({
    where: { id: voiceIngressPhoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!ingressPhone) {
    return {
      explicitSelection: false,
      selectedHandler: null,
      voiceIngressPhoneNumberId,
      skipIngressRouting: false,
    };
  }

  const block = readCallHandlingBlock(ingressPhone.settingsJson);
  const explicit = hasExplicitCallHandlingSelection(ingressPhone.settingsJson);
  if (!explicit || !block.activeCallHandler) {
    return {
      explicitSelection: false,
      selectedHandler: block.activeCallHandler,
      voiceIngressPhoneNumberId,
      skipIngressRouting: false,
    };
  }

  const targetsIngress =
    !input.phoneNumberId || input.phoneNumberId === voiceIngressPhoneNumberId;

  return {
    explicitSelection: true,
    selectedHandler: block.activeCallHandler,
    voiceIngressPhoneNumberId,
    skipIngressRouting: computePublishSkipIngressRouting({
      activeCallHandler: block.activeCallHandler,
      targetsIngress,
    }),
  };
}

/** Pure policy: AI publish/save must not repoint canonical ingress when MCTB owns it. */
export function computePublishSkipIngressRouting(input: {
  activeCallHandler: ActiveCallHandler;
  targetsIngress: boolean;
}): boolean {
  return input.activeCallHandler === "mctb" && input.targetsIngress;
}
