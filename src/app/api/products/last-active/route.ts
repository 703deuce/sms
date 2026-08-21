import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateLastActiveProduct } from "@/lib/products/session";
import type { ProductKey } from "@/lib/products/types";
import {
  getUserProductAccess,
  productAccessCookieValue,
  PRODUCT_ACCESS_COOKIE,
} from "@/lib/products/entitlements";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { product?: string };
  const product = body.product?.toLowerCase();
  if (product !== "sms" && product !== "numbers" && product !== "voice") {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  await updateLastActiveProduct(session.userId, product as ProductKey);

  const access = await getUserProductAccess(session.userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRODUCT_ACCESS_COOKIE, productAccessCookieValue(access), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
