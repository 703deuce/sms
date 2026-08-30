import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { saveMctbOnboardingState, parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { traceMctbDebug } from "@/lib/mctb/debug";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBusinessLineE164(
  state: MctbOnboardingState,
  customFieldsConfig: unknown,
): string | null {
  const cfg = asRecord(customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const fromMctb = typeof mctb.businessLineE164 === "string" ? mctb.businessLineE164.trim() : "";
  const fromOnboarding = state.businessNumberE164?.trim() || "";
  return fromMctb || fromOnboarding || null;
}

export type MctbTenantProductionBindingResult = {
  ok: boolean;
  platformDemoLinked: boolean;
  phoneNumberId: string | null;
  businessLineE164: string | null;
  forwardingConnected: boolean;
};

/**
 * Persist business line + forwarding for tenant workspaces.
 * Platform demo linking removed — only workspace-owned DIDs.
 */
export async function ensureMctbTenantProductionBinding(input: {
  workspaceId: string;
  userEmail?: string | null;
  phoneNumberId?: string | null;
  businessLineE164?: string | null;
}): Promise<MctbTenantProductionBindingResult> {
  const prisma = getPrisma();
  const runtime = await loadMissedCallTextConfig(input.workspaceId);

  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const customCfg = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(customCfg.mctb);
  const state = parseMctbOnboardingState(ws?.customFieldsConfig);

  let businessLineE164 = input.businessLineE164?.trim() || readBusinessLineE164(state, ws?.customFieldsConfig);
  if (businessLineE164) {
    try {
      businessLineE164 = normalizeE164(businessLineE164);
    } catch {
      // keep raw if normalization fails
    }
  }

  const phoneNumberId = input.phoneNumberId ?? runtime.phoneNumberId ?? null;

  let forwardingConnected = Boolean(state.forwardingConnectedAt);
  if (businessLineE164) {
    const nowIso = new Date().toISOString();
    await saveMctbOnboardingState(input.workspaceId, {
      businessNumberE164: businessLineE164,
      forwardingConnectedAt: state.forwardingConnectedAt || nowIso,
      ...(state.forwardingTestStartedAt ? {} : { forwardingTestStartedAt: nowIso }),
    });
    forwardingConnected = true;

    await prisma.workspace.update({
      where: { id: input.workspaceId },
      data: {
        customFieldsConfig: {
          ...customCfg,
          mctb: {
            ...mctb,
            businessLineE164,
          },
        },
      },
    });
  }

  const result: MctbTenantProductionBindingResult = {
    ok: true,
    platformDemoLinked: false,
    phoneNumberId,
    businessLineE164: businessLineE164 || null,
    forwardingConnected,
  };

  traceMctbDebug("tenant-binding", "binding_applied", {
    workspaceId: input.workspaceId,
    inputPhoneNumberId: input.phoneNumberId ?? null,
    runtimePhoneNumberId: runtime.phoneNumberId,
    ...result,
  });

  return result;
}

/** @deprecated Platform demo removed. */
export async function resolveLinkedPlatformDemoTenantWorkspace(
  _transovoE164: string,
): Promise<string | null> {
  return null;
}
