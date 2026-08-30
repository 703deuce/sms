import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getTrialNumberStatus } from "@/lib/mctb/onboarding/trial-number";

export type WorkspaceTryItPhone = {
  phoneNumberId: string;
  e164: string;
};

/** Workspace-owned MCTB DID for Try It / onboarding demo — never the retired platform demo line. */
export async function resolveWorkspaceTryItPhone(
  workspaceId: string,
): Promise<WorkspaceTryItPhone | null> {
  const prisma = getPrisma();
  const runtime = await loadMissedCallTextConfig(workspaceId);
  const candidateIds = [runtime.phoneNumberId, runtime.smsPhoneNumberId].filter(
    (id): id is string => Boolean(id),
  );

  for (const phoneNumberId of candidateIds) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId },
      select: { id: true, e164: true, status: true },
    });
    if (pn?.e164 && pn.status !== "Released") {
      return { phoneNumberId: pn.id, e164: pn.e164 };
    }
  }

  const owned = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      status: { not: "Released" },
      settingsJson: { path: ["mctbActive"], equals: true },
    },
    select: { id: true, e164: true },
    orderBy: { updatedAt: "desc" },
  });
  if (owned?.e164) {
    return { phoneNumberId: owned.id, e164: owned.e164 };
  }

  const trial = await getTrialNumberStatus(workspaceId);
  if (trial.provisioned && trial.trialNumber?.phoneNumberId && trial.trialNumber.e164) {
    return {
      phoneNumberId: trial.trialNumber.phoneNumberId,
      e164: trial.trialNumber.e164,
    };
  }

  return null;
}
