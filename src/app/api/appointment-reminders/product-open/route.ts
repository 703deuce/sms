import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { ensureProductWorkspace } from "@/lib/products/entitlements";
import { isArPlanKey, type ArPlanKey } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import { assignArFreePlan } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { createAppointmentRemindersCheckoutSession } from "@/lib/appointment-reminders/commercial/stripe-checkout";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

export async function GET(request: Request) {
  const session = await getSession();
  const url = new URL(request.url);
  const planRaw = url.searchParams.get("plan")?.trim() || "free";
  const nextRaw = url.searchParams.get("next")?.trim();
  const nextPath =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : AR_ROUTES.setupConnect;

  if (!session) {
    const login = publicRedirectUrl("/login", request);
    login.searchParams.set("product", "appointment_reminders");
    login.searchParams.set("plan", planRaw);
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  const workspace = await ensureProductWorkspace(session.userId, "voice");
  const plan: ArPlanKey = isArPlanKey(planRaw) ? planRaw : "free";

  if (plan === "free") {
    const bootstrap = await requireAppointmentRemindersAccess("appointment_reminders.settings", {
      bootstrap: true,
    });
    if ("error" in bootstrap) return bootstrap.error;
    await assignArFreePlan(workspace.workspaceId);
    const res = NextResponse.redirect(publicRedirectUrl(nextPath, request));
    applyWorkspaceCookies(
      res,
      workspace.workspaceId,
      workspace.workspaceType === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    );
    return res;
  }

  const checkout = await createAppointmentRemindersCheckoutSession({
    workspaceId: workspace.workspaceId,
    plan,
    successUrl: publicRedirectUrl(nextPath, request).toString(),
    cancelUrl: publicRedirectUrl(AR_ROUTES.pricing, request).toString(),
  });

  const res = NextResponse.redirect(checkout.url);
  applyWorkspaceCookies(
    res,
    workspace.workspaceId,
    workspace.workspaceType === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  );
  return res;
}
