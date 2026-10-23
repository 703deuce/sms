import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  DIALING_MODE_LABELS,
  evaluateDialModeGate,
  parseAdvancedDialEntitlements,
  type DialingMode,
} from "@/lib/server/phone/power-dialer/dial-modes";
import { getPowerDialerConcurrencyLimits } from "@/lib/server/phone/power-dialer/usage-limits";

const ALL_MODES: DialingMode[] = [
  "preview",
  "power",
  "parallel",
  "parallel_amd",
  "predictive",
];

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
    const modes = ALL_MODES.map((mode) => {
      const gate = evaluateDialModeGate({ mode, entitlements });
      return {
        id: mode,
        label: DIALING_MODE_LABELS[mode],
        selectable: gate.allowed,
        blockReason: gate.reason ?? null,
        userMessage: gate.userMessage ?? null,
      };
    });
    return NextResponse.json({
      data: {
        modes,
        entitlements,
        killSwitch: concurrency.killSwitch,
        legalNotice:
          "Parallel and predictive dialing can increase abandoned-call compliance obligations. Administrator enablement does not replace counsel review or carrier requirements.",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
