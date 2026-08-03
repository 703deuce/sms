import { cookies } from "next/headers";

export const NAV_VIEW_COOKIE = "transovo_nav_view";

export type NavView = "solutions" | "platform";

export function parseNavView(raw: string | undefined | null): NavView {
  return raw === "platform" ? "platform" : "solutions";
}

/** Server: read the persisted nav view (defaults to Solutions for new users). */
export async function getNavView(): Promise<NavView> {
  const jar = await cookies();
  return parseNavView(jar.get(NAV_VIEW_COOKIE)?.value);
}

export function navViewCookieOptions(view: NavView) {
  return {
    name: NAV_VIEW_COOKIE,
    value: view,
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
