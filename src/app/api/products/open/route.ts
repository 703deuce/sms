import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ensureProductWorkspace,
  getUserProductAccess,
  grantProductEntitlement,
} from "@/lib/products/entitlements";
import { productHomePath, type ProductKey } from "@/lib/products/types";
import { applyProductAccessCookie, updateLastActiveProduct } from "@/lib/products/session";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import { isSmsStandaloneHidden } from "@/lib/workspace/platform-launch";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";

function parseProduct(raw: string | null): ProductKey | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "voice" || normalized === "numbers") return normalized;
  if (normalized === "mass_texting" || normalized === "mass-texting") return "sms";
  if (!isSmsStandaloneHidden() && normalized === "sms") return "sms";
  if (isSmsStandaloneHidden() && (normalized === "sms" || normalized === "mass_texting")) {
    return "sms";
  }
  return null;
}

/** Switch workspace + cookies, then redirect into the requested product app. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    const loginUrl = publicRedirectUrl("/login", request);
    const product = new URL(request.url).searchParams.get("product");
    if (product === "voice" || product === "mctb") {
      loginUrl.searchParams.set("product", "voice");
    } else if (product === "numbers") {
      loginUrl.searchParams.set("product", "numbers");
    } else if (product === "sms") {
      loginUrl.searchParams.set("product", "sms");
    } else if (product === "mass_texting") {
      loginUrl.searchParams.set("product", "mass_texting");
    } else {
      loginUrl.searchParams.set("next", "/dashboard");
    }
    return NextResponse.redirect(loginUrl);
  }

  const product = parseProduct(new URL(request.url).searchParams.get("product"));
  if (!product) {
    return NextResponse.redirect(publicRedirectUrl("/app", request));
  }

  const workspace = await ensureProductWorkspace(session.userId, product);

  if (product === "voice") {
    const { ensureMctbWorkspaceSeeded } = await import("@/lib/mctb/provisioning/seed-workspace");
    await ensureMctbWorkspaceSeeded(workspace.workspaceId);
    await grantProductEntitlement(workspace.workspaceId, "voice", "active");
  } else if (product === "numbers") {
    await grantProductEntitlement(workspace.workspaceId, "numbers", "active");
  } else if (product === "sms") {
    await grantProductEntitlement(workspace.workspaceId, "sms", "trial");
    const { grantWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
    await grantWorkspaceProductFeature(workspace.workspaceId, "mass_texting", "trial");
    const { ensureMassTextingWorkspaceBootstrap } = await import(
      "@/lib/mass-texting/send-readiness"
    );
    await ensureMassTextingWorkspaceBootstrap(workspace.workspaceId);
  }

  await updateLastActiveProduct(session.userId, product);
  const access = await getUserProductAccess(session.userId);

  const requestUrl = new URL(request.url);
  const nextRaw = requestUrl.searchParams.get("next")?.trim();
  const redirectPath =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/login")
      ? nextRaw
      : productHomePath(product);

  const res = NextResponse.redirect(publicRedirectUrl(redirectPath, request));
  applyWorkspaceCookies(
    res,
    workspace.workspaceId,
    workspace.workspaceType === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  );
  applyProductAccessCookie(res, access);
  return res;
}
