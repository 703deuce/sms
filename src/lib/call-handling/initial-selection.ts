import "server-only";

import { getPrisma } from "@/lib/db";
import {
  hasExplicitCallHandlingSelection,
  mergeCallHandlingIntoSettings,
  readCallHandlingBlock,
} from "./phone-settings";
import { resolveCanonicalVoiceIngressPhoneNumberId } from "./resolve-canonical-voice-ingress";
import type { ActiveCallHandler } from "./types";

/** First-time provisioning: record handler on canonical voice ingress without another Telnyx switch. */
export async function persistInitialCallHandlerIfUnset(input: {
  workspaceId: string;
  voiceIngressPhoneNumberId?: string | null;
  phoneNumberId?: string | null;
  handler: ActiveCallHandler;
  aiReceptionistAgentId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const ingressId = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: input.workspaceId,
    voiceIngressPhoneNumberId: input.voiceIngressPhoneNumberId ?? input.phoneNumberId,
  });
  if (!ingressId) return;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: ingressId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phone) return;
  if (hasExplicitCallHandlingSelection(phone.settingsJson)) return;

  const block = readCallHandlingBlock(phone.settingsJson);
  if (block.activeCallHandler) return;

  const settings = mergeCallHandlingIntoSettings(phone.settingsJson, {
    activeCallHandler: input.handler,
    parkedAiReceptionistAgentId:
      input.handler === "ai_receptionist"
        ? input.aiReceptionistAgentId ?? null
        : block.parkedAiReceptionistAgentId,
    explicitSelectionAt: new Date().toISOString(),
    lastSwitchAt: new Date().toISOString(),
    lastSwitchByUserId: input.userId ?? null,
  });
  await prisma.phoneNumber.update({
    where: { id: ingressId },
    data: { settingsJson: settings as object },
  });
}
