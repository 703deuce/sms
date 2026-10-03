import { SESSION_COOKIE, WORKSPACE_COOKIE, WORKSPACE_TYPE_COOKIE } from "@/lib/auth";
import { clearDevAutoSessionCache } from "@/lib/auth/dev-auto-session";
import { PRODUCT_ACCESS_COOKIE } from "@/lib/products/access-cookie";
import { NextResponse } from "next/server";

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function POST() {
  clearDevAutoSessionCache();
  const res = NextResponse.json({ ok: true });
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, WORKSPACE_COOKIE);
  clearCookie(res, WORKSPACE_TYPE_COOKIE);
  clearCookie(res, PRODUCT_ACCESS_COOKIE);
  return res;
}
