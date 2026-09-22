import "server-only";

import { getPrisma } from "@/lib/db";
import { hasExplicitCallHandlingSelection, readCallHandlingBlock } from "./phone-settings";
import type { ActiveCallHandler } from "./types";

export type CallHandlingPublishPolicy = {
  explicitSelection: boolean;
  selectedHandler: ActiveCallHandler | null;
  /** When true, publish/save must not repoint Telnyx for this DID. */
  skipIngressRouting: boolean;
};

export async function getCallHandlingPublishPolicy(input: {
  workspaceId: string;
  phoneNumberId: string | null | undefined;
}): Promise<CallHandlingPublishPolicy> {
  if (!input.phoneNumberId) {
    return { explicitSelection: false, selectedHandler: null, skipIngressRouting: false };
  }
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phone) {
    return { explicitSelection: false, selectedHandler: null, skipIngressRouting: false };
  }

  const block = readCallHandlingBlock(phone.settingsJson);
  const explicit = hasExplicitCallHandlingSelection(phone.settingsJson);
  if (!explicit || !block.activeCallHandler) {
    return {
      explicitSelection: false,
      selectedHandler: block.activeCallHandler,
      skipIngressRouting: false,
    };
  }

  return {
    explicitSelection: true,
    selectedHandler: block.activeCallHandler,
    skipIngressRouting: block.activeCallHandler === "mctb",
  };
}
