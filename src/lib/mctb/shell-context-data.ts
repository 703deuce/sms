import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveMctbWorkspaceBusinessLineE164 } from "@/lib/mctb/resolve-workspace-business-line";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";

export type MctbShellContextPayload = {
  workspaceName: string;
  businessLineE164: string | null;
  senderE164: string | null;
  senderLabel: string;
  timezone: string;
};

/** Shared MCTB chrome context for Opus shell + setup editors (no Telnyx sweep). */
export async function loadMctbShellContextData(workspaceId: string): Promise<MctbShellContextPayload> {
  const prisma = getPrisma();
  const [workspace, runtime, onboarding] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, customFieldsConfig: true },
    }),
    loadMissedCallTextConfig(workspaceId),
    loadMctbOnboardingState(workspaceId),
  ]);

  const customCfg =
    workspace?.customFieldsConfig && typeof workspace.customFieldsConfig === "object"
      ? (workspace.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctbSettings =
    customCfg.mctb && typeof customCfg.mctb === "object"
      ? (customCfg.mctb as Record<string, unknown>)
      : {};

  const businessLineE164 = resolveMctbWorkspaceBusinessLineE164(
    typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null,
    onboarding.businessNumberE164,
  );

  const senderMode = runtime.senderMode || "WORKSPACE";
  const senderPresentation = describeMctbSenderPresentation(senderMode);
  const smsPhoneId = runtime.smsPhoneNumberId || runtime.phoneNumberId;
  let senderE164: string | null = null;
  if (smsPhoneId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: smsPhoneId, workspaceId },
      select: { e164: true },
    });
    senderE164 = pn?.e164 ?? null;
  }

  return {
    workspaceName: workspace?.name ?? "Workspace",
    businessLineE164,
    senderE164,
    senderLabel: senderPresentation.title,
    timezone: runtime.timezone ?? "America/New_York",
  };
}
