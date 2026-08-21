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

function parseProduct(raw: string | null): ProductKey | null {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "sms" || normalized === "numbers") return normalized;
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

  // Testing: grant trial SMS access when opening SMS without an active entitlement.
  if (product === "sms") {
    await grantProductEntitlement(workspace.workspaceId, "sms", "trial");
  } else {
    await grantProductEntitlement(workspace.workspaceId, "numbers", "active");
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
