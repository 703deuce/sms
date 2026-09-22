import "server-only";

import { getPrisma } from "@/lib/db";
import {
  hasExplicitCallHandlingSelection,
  mergeCallHandlingIntoSettings,
  readCallHandlingBlock,
} from "./phone-settings";
import type { ActiveCallHandler } from "./types";

/** First-time provisioning: record handler without forcing another Telnyx switch. */
export async function persistInitialCallHandlerIfUnset(input: {
  workspaceId: string;
  phoneNumberId: string;
  handler: ActiveCallHandler;
  aiReceptionistAgentId?: string | null;
  userId?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phone) return;
  if (hasExplicitCallHandlingSelection(phone.settingsJson)) return;

  const block = readCallHandlingBlock(phone.settingsJson);
  if (block.activeCallHandler) return;

  const settings = mergeCallHandlingIntoSettings(phone.settingsJson, {
    activeCallHandler: input.handler,
    parkedAiReceptionistAgentId:
      input.handler === "ai_receptionist" ? input.aiReceptionistAgentId ?? null : block.parkedAiReceptionistAgentId,
    explicitSelectionAt: new Date().toISOString(),
    lastSwitchAt: new Date().toISOString(),
    lastSwitchByUserId: input.userId ?? null,
  });
  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: { settingsJson: settings as object },
  });
}
