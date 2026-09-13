import { isMctbUniversalChromeActive } from "@/lib/mctb/universal-shell";
import type { ProductShell } from "@/lib/products/product-shell";

/** MCTB product chrome — `/mctb` tree only (legacy helper). */
export function isMctbNeutralShellPath(pathname: string): boolean {
  return pathname === "/mctb" || pathname.startsWith("/mctb/");
}

/** Full MCTB visual shell (sidebar, header, canvas, tokens). */
export function isMctbProductChromePath(
  pathname: string,
  productShell: ProductShell,
  options?: { hasMctb?: boolean },
): boolean {
  return isMctbUniversalChromeActive(pathname, productShell, options);
}
