import { redirect } from "next/navigation";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { mctbOnboardingEntryPath } from "@/lib/mctb/onboarding/entry-path";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { MctbOnboardingWizard } from "@/components/mctb/onboarding-wizard";
import { loadMctbOnboardingState, isOnboardingComplete } from "@/lib/mctb/onboarding/state";

export default async function MctbOnboardingPage() {
  if (isNewUiStage2Enabled()) {
    redirect(MCTB_ROUTES.home);
  }

  const entry = mctbOnboardingEntryPath();
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(entry)}`);

  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true, billingPlan: true, name: true },
  });

  if (ws?.type === "PERSONAL") redirect("/personal");

  const state = await loadMctbOnboardingState(workspaceId);
  const plan = String(ws?.billingPlan || "").toLowerCase();
  if (isOnboardingComplete(state) && (plan === "trial" || plan === "free")) {
    redirect("/dashboard");
  }

  return <MctbOnboardingWizard initialBusinessName={ws?.name || ""} />;
}
