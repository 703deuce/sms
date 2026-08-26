import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
import { isAdminMctbTestWorkspace, loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sameE164(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    const da = a.replace(/\D/g, "");
    const db = b.replace(/\D/g, "");
    return da === db;
  }
}

function isOnboardingForwardOrLiveTestActive(state: MctbOnboardingState): boolean {
  if (state.liveTestPassedAt) return false;
  if (state.forwardingTestStartedAt) return true;
  if (state.liveTestSession?.startedAt) return true;
  return state.currentStep === "connect" || state.currentStep === "live_test";
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
  return isOnboardingForwardOrLiveTestActive(state);
}

/**
 * Production forward: match workspace by forwardedFrom business line.
 * Works for any customer-assigned MCTB DID — not Try It (direct dial to platform demo).
 */
export async function resolveWorkspaceByForwardedBusinessLine(
  forwardedFromE164: string,
): Promise<string | null> {
  let businessLine = "";
  try {
    businessLine = normalizeE164(forwardedFromE164);
  } catch {
    return null;
  }

  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    where: { NOT: { customFieldsConfig: null } },
    select: { id: true, customFieldsConfig: true },
    take: 2000,
  });

  for (const ws of workspaces) {
    const state = parseMctbOnboardingState(ws.customFieldsConfig);
    const line = readBusinessLineE164(state, ws.customFieldsConfig);
    if (!line || !sameE164(line, businessLine)) continue;

    const adminProduction = await isAdminProductionMctbActive(ws.id);
    if (!productionForwardActive(state, ws.customFieldsConfig, adminProduction)) continue;

    return ws.id;
  }

  return null;
}

/**
 * When the platform demo DID is hit without a Diversion/forwarded-from header (common on
 * AT&T → Telnyx SIP), route to the sole admin production workspace that configured a
 * business forward line. Avoids falling back to the platform-owner default (press_1).
 */
export async function resolveAdminProductionWorkspaceForPlatformDemoInbound(): Promise<
  string | null
> {
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    where: { NOT: { customFieldsConfig: null } },
    select: { id: true, customFieldsConfig: true },
    take: 2000,
  });

  const candidates: string[] = [];
  for (const ws of workspaces) {
    const state = parseMctbOnboardingState(ws.customFieldsConfig);
    const line = readBusinessLineE164(state, ws.customFieldsConfig);
    if (!line) continue;
    const adminProduction = await isAdminProductionMctbActive(ws.id);
    if (!adminProduction) continue;
    candidates.push(ws.id);
  }

  if (candidates.length === 1) return candidates[0]!;
  return null;
}

export async function resolveMctbPhoneNumberIdForWorkspace(input: {
  workspaceId: string;
  phoneNumberId?: string | null;
  transovoE164?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  if (input.phoneNumberId) {
    const owned = await prisma.phoneNumber.findFirst({
      where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (owned?.id) return owned.id;

    const authorized = await isWorkspaceAuthorizedForPlatformDemoNumber(input.workspaceId);
    if (authorized) {
      const demo = await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId },
        select: { id: true, e164: true },
      });
      if (demo?.id) return demo.id;
    }
  }

  if (input.transovoE164) {
    const owned = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, e164: input.transovoE164 },
      select: { id: true },
    });
    if (owned?.id) return owned.id;

    const authorized = await isWorkspaceAuthorizedForPlatformDemoNumber(input.workspaceId);
    if (authorized) {
      const demo = await prisma.phoneNumber.findFirst({
        where: { e164: input.transovoE164 },
        select: { id: true },
      });
      if (demo?.id) return demo.id;
    }
  }

  const runtime = await loadMissedCallTextConfig(input.workspaceId);
  return runtime.phoneNumberId || null;
}
