/**
 * Customer-visible MCTB route / API critical-path timing matrix (server loaders).
 *
 * Usage:
 *   WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-route-timing-matrix.ts
 *
 * Does not start Next.js or open a browser — measures the same lib loaders API routes use.
 */
import { performance } from "node:perf_hooks";

type Flag = "FULL_LR_CONFIG" | "AI_BOOK_READINESS" | "LR_CONFIG_TWICE";

type Row = {
  route: string;
  phase: string;
  ms: number;
  ok: boolean;
  flags: Flag[];
  notes?: string;
};

function ms(start: number): number {
  return Math.round(performance.now() - start);
}

async function timeRow(
  route: string,
  phase: string,
  flags: Flag[],
  fn: () => Promise<unknown>,
  notes?: string,
): Promise<Row> {
  const t0 = performance.now();
  try {
    await fn();
    return { route, phase, ms: ms(t0), ok: true, flags, notes };
  } catch (e) {
    console.error(`[FAIL] ${route} ${phase}:`, e instanceof Error ? e.message : e);
    return { route, phase, ms: ms(t0), ok: false, flags, notes };
  }
}

const SLOW_MS = 2000;
const WARN_MS = 800;

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) {
    console.error("Set WORKSPACE_ID");
    process.exit(1);
  }

  const rows: Row[] = [];
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  const { loadMctbOverviewCore, loadMctbOverviewEnrichment } = await import("@/lib/mctb/overview");
  const { loadMctbMissedCallsListData } = await import("@/lib/mctb/missed-calls-list-data");
  const { parseMissedCallsListQuery } = await import("@/lib/mctb/missed-calls-list-filters");
  const { loadMctbAnalytics } = await import("@/lib/mctb/analytics");
  const { loadConversations } = await import("@/lib/workspace-data");
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMissedCallTextBack } = await import("@/lib/solutions/missed-call-text-back/save");
  const { loadMctbSetupPhoneOptions } = await import("@/lib/numbers/workspace-accessible-numbers");
  const { loadComplianceOverview, loadPhoneNumbers } = await import("@/lib/workspace-data");
  const { loadAdminMctbTestFlags } = await import("@/lib/mctb/admin-test-workspace");
  const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
  const { getProductionMctbForwardTargetE164 } = await import("@/lib/mctb/production-forward-target");
  const { loadLeadRecoveryConfig, loadLeadRecoveryConfigPersisted } = await import(
    "@/lib/mctb/lead-recovery/config"
  );
  const { computeLeadRecoveryPolicyHealth } = await import("@/lib/mctb/lead-recovery/policy-health");
  const { evaluateMctbAiBookingReadiness } = await import("@/lib/mctb/ai-booking/readiness");
  const { loadMctbAiBookingConfig } = await import("@/lib/mctb/ai-booking/config");
  const { loadMctbApprovedBusinessInformation } = await import("@/lib/mctb/approved-business-information");
  const { listMctbBookingLinks } = await import("@/lib/mctb/booking-links/service");
  const { hasMctbAiBookingEntitlement } = await import("@/lib/mctb/ai-booking/entitlement");
  const { hasActiveMctbPaidEntitlement } = await import("@/lib/mctb/entitlement");
  const { loadBusinessBrain } = await import("@/lib/agents/appointment-booking/business-brain");
  const { getStripeTextToPayCapabilities } = await import("@/lib/stripe-connect/capabilities");
  const { buildMctbEventTimeline } = await import("@/lib/mctb/timeline");
  const { loadConsentLogRows } = await import("@/lib/mctb/consent-log");
  const {
    ensureMctbHandoffConfig,
    loadMctbHandoffConfig,
    loadMctbNotificationRecipients,
  } = await import("@/lib/mctb/handoff/config");

  const sampleEvent = await prisma.missedCallEvent.findFirst({
    where: { workspaceId },
    orderBy: { detectedAt: "desc" },
    select: { id: true },
  });
  const sampleConversation = await prisma.conversation.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  // --- /mctb Home ---
  rows.push(
    await timeRow("/mctb", "SSR loadMctbOverviewCore", [], () => loadMctbOverviewCore(workspaceId)),
  );
  rows.push(
    await timeRow("/mctb", "client /api/mctb/overview-enrichment", [], () =>
      loadMctbOverviewEnrichment(workspaceId),
    ),
  );

  // --- /mctb/missed-calls ---
  const listQuery = parseMissedCallsListQuery(new URLSearchParams());
  rows.push(
    await timeRow("/mctb/missed-calls", "client /api/mctb/missed-calls", [], () =>
      loadMctbMissedCallsListData(workspaceId, listQuery),
    ),
  );

  // --- /mctb/missed-calls/[id] ---
  if (sampleEvent) {
    rows.push(
      await timeRow(
        "/mctb/missed-calls/[id]",
        "client /api/mctb/missed-calls/:id (timeline+event)",
        [],
        async () => {
          await buildMctbEventTimeline(sampleEvent.id);
          await prisma.missedCallEvent.findFirst({ where: { id: sampleEvent.id, workspaceId } });
          await loadMissedCallTextConfig(workspaceId);
        },
        `eventId=${sampleEvent.id}`,
      ),
    );
  }

  // --- /mctb/conversations ---
  rows.push(
    await timeRow("/mctb/conversations", "client inbox list loadConversations(mctb)", [], () =>
      loadConversations(workspaceId, { product: "mctb" }),
    ),
  );
  if (sampleConversation) {
    rows.push(
      await timeRow(
        "/mctb/conversations",
        "client selected thread hydrate (1 thread)",
        [],
        () =>
          prisma.conversation.findFirst({
            where: { id: sampleConversation.id, workspaceId },
            include: {
              contact: true,
              messages: { orderBy: { createdAt: "asc" } },
              assignee: { select: { id: true, name: true, email: true } },
            },
          }),
        `conversationId=${sampleConversation.id}`,
      ),
    );
  }

  // --- /mctb/analytics ---
  rows.push(
    await timeRow("/mctb/analytics", "client /api/mctb/analytics?range=30d", [], () =>
      loadMctbAnalytics(workspaceId, "30d"),
    ),
  );

  // --- /mctb/voicemail ---
  rows.push(
    await timeRow("/mctb/voicemail", "client /api/phone/voicemail list", [], async () => {
      await prisma.voicemailMessage.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          fromE164: true,
          durationSeconds: true,
          createdAt: true,
          isRead: true,
          transcriptText: true,
          aiSummary: true,
        },
      });
    }),
  );

  // --- /mctb/setup (home + section editors share setup GET) ---
  rows.push(
    await timeRow(
      "/mctb/setup",
      "client /api/mctb/setup GET bundle",
      [],
      async () => {
        const workspaceNumbersPromise = loadPhoneNumbers(workspaceId, { includeLinked: true });
        await Promise.all([
          loadMissedCallTextConfig(workspaceId),
          loadMissedCallTextBack(workspaceId),
          loadMctbSetupPhoneOptions(workspaceId),
          workspaceNumbersPromise.then((nums) => loadComplianceOverview(workspaceId, { phoneNumbers: nums })),
          workspaceNumbersPromise,
          loadAdminMctbTestFlags(workspaceId),
          loadMctbOnboardingState(workspaceId),
          getProductionMctbForwardTargetE164(workspaceId),
        ]);
      },
    ),
  );
  rows.push(
    await timeRow("/mctb/setup", "client /api/mctb/onboarding GET", [], () =>
      loadMctbOnboardingState(workspaceId),
    ),
  );

  // --- /mctb/ai-recovery (Stage 2 parallel fetches) ---
  rows.push(
    await timeRow(
      "/mctb/ai-recovery",
      "client /api/mctb/ai-recovery/context",
      ["FULL_LR_CONFIG"],
      async () => {
        await Promise.all([
          loadMctbApprovedBusinessInformation(workspaceId),
          loadLeadRecoveryConfig(workspaceId),
          loadMissedCallTextConfig(workspaceId),
          hasMctbAiBookingEntitlement(workspaceId),
          hasActiveMctbPaidEntitlement(workspaceId),
          listMctbBookingLinks(workspaceId),
          loadPhoneNumbers(workspaceId, { includeLinked: true }),
          loadComplianceOverview(workspaceId),
          loadAdminMctbTestFlags(workspaceId),
        ]);
      },
    ),
  );
  rows.push(
    await timeRow(
      "/mctb/ai-recovery",
      "client /api/mctb/lead-recovery/config GET",
      ["FULL_LR_CONFIG", "AI_BOOK_READINESS"],
      async () => {
        const config = await loadLeadRecoveryConfig(workspaceId);
        await computeLeadRecoveryPolicyHealth(workspaceId, config);
        await Promise.all([
          loadMctbAiBookingConfig(workspaceId),
          evaluateMctbAiBookingReadiness(workspaceId),
          getStripeTextToPayCapabilities(workspaceId),
          loadBusinessBrain(workspaceId),
        ]);
      },
      "Mirrors route: config+health+readiness+brain",
    ),
  );
  rows.push(
    await timeRow(
      "/mctb/ai-recovery",
      "page cold load (both fetches parallel)",
      ["FULL_LR_CONFIG", "AI_BOOK_READINESS", "LR_CONFIG_TWICE"],
      async () => {
        await Promise.all([
          (async () => {
            await Promise.all([
              loadMctbApprovedBusinessInformation(workspaceId),
              loadLeadRecoveryConfig(workspaceId),
              loadMissedCallTextConfig(workspaceId),
              hasMctbAiBookingEntitlement(workspaceId),
              hasActiveMctbPaidEntitlement(workspaceId),
              listMctbBookingLinks(workspaceId),
              loadPhoneNumbers(workspaceId, { includeLinked: true }),
              loadComplianceOverview(workspaceId),
              loadAdminMctbTestFlags(workspaceId),
            ]);
          })(),
          (async () => {
            const config = await loadLeadRecoveryConfig(workspaceId);
            await computeLeadRecoveryPolicyHealth(workspaceId, config);
            await Promise.all([
              loadMctbAiBookingConfig(workspaceId),
              evaluateMctbAiBookingReadiness(workspaceId),
              getStripeTextToPayCapabilities(workspaceId),
              loadBusinessBrain(workspaceId),
            ]);
          })(),
        ]);
      },
      "Worst-case wall clock if both APIs fire together",
    ),
  );

  // --- setup satellites ---
  rows.push(
    await timeRow("/mctb/setup/*", "client /api/mctb/handoff GET", ["FULL_LR_CONFIG"], async () => {
      await ensureMctbHandoffConfig(workspaceId);
      await loadMctbHandoffConfig(workspaceId);
      await loadMctbNotificationRecipients(workspaceId);
      await loadLeadRecoveryConfig(workspaceId);
    }),
  );
  rows.push(
    await timeRow("/mctb/setup/exclusions", "client /api/mctb/exclusions GET", [], () =>
      prisma.suppression.findMany({
        where: {
          workspaceId,
          OR: [{ source: "mctb_exclusion" }, { source: "personal_blocked" }],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),
  );

  // --- /mctb/compliance/consent ---
  rows.push(
    await timeRow("/mctb/compliance/consent", "client /api/mctb/consent-log", [], () =>
      loadConsentLogRows(workspaceId, { limit: 100 }),
    ),
  );

  // --- shell (every MCTB page) ---
  rows.push(
    await timeRow("(shell)", "client /api/mctb/shell-context", [], async () => {
      await Promise.all([
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true, customFieldsConfig: true },
        }),
        loadMissedCallTextConfig(workspaceId),
        loadMctbOnboardingState(workspaceId),
      ]);
    }),
  );

  // --- reference: persisted LR only (target pattern for Overview) ---
  rows.push(
    await timeRow("(reference)", "loadLeadRecoveryConfigPersisted", [], () =>
      loadLeadRecoveryConfigPersisted(workspaceId),
    ),
  );
  rows.push(
    await timeRow("(reference)", "loadLeadRecoveryConfig (full)", ["FULL_LR_CONFIG", "AI_BOOK_READINESS"], () =>
      loadLeadRecoveryConfig(workspaceId),
    ),
  );

  console.log("\n# MCTB route timing matrix");
  console.log(`workspaceId: ${workspaceId}`);
  console.log(`at: ${new Date().toISOString()}`);
  console.log(`thresholds: warn >= ${WARN_MS}ms, fail >= ${SLOW_MS}ms`);
  console.log("");
  console.log("| Route | Phase | ms | Status | Flags |");
  console.log("|-------|-------|---:|--------|-------|");

  const failures: Row[] = [];
  const warnings: Row[] = [];

  for (const r of rows) {
    const status = !r.ok ? "ERROR" : r.ms >= SLOW_MS ? "FAIL" : r.ms >= WARN_MS ? "WARN" : "OK";
    if (status === "FAIL") failures.push(r);
    if (status === "WARN") warnings.push(r);
    const flags = r.flags.length ? r.flags.join(",") : "—";
    console.log(`| ${r.route} | ${r.phase} | ${r.ms} | ${status} | ${flags} |`);
  }

  console.log("\n## Summary");
  console.log(`rows: ${rows.length}, warn: ${warnings.length}, fail: ${failures.length}`);

  if (failures.length) {
    console.log("\n### Fail (>= 2s) — investigate before assuming MCTB is fast");
    for (const r of failures) {
      console.log(`- ${r.route}: ${r.phase} — ${r.ms}ms ${r.notes ?? ""}`);
    }
  }

  if (warnings.length) {
    console.log("\n### Warn (>= 800ms)");
    for (const r of warnings) {
      console.log(`- ${r.route}: ${r.phase} — ${r.ms}ms`);
    }
  }

  console.log("\n### Flag legend");
  console.log("- FULL_LR_CONFIG: includes loadLeadRecoveryConfig() → policy health → AI booking readiness");
  console.log("- AI_BOOK_READINESS: explicit evaluateMctbAiBookingReadiness / Microsoft provider path");
  console.log("- LR_CONFIG_TWICE: same page hits full config loader more than once in parallel");

  process.exitCode = failures.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
