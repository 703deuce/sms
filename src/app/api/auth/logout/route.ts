import { SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(WORKSPACE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
