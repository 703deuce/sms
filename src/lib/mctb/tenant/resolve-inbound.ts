import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  resolveMctbAssignedWorkspaceForPhone,
  resolveMctbSipIngressByDid,
} from "@/lib/mctb/sip-ingress/resolver";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";
import { isMctbTexmlVoiceIngress, isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";
import { resolveBestMctbIngressPhoneRow } from "@/lib/mctb/texml-ingress/resolve-phone-row";
import type { MctbTexmlIngressConfig } from "@/lib/mctb/texml-ingress/config-cache";

/** Canonical tenant resolution result for any MCTB inbound leg. */
export type MctbInboundTenant = {
  workspaceId: string | null;
  isPlatformDemo: boolean;
  demoMode: boolean;
};

export type ResolveMctbInboundTenantInput = {
  callerE164: string;
  /** Called Transovo DID (To). */
  transovoE164: string;
  forwardedFrom?: string | null;
  /** When TeXML ingress config is already loaded, skip re-lookup. */
  ingressConfig?: Pick<MctbTexmlIngressConfig, "workspaceId" | "e164"> | null;
};

async function resolvePhoneRow(e164: string) {
  return resolveBestMctbIngressPhoneRow(e164);
}

/**
 * Single tenant resolver for all MCTB inbound legs (TeXML, Call Control, SIP).
 * Workspace-owned DIDs only — platform demo retired.
 */
export async function resolveMctbInboundTenant(
  input: ResolveMctbInboundTenantInput,
): Promise<MctbInboundTenant> {
  let transovoE164 = input.transovoE164;
  try {
    transovoE164 = normalizeE164(input.transovoE164);
  } catch {
    // keep raw
  }

  if (input.ingressConfig?.workspaceId) {
    const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
    const state = await loadMctbOnboardingState(input.ingressConfig.workspaceId);
    const demoMode = resolveRuntimeDemoMode({
      workspaceId: input.ingressConfig.workspaceId,
      transovoNumberE164: transovoE164,
      callerE164: input.callerE164,
      forwardedFromE164: input.forwardedFrom,
      demoSession: state.demoSession,
    });
    return {
      workspaceId: input.ingressConfig.workspaceId,
      isPlatformDemo: false,
      demoMode,
    };
  }

  const ingress = await resolveMctbSipIngressByDid(transovoE164);
  if (ingress.workspaceId) {
    const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
    const state = await loadMctbOnboardingState(ingress.workspaceId);
    const demoMode = resolveRuntimeDemoMode({
      workspaceId: ingress.workspaceId,
      transovoNumberE164: transovoE164,
      callerE164: input.callerE164,
      forwardedFromE164: input.forwardedFrom,
      demoSession: state.demoSession,
    });

    return {
      workspaceId: ingress.workspaceId,
      isPlatformDemo: false,
      demoMode,
    };
  }

  const phone = await resolvePhoneRow(transovoE164);
  if (phone) {
    const assignedWorkspaceId = await resolveMctbAssignedWorkspaceForPhone({
      phoneNumberId: phone.id,
      ownerWorkspaceId: phone.workspaceId,
      settingsJson: phone.settingsJson,
    });
    if (assignedWorkspaceId) {
      return {
        workspaceId: assignedWorkspaceId,
        isPlatformDemo: false,
        demoMode: false,
      };
    }

    const caps = readPhoneCapabilities({ settingsJson: phone.settingsJson });
    if (
      caps.mctbEnabled ||
      isMctbTexmlVoiceIngress(phone.settingsJson) ||
      isPhoneMctbSipIngress(phone.settingsJson)
    ) {
      return {
        workspaceId: phone.workspaceId,
        isPlatformDemo: false,
        demoMode: false,
      };
    }
  }

  return { workspaceId: null, isPlatformDemo: false, demoMode: false };
}

/** TeXML helper — resolves tenant with pre-loaded ingress config. */
export async function resolveMctbTexmlTenant(input: {
  ingressConfig: MctbTexmlIngressConfig;
  callerE164: string;
  forwardedFrom?: string | null;
}): Promise<{ workspaceId: string | null; demoMode: boolean; isPlatformDemo: boolean }> {
  const tenant = await resolveMctbInboundTenant({
    callerE164: input.callerE164,
    transovoE164: input.ingressConfig.e164,
    forwardedFrom: input.forwardedFrom,
    ingressConfig: input.ingressConfig,
  });

  return {
    workspaceId: tenant.workspaceId,
    demoMode: tenant.demoMode,
    isPlatformDemo: tenant.isPlatformDemo,
  };
}
