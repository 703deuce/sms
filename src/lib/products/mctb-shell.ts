import { isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import type { ProductShell } from "@/lib/products/product-shell";

/** MCTB product chrome — `/mctb` tree only (legacy helper). */
export function isMctbNeutralShellPath(pathname: string): boolean {
  return pathname === "/mctb" || pathname.startsWith("/mctb/");
}

/** Full MCTB visual shell: `/mctb` routes + shared workspace paths when shell is MCTB. */
export function isMctbProductChromePath(pathname: string, productShell: ProductShell): boolean {
  if (isMctbNeutralShellPath(pathname)) return true;
  if (productShell === "mctb" && isMctbSharedWorkspacePath(pathname)) return true;
  return false;
}
