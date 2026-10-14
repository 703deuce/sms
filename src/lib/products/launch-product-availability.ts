/**
 * Launch product availability — enabled vs customerVisible.
 *
 * `enabled`: runtime/routes/code exist (do not use to shut down webhooks/workers).
 * `customerVisible`: ordinary customers discover the product in nav and may browse UI routes.
 *
 * @see docs/VOICE-V3-PRODUCT-VISIBILITY.md
 */

import { mctbShellHome } from "@/lib/products/product-shell";
import { isVoiceCustomerUiPath } from "@/lib/products/mctb-bundled-receptionist-paths";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-auth-bypass";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { isMctbBundledVoiceAgentWizardPath } from "@/lib/products/mctb-voice-agent-wizard-paths";

export type LaunchProductKey = "mctb" | "voice" | "appointments" | "mass_sms" | "fax";

export type LaunchProductAvailabilityRow = {
  /** Product runtime exists in the codebase and may be entitled. */
  enabled: boolean;
  /** Exposed in customer nav, switcher, and direct UI entry (when entitled). */
  customerVisible: boolean;
};

/** Default launch posture — override with env for internal QA only. */
export const LAUNCH_PRODUCT_AVAILABILITY: Record<LaunchProductKey, LaunchProductAvailabilityRow> = {
  mctb: { enabled: true, customerVisible: true },
  voice: { enabled: true, customerVisible: false },
  appointments: { enabled: true, customerVisible: false },
  mass_sms: { enabled: true, customerVisible: false },
  fax: { enabled: true, customerVisible: false },
};

function envTruthy(name: string): boolean {
  return process.env[name]?.trim() === "1" || process.env[name]?.trim() === "true";
}

/**
 * When true, Voice AI Receptionist is shown in nav and /voice/* receptionist routes are reachable.
 * Set `TRANSOVO_VOICE_CUSTOMER_VISIBLE=1` on staging/internal deploys to resume Voice UX work.
 */
export function isVoiceProductCustomerVisible(): boolean {
  if (envTruthy("TRANSOVO_VOICE_CUSTOMER_VISIBLE")) return true;
  if (process.env.TRANSOVO_VOICE_CUSTOMER_VISIBLE?.trim() === "0") return false;
  if (isDevAuthBypassEnabled() && envTruthy("TRANSOVO_VOICE_CUSTOMER_VISIBLE_DEV")) return true;
  const row = LAUNCH_PRODUCT_AVAILABILITY.voice;
  return row.enabled && row.customerVisible;
}

export function isLaunchProductCustomerVisible(product: LaunchProductKey): boolean {
  if (product === "voice") return isVoiceProductCustomerVisible();
  const row = LAUNCH_PRODUCT_AVAILABILITY[product];
  return row.enabled && row.customerVisible;
}

export function isLaunchProductEnabled(product: LaunchProductKey): boolean {
  return LAUNCH_PRODUCT_AVAILABILITY[product].enabled;
}

/** Customer home when MCTB is the sole launched product. */
export function mctbLaunchCustomerHome(): string {
  return mctbShellHome();
}

/**
 * Redirect authenticated customers away from hidden Voice AI Receptionist UI routes.
 * Does not apply to API/webhooks/runtime endpoints.
 */
export function voiceCustomerHiddenRedirect(pathname: string): string | null {
  if (isVoiceProductCustomerVisible()) return null;
  if (isMctbV1Primary() && isMctbBundledVoiceAgentWizardPath(pathname)) {
    return null;
  }
  if (isVoiceCustomerUiPath(pathname)) {
    return mctbLaunchCustomerHome();
  }
  if (isMctbV1Primary() && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) {
    return mctbLaunchCustomerHome();
  }
  return null;
}
