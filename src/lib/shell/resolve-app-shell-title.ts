import { getMctbPageTitle } from "@/lib/products/mctb-nav";
import type { CurrentProduct } from "@/lib/products/types";
import type { ProductShell } from "@/lib/products/product-shell";

export type AppShellTitleInput = {
  pathname: string;
  hideChromeTitle: boolean;
  hideAppointmentsHeaderTitle: boolean;
  isLauncher: boolean;
  mctbContextActive: boolean;
  appointmentsContextActive: boolean;
  smsPlatformActive: boolean;
  currentProduct: CurrentProduct;
  multiProduct: boolean;
  productShell: ProductShell;
};

/**
 * Page title for app chrome. MCTB launch paths use lightweight mctb-nav titles only.
 */
export function resolveAppShellTitle(input: AppShellTitleInput): string {
  if (input.hideChromeTitle || input.hideAppointmentsHeaderTitle) return "";
  if (input.isLauncher) return "Your Transovo Products";

  if (input.mctbContextActive) {
    return getMctbPageTitle(input.pathname);
  }

  const { resolveNonMctbAppShellTitle } =
    require("@/lib/shell/resolve-app-shell-title-extended") as typeof import("@/lib/shell/resolve-app-shell-title-extended");
  return resolveNonMctbAppShellTitle(input);
}
