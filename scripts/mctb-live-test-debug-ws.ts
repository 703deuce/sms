#!/usr/bin/env npx tsx
/** Debug onboarding live-test vs recent missed calls. */
import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getLiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/onboarding/phone-numbers";

const WS = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  const prisma = getPrisma();
  const hours = Number(process.env.HOURS || "24");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const state = await loadMctbOnboardingState(WS);
  const forwardTarget = await getProductionMctbForwardTargetE164(WS);
  const live = await getLiveTestStatus(WS);

  console.log(JSON.stringify(
    {
      workspaceId: WS,
      forwardTargetE164: forwardTarget,
      onboarding: {
        consentMode: state.consentMode,
        businessNumberE164: state.businessNumberE164,
        currentStep: state.currentStep,
        liveTestSession: state.liveTestSession,
        liveTestPassedAt: state.liveTestPassedAt,
      },
      liveTestStatus: live,
    },
    null,
    2,
  ));

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId: WS, detectedAt: { gte: since } },
    orderBy: { detectedAt: "desc" },
    take: 12,
    select: {
      id: true,
      detectedAt: true,
      businessE164: true,
      callerE164: true,
      reason: true,
      status: true,
      smsSentAt: true,
      metadata: true,
    },
  });

  console.log("\n--- missedCallEvent (last 6h) ---");
  for (const e of events) {
    const meta =
      e.metadata && typeof e.metadata === "object"
        ? (e.metadata as Record<string, unknown>)
        : {};
    console.log(
      JSON.stringify({
        id: e.id,
        at: e.detectedAt.toISOString(),
        businessE164: e.businessE164,
        matchesForwardTarget: forwardTarget ? e.businessE164 === forwardTarget : null,
        caller: e.callerE164,
        reason: e.reason,
        status: e.status,
        smsSentAt: e.smsSentAt?.toISOString() ?? null,
        forwardedFrom: meta.forwardedFrom ?? null,
        afterLiveTestStart:
          state.liveTestSession?.startedAt
            ? e.detectedAt >= new Date(state.liveTestSession.startedAt)
            : null,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
