import { redirect } from "next/navigation";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { MctbOnboardingWizard } from "@/components/mctb/onboarding-wizard";
import { loadMctbOnboardingState, isOnboardingComplete } from "@/lib/mctb/onboarding/state";

export default async function MctbOnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/signup?product=voice");

  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true, billingPlan: true, name: true },
  });

  if (ws?.type === "PERSONAL") redirect("/personal");

  const state = await loadMctbOnboardingState(workspaceId);
  if (isOnboardingComplete(state) && String(ws?.billingPlan).toLowerCase() === "trial") {
    redirect("/dashboard");
  }

  return <MctbOnboardingWizard initialBusinessName={ws?.name || ""} />;
}
