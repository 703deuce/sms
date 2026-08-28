import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig, updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isAdminMctbTestWorkspace, loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import {
  getPlatformDemoPhoneRecord,
  isWorkspaceAuthorizedForPlatformDemoNumber,
  linkWorkspaceToPlatformDemoNumber,
  unlinkWorkspaceFromPlatformDemoNumber,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access";
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { saveMctbOnboardingState, parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { resolveMctbPhoneNumberIdForWorkspace } from "@/lib/mctb/platform-production-routing";

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

async function isAdminProductionMctbActive(workspaceId: string): Promise<boolean> {
  const [flags, runtime] = await Promise.all([
    loadAdminMctbTestFlags(workspaceId),
    loadMissedCallTextConfig(workspaceId),
  ]);
  if (!isAdminMctbTestWorkspace(flags)) return false;
  return runtime.enabled && Boolean(runtime.phoneNumberId);
}

function productionForwardActive(
  state: MctbOnboardingState,
  customFieldsConfig: unknown,
  adminProduction: boolean,
): boolean {
  if (adminProduction) return true;
  if (state.forwardingConnectedAt) return true;
  if (state.forwardingTestStartedAt) return true;
  if (state.liveTestSession?.startedAt) return true;
  return state.currentStep === "connect" || state.currentStep === "live_test";
}

export type MctbTenantProductionBindingResult = {
  ok: boolean;
  platformDemoLinked: boolean;
  phoneNumberId: string | null;
  businessLineE164: string | null;
  forwardingConnected: boolean;
};

/**
 * Idempotent production binding for a tenant workspace.
 * - Platform-demo forward tests: link tenant, bind runtime to shared 571 DID, mark forwarding ready.
 * - Dedicated DID customers: persist business line + forwarding only.
 */
export async function ensureMctbTenantProductionBinding(input: {
  workspaceId: string;
  userEmail?: string | null;
  phoneNumberId?: string | null;
  businessLineE164?: string | null;
}): Promise<MctbTenantProductionBindingResult> {
  const prisma = getPrisma();
  const demo = await getPlatformDemoPhoneRecord();
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

  let phoneNumberId = input.phoneNumberId ?? runtime.phoneNumberId ?? null;
  const selectedIsPlatformDemo = Boolean(
    demo?.phoneNumberId &&
      phoneNumberId &&
      (phoneNumberId === demo.phoneNumberId ||
        (await prisma.phoneNumber.findFirst({
          where: { id: phoneNumberId, e164: demo.e164 },
          select: { id: true },
        }))),
  );

  // Shared 571 is opt-in only: explicit selection in Setup (or admin bootstrap).
  // Never overwrite a customer's own provisioned DID because Try It linked them once.
  const usesPlatformDemoTenant = Boolean(demo) && selectedIsPlatformDemo;

  let platformDemoLinked = false;
  if (!usesPlatformDemoTenant && demo && phoneNumberId && phoneNumberId !== demo.phoneNumberId) {
    await unlinkWorkspaceFromPlatformDemoNumber({ workspaceId: input.workspaceId }).catch(
      () => undefined,
    );
  }

  if (usesPlatformDemoTenant && demo) {
    await linkWorkspaceToPlatformDemoNumber({
      workspaceId: input.workspaceId,
      userEmail: input.userEmail,
    });
    phoneNumberId = demo.phoneNumberId;
    platformDemoLinked = true;

    await updateMissedCallTextConfig({
      workspaceId: input.workspaceId,
      patch: {
        phone_number_id: demo.phoneNumberId,
        sms_phone_number_id: demo.phoneNumberId,
      },
      source: "mctb_tenant_production_binding",
    });

    await prisma.workspace.update({
      where: { id: input.workspaceId },
      data: { activeFromNumberId: demo.phoneNumberId },
    });
  }

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

  return {
    ok: true,
    platformDemoLinked,
    phoneNumberId,
    businessLineE164: businessLineE164 || null,
    forwardingConnected,
  };
}

/**
 * Resolve the tenant workspace for inbound calls to the shared platform demo DID
 * when no Diversion header is present. Uses explicit phone→tenant links from Setup,
 * not heuristics.
 */
export async function resolveLinkedPlatformDemoTenantWorkspace(
  transovoE164: string,
): Promise<string | null> {
  if (!isPlatformDemoNumber(transovoE164)) return null;

  const demo = await getPlatformDemoPhoneRecord();
  if (!demo) return null;

  const linkedIds = readAdminTestWorkspaceIds(demo.settingsJson).filter(
    (id) => id !== demo.ownerWorkspaceId,
  );
  if (!linkedIds.length) return null;

  const prisma = getPrisma();
  const candidates: string[] = [];

  for (const workspaceId of linkedIds) {
    const authorized = await isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId);
    if (!authorized) continue;

    const [runtime, ws] = await Promise.all([
      loadMissedCallTextConfig(workspaceId),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { customFieldsConfig: true },
      }),
    ]);
    if (!ws || !runtime.enabled) continue;

    const boundPhoneId = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId,
      phoneNumberId: runtime.phoneNumberId,
      transovoE164: demo.e164,
    });
    if (boundPhoneId !== demo.phoneNumberId) continue;

    const tenantState = parseMctbOnboardingState(ws.customFieldsConfig);
    const businessLine = readBusinessLineE164(tenantState, ws.customFieldsConfig);
    const adminProduction = await isAdminProductionMctbActive(workspaceId);
    if (!businessLine && !adminProduction) continue;
    if (!productionForwardActive(tenantState, ws.customFieldsConfig, adminProduction)) continue;

    candidates.push(workspaceId);
  }

  if (candidates.length === 1) return candidates[0]!;
  return null;
}
