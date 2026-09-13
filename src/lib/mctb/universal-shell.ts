import { isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import { isMctbNeutralShellPath } from "@/lib/products/mctb-shell";
import type { ProductShell } from "@/lib/products/product-shell";
import { resolveProductShellFromPath } from "@/lib/products/product-shell";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";

const MCTB_CHROME_EXCLUDED_PREFIXES = [
  "/login",
  "/signup",
  "/maintenance",
  "/f/",
  "/book/",
  "/pay/",
] as const;

/** Routes that never use the MCTB admin chrome (public / auth). */
export function isMctbChromeExcludedPath(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  return MCTB_CHROME_EXCLUDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

/** True when the universal MCTB sidebar/header/canvas should render. */
export function isMctbUniversalChromeActive(
  pathname: string,
  productShell: ProductShell,
  options?: { hasMctb?: boolean },
): boolean {
  if (isMctbChromeExcludedPath(pathname)) return false;
  if (isMctbNeutralShellPath(pathname)) return true;
  if (productShell === "mctb" && isMctbSharedWorkspacePath(pathname)) return true;
  if (isMctbV1Primary() && options?.hasMctb !== false) {
    const pathShell = resolveProductShellFromPath(pathname);
    if (pathShell === "mass_sms" || pathShell === "ai_after_hours") return false;
    if (pathShell === "appointments") return false;
    return true;
  }
  return false;
}

/** Effective product shell for nav when launch mode is MCTB-first. */
export function resolveMctbLaunchProductShell(
  pathname: string,
  productShell: ProductShell,
  hasMctb: boolean,
): ProductShell | null {
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell) return pathShell;
  if (!hasMctb) return null;
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return "mctb";
  if (isMctbV1Primary()) return "mctb";
  return null;
}
