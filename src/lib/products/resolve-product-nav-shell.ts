import { isMctbBundledAiReceptionistPath } from "@/lib/products/mctb-bundled-receptionist-paths";
import { isMctbSharedWorkspacePath } from "@/lib/products/mctb-nav";
import {
  resolveProductShellFromPath,
  type ProductShell,
} from "@/lib/products/product-shell";
import { resolveMctbLaunchProductShell } from "@/lib/mctb/universal-shell";
import { isAppointmentsV1Primary, isMctbV1Primary } from "@/lib/workspace/platform-launch";

export function resolveEffectiveProductShell(
  pathname: string,
  productShell: ProductShell,
  multiProduct: boolean,
  hasMctb = false,
): ProductShell | null {
  const launchShell = resolveMctbLaunchProductShell(pathname, productShell, hasMctb);
  if (launchShell) return launchShell;
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell) return pathShell;
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return "mctb";
  if (multiProduct) return productShell;
  if (isMctbV1Primary() && hasMctb) return "mctb";
  return null;
}

export function isMctbShellActive(
  pathname: string,
  multiProduct: boolean,
  productShell: ProductShell,
  hasMctb = false,
): boolean {
  if (isMctbV1Primary() && hasMctb && isMctbBundledAiReceptionistPath(pathname)) {
    return true;
  }
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "mctb") return true;
  if (pathShell === "appointments" || pathShell === "mass_sms" || pathShell === "ai_after_hours") {
    return false;
  }
  if (isMctbSharedWorkspacePath(pathname) && productShell === "mctb") return true;
  if (isMctbV1Primary() && hasMctb) return true;
  return multiProduct && productShell === "mctb";
}

export function isAppointmentsShellActive(
  pathname: string,
  multiProduct: boolean,
  productShell: ProductShell,
  hasMctb = false,
): boolean {
  if (isMctbV1Primary() && hasMctb) return false;
  const pathShell = resolveProductShellFromPath(pathname);
  if (pathShell === "appointments") return true;
  if (pathShell === "mctb") return false;
  return multiProduct ? productShell === "appointments" : isAppointmentsV1Primary();
}
