/**
 * MCTB critical-path timing pass (server-side loaders + optional HTTP).
 *
 * Usage:
 *   WORKSPACE_ID=ws_... npx tsx scripts/mctb-critical-path-timings.ts
 *   WORKSPACE_ID=ws_... UI_AGENT_BASE_URL=https://... npx tsx scripts/mctb-critical-path-timings.ts
 *
 * HTTP section requires a session cookie or runs unauthenticated (401 timings only).
 * For production HTTP: use browser cookie or dev-bypass against staging.
 */
import { performance } from "node:perf_hooks";

function ms(start: number): number {
  return Math.round(performance.now() - start);
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; ok: boolean }> {
  const t0 = performance.now();
  try {
    await fn();
    return { label, ms: ms(t0), ok: true };
  } catch (e) {
    console.error(`[FAIL] ${label}:`, e instanceof Error ? e.message : e);
    return { label, ms: ms(t0), ok: false };
  }
}

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) {
    console.error("Set WORKSPACE_ID");
    process.exit(1);
  }

  const rows: Array<{ label: string; ms: number; ok: boolean }> = [];

  // --- Overview phases (mirror loadMctbOverview) ---
  const { getPrisma } = await import("@/lib/db");
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbOnboardingState } = await import("@/lib/mctb/onboarding/state");
  const { loadMissedCallTextBack } = await import("@/lib/solutions/missed-call-text-back/save");
  const { loadMctbSetupPhoneOptions } = await import("@/lib/numbers/workspace-accessible-numbers");
  const { loadComplianceOverview, loadPhoneNumbers } = await import("@/lib/workspace-data");
  const { loadAdminMctbTestFlags } = await import("@/lib/mctb/admin-test-workspace");
  const { loadMctbOverviewKpis } = await import("@/lib/mctb/overview-kpis");
  const { appProductSourceToPrisma } = await import("@/lib/mass-texting/product-source");
  const { loadLeadRecoveryConfig } = await import("@/lib/mctb/lead-recovery/config");
  const { computeLeadRecoveryPolicyHealth } = await import("@/lib/mctb/lead-recovery/policy-health");
  const { evaluateMctbAiBookingReadiness } = await import("@/lib/mctb/ai-booking/readiness");
  const { loadMctbLineInboundConfig } = await import("@/lib/mctb/inbound-handling/line-config");
  const { resolveInboundHandlingDecision } = await import("@/lib/mctb/inbound-handling/router");
  const { loadMctbOverview, loadMctbOverviewCore, loadMctbOverviewEnrichment } = await import(
    "@/lib/mctb/overview"
  );
  const { getProductionMctbForwardTargetE164 } = await import("@/lib/mctb/production-forward-target");

  const prisma = getPrisma();

  rows.push(
    await time("overview.workspace_row", async () => {
      await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { customFieldsConfig: true },
      });
    }),
  );

  const batch1 = await time("overview.batch1_parallel (config+onboarding+solution+phones+compliance+reg+admin+kpis+recent)", async () => {
    await Promise.all([
      loadMissedCallTextConfig(workspaceId),
      loadMctbOnboardingState(workspaceId),
      loadMissedCallTextBack(workspaceId),
      loadMctbSetupPhoneOptions(workspaceId),
      loadComplianceOverview(workspaceId),
      loadPhoneNumbers(workspaceId, { includeLinked: true }),
      loadAdminMctbTestFlags(workspaceId),
      loadMctbOverviewKpis(workspaceId),
      prisma.missedCallEvent.findMany({
        where: { workspaceId },
        orderBy: { detectedAt: "desc" },
        take: 8,
      }),
      prisma.conversation.findMany({
        where: { workspaceId, productSource: appProductSourceToPrisma("mctb") },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          contact: { select: { name: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    ]);
  });
  rows.push(batch1);

  rows.push(await time("overview.lead_recovery_config", () => loadLeadRecoveryConfig(workspaceId)));

  rows.push(
    await time("overview.lead_recovery_policy_health", async () => {
      const cfg = await loadLeadRecoveryConfig(workspaceId);
      await computeLeadRecoveryPolicyHealth(workspaceId, cfg);
    }),
  );

  rows.push(await time("overview.ai_booking_readiness", () => evaluateMctbAiBookingReadiness(workspaceId)));

  rows.push(
    await time("overview.inbound_line_config", () => loadMctbLineInboundConfig({ workspaceId })),
  );
  rows.push(
    await time("overview.inbound_decision", () => resolveInboundHandlingDecision({ workspaceId })),
  );

  rows.push(await time("overview.loadMctbOverviewCore", () => loadMctbOverviewCore(workspaceId)));
  rows.push(await time("overview.loadMctbOverviewEnrichment", () => loadMctbOverviewEnrichment(workspaceId)));
  rows.push(await time("overview.loadMctbOverview_total", () => loadMctbOverview(workspaceId)));

  // --- Setup GET bundle (mirror route GET, without HTTP/auth) ---
  rows.push(
    await time("setupGET.parallel_bundle", async () => {
      await Promise.all([
        loadMissedCallTextConfig(workspaceId),
        loadMissedCallTextBack(workspaceId),
        loadMctbSetupPhoneOptions(workspaceId),
        loadComplianceOverview(workspaceId),
        loadPhoneNumbers(workspaceId, { includeLinked: true }),
        loadAdminMctbTestFlags(workspaceId),
        loadMctbOnboardingState(workspaceId),
        getProductionMctbForwardTargetE164(workspaceId),
      ]);
    }),
  );

  rows.push(await time("setupGET.compliance_only", () => loadComplianceOverview(workspaceId)));
  rows.push(await time("setupGET.phone_numbers_only", () => loadPhoneNumbers(workspaceId, { includeLinked: true })));

  // --- Shell context ---
  rows.push(
    await time("shell_context.parallel", async () => {
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

  // --- Conversations: list vs N full threads ---
  const { loadConversations } = await import("@/lib/workspace-data");
  const { buildConversationWhere } = await import("@/lib/mass-texting/inbox-filters");

  let listIds: string[] = [];
  rows.push(
    await time("conversations.loadConversations_list (server, mctb)", async () => {
      const list = await loadConversations(workspaceId, { product: "mctb" });
      listIds = list.slice(0, 40).map((c) => c.id);
    }),
  );

  const hydrateStart = performance.now();
  let threadOk = 0;
  for (const id of listIds.slice(0, 40)) {
    const t0 = performance.now();
    try {
      await prisma.conversation.findFirst({
        where: { id, workspaceId },
        include: {
          contact: true,
          messages: { orderBy: { createdAt: "asc" } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
      threadOk += 1;
      if (listIds.indexOf(id) < 3) {
        rows.push({ label: `conversations.thread_sample_${listIds.indexOf(id) + 1}`, ms: ms(t0), ok: true });
      }
    } catch {
      rows.push({ label: `conversations.thread_sample_${listIds.indexOf(id) + 1}`, ms: ms(t0), ok: false });
    }
  }
  rows.push({
    label: `conversations.thread_hydrate_${threadOk}_sequential (Stage2 client pattern)`,
    ms: ms(hydrateStart),
    ok: threadOk > 0,
  });

  // --- Missed call detail (sample) ---
  const sampleEvent = await prisma.missedCallEvent.findFirst({
    where: { workspaceId },
    orderBy: { detectedAt: "desc" },
    select: { id: true },
  });
  if (sampleEvent) {
    rows.push(
      await time("missed_call_detail.event_row", async () => {
        await prisma.missedCallEvent.findFirst({
          where: { id: sampleEvent.id, workspaceId },
          include: {
            conversation: { select: { id: true } },
            voiceCall: { select: { id: true, durationSeconds: true } },
          },
        });
      }),
    );
  }

  // --- Optional HTTP (wall clock includes network) ---
  const base = process.env.UI_AGENT_BASE_URL?.trim();
  if (base) {
    const cookie = process.env.MCTB_TIMING_COOKIE?.trim();
    const headers: Record<string, string> = cookie ? { Cookie: cookie } : {};

    for (const path of [
      "/api/mctb/shell-context",
      "/api/mctb/setup",
      "/api/mctb/overview",
      "/api/inbox?product=mctb&take=50",
    ]) {
      const t0 = performance.now();
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}${path}`, { headers, cache: "no-store" });
        await res.text();
        rows.push({
          label: `http GET ${path} (status ${res.status})`,
          ms: ms(t0),
          ok: res.ok,
        });
      } catch (e) {
        rows.push({ label: `http GET ${path}`, ms: ms(t0), ok: false });
      }
    }
  }

  console.log("\n# MCTB critical-path timings");
  console.log(`workspaceId: ${workspaceId}`);
  console.log(`at: ${new Date().toISOString()}`);
  console.log("");
  console.log("| Step | ms | ok |");
  console.log("|------|---:|----|");
  for (const r of rows) {
    console.log(`| ${r.label} | ${r.ms} | ${r.ok ? "yes" : "no"} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
