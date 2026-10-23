import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { requirePowerDialerScope } from "@/lib/server/phone/power-dialer/power-dialer-permissions";
import {
  DIALING_MODE_LABELS,
  evaluateDialModeGate,
  parseAdvancedDialEntitlements,
  type DialingMode,
} from "@/lib/server/phone/power-dialer/dial-modes";
import { getPowerDialerConcurrencyLimits } from "@/lib/server/phone/power-dialer/usage-limits";

const ADVANCED_MODES: DialingMode[] = ["parallel", "parallel_amd", "predictive"];

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    });
    const entitlements = parseAdvancedDialEntitlements(limitsRow?.limits);
    const concurrency = await getPowerDialerConcurrencyLimits(workspaceId);
    const modes = ADVANCED_MODES.map((mode) => {
      const gate = evaluateDialModeGate({ mode, entitlements });
      return {
        id: mode,
        label: DIALING_MODE_LABELS[mode],
        enabled: gate.allowed,
        blockReason: gate.reason ?? null,
        userMessage: gate.userMessage ?? null,
      };
    });
    return NextResponse.json({
      data: {
        entitlements,
        killSwitch: concurrency.killSwitch,
        modes,
        legalNotice:
          "Parallel and predictive dialing can increase abandoned-call compliance obligations. Administrator enablement does not replace counsel review or carrier requirements.",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

/** Admin-only: enable parallel/predictive entitlements (cannot disable kill switch). */
export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    await requirePowerDialerScope(workspaceId, userId, "settings_write");
    const body = (await request.json()) as {
      parallelEnabled?: boolean;
      predictiveEnabled?: boolean;
      premiumAmdEnabled?: boolean;
      maxParallelLines?: number;
      complianceAcknowledged?: boolean;
    };
    const prisma = getPrisma();
    const row = await prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    });
    const root = (row?.limits && typeof row.limits === "object"
      ? row.limits
      : {}) as Record<string, unknown>;
    const pd = (root.powerDialer || {}) as Record<string, unknown>;
    const adv = (pd.advancedDialModes || {}) as Record<string, unknown>;
    if (body.parallelEnabled !== undefined) adv.parallelEnabled = body.parallelEnabled === true;
    if (body.predictiveEnabled !== undefined) {
      adv.predictiveEnabled = body.predictiveEnabled === true && adv.parallelEnabled === true;
    }
    if (body.premiumAmdEnabled !== undefined) adv.premiumAmdEnabled = body.premiumAmdEnabled === true;
    if (typeof body.maxParallelLines === "number") {
      adv.maxParallelLines = Math.min(10, Math.max(2, body.maxParallelLines));
    }
    pd.advancedDialModes = adv;
    if (body.complianceAcknowledged === true) {
      pd.advancedDialComplianceAckAt = new Date().toISOString();
    }
    root.powerDialer = pd;
    await prisma.workspaceLimits.upsert({
      where: { workspaceId },
      create: { workspaceId, limits: root as Prisma.InputJsonValue },
      update: { limits: root as Prisma.InputJsonValue },
    });
    return NextResponse.json({ data: adv });
  } catch (err) {
    return jsonError(err, 400);
  }
}
