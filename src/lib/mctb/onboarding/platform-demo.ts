/** @deprecated Platform demo retired — workspace-owned MCTB numbers only. */
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";

export async function resolvePlatformDemoOwnerWorkspaceId(): Promise<string | null> {
  return null;
}

export async function resolvePlatformDemoSmsSender(): Promise<{
  phoneNumberId: string;
  e164: string;
  source: "sms_phone_number_id";
} | null> {
  return null;
}

export function normalizeDemoE164(e164: string): string {
  return e164;
}

export async function ensurePlatformDemoSipIngress(): Promise<{
  ok: boolean;
  ownerWorkspaceId: string;
  phoneNumberId: string;
  providerNumberId: string | null;
  e164: string;
  actions: string[];
  error?: string;
}> {
  return {
    ok: false,
    ownerWorkspaceId: "",
    phoneNumberId: "",
    providerNumberId: null,
    e164: "",
    actions: [],
    error: "platform_demo_removed",
  };
}

export async function preparePlatformDemoNumberForSmartRouting(): Promise<{
  ownerWorkspaceId: string;
  phoneNumberId: string;
  providerNumberId: string;
}> {
  throw new Error("Platform demo has been removed.");
}

export async function syncPlatformDemoConsentRuntime(mode: MctbConsentMode): Promise<{
  mode: MctbConsentMode;
  action: "sip_ingress_ready" | "sip_ingress_failed" | "paused_verified_consent" | "activated_verified_consent" | "no_flow";
}> {
  return { mode, action: "no_flow" };
}
