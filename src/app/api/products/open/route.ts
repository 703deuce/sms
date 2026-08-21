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

function parseProduct(raw: string | null): ProductKey | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "voice" || normalized === "numbers") return normalized;
  if (!isSmsStandaloneHidden() && normalized === "sms") return normalized;
  return null;
}

/** Switch workspace + cookies, then redirect into the requested product app. */
export async function GET(request: Request) {
  const session = await getSession();
  const requestUrl = new URL(request.url);
  if (!session) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", "/app");
    return NextResponse.redirect(loginUrl);
  }

  const product = parseProduct(requestUrl.searchParams.get("product"));
  if (!product) {
    return NextResponse.redirect(new URL("/app", requestUrl.origin));
  }

  const workspace = await ensureProductWorkspace(session.userId, product);

  if (product === "voice") {
    await grantProductEntitlement(workspace.workspaceId, "voice", "active");
  } else if (product === "numbers") {
    await grantProductEntitlement(workspace.workspaceId, "numbers", "active");
  } else if (product === "sms") {
    await grantProductEntitlement(workspace.workspaceId, "sms", "trial");
  }

  await updateLastActiveProduct(session.userId, product);
  const access = await getUserProductAccess(session.userId);

  const res = NextResponse.redirect(new URL(productHomePath(product), requestUrl.origin));
  applyWorkspaceCookies(
    res,
    workspace.workspaceId,
    workspace.workspaceType === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  );
  applyProductAccessCookie(res, access);
  return res;
}
