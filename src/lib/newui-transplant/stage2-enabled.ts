import { isNewUiShellEnabled } from "@/lib/products/newui-shell";

/**
 * Stage 2 transplanted page bodies. Set NEXT_PUBLIC_NEWUI_STAGE2=0 to keep legacy page UIs.
 */
export function isNewUiStage2Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_NEWUI_STAGE2 === "0") return false;
  return isNewUiShellEnabled();
}
