import "server-only";

import { getPrisma } from "@/lib/db";
import { isActiveEntitlement } from "@/lib/products/types";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";

/**
 * Workspace may use Appointment Reminders when voice/MCTB commercial access is active.
 * Mirrors app shell: `hasAppointmentReminders = productAccess.hasVoice` until a dedicated SKU flag ships.
 */
export async function workspaceHasAppointmentReminders(
  workspaceId: string,
  opts?: { isPlatformAdmin?: boolean },
): Promise<boolean> {
  if (opts?.isPlatformAdmin) return true;

  const prisma = getPrisma();
  const [features, entitlements, workspace] = await Promise.all([
    getWorkspaceProductFeatures(workspaceId, { isPlatformAdmin: false }),
    prisma.productEntitlement.findMany({
      where: { workspaceId },
      select: { productKey: true, status: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { type: true, billingPlan: true },
    }),
  ]);

  if (isActiveEntitlement(features.mctb)) return true;

  const voice = entitlements.find((e) => String(e.productKey).toLowerCase() === "voice");
  if (voice && isActiveEntitlement(voice.status as "active" | "inactive" | "trial")) {
    return true;
  }

  const sms = entitlements.find((e) => String(e.productKey).toLowerCase() === "sms");
  if (sms && isActiveEntitlement(sms.status as "active" | "inactive" | "trial")) {
    return true;
  }

  if (workspace?.type === "BUSINESS" || !workspace?.type) {
    return true;
  }

  const plan = String(workspace?.billingPlan || "").toLowerCase();
  if (plan.includes("appointment") || plan.includes("reminder") || plan.includes("voice")) {
    return true;
  }

  return false;
}
