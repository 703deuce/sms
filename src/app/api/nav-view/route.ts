import { NextResponse } from "next/server";
import {
  NAV_VIEW_COOKIE,
  navViewCookieOptions,
  parseNavView,
  type NavView,
} from "@/lib/nav-view";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cookie is readable client-side; this endpoint is for SSR hydration helpers.
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const view = parseNavView(jar.get(NAV_VIEW_COOKIE)?.value);
  return NextResponse.json({ view });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { view?: string } = {};
  try {
    body = (await request.json()) as { view?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const view: NavView = parseNavView(body.view);
  const res = NextResponse.json({ view });
  const opts = navViewCookieOptions(view);
  res.cookies.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });
  return res;
}
