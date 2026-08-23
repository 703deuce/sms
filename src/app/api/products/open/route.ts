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
  if (!isSmsStandaloneHidden() && normalized === "sms") return normalized;
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
