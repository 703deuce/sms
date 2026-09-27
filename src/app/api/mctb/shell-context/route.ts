import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getPrisma } from "@/lib/db";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";

/** Lightweight MCTB chrome context — no Telnyx sync, no compliance sweep. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
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

  const businessLineE164 =
    (typeof mctbSettings.businessLineE164 === "string" ? mctbSettings.businessLineE164 : null) ||
    onboarding.businessNumberE164 ||
    null;

  const senderMode = runtime.senderMode || "WORKSPACE";
  const senderPresentation = describeMctbSenderPresentation(senderMode);

  return NextResponse.json({
    data: {
      workspaceName: workspace?.name ?? "Workspace",
      businessLineE164,
      senderLabel: senderPresentation.title,
      timezone: runtime.timezone ?? "America/New_York",
    },
  });
}
