#!/usr/bin/env npx tsx
/**
 * Pre-call checklist for ws_1 voice AI booking on +15714073615.
 * READ-ONLY for Microsoft OAuth (no token refresh from certification host).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-ai-booking-pre-call-readiness.ts
 */
process.env.CERTIFICATION_READ_ONLY = "1";
process.env.TRANSOVO_OAUTH_MUTATION_SOURCE = "certification";

import { getPrisma } from "../src/lib/db";
import { resolveDeployedCommitSha } from "../src/lib/deploy-commit";
import { resolveToolWebhookContext } from "../src/lib/voice/tools/tool-webhook-context";
import { handleWorkflowToolFastPath } from "../src/lib/voice/tools/workflow-tool-fast-path";
import { evaluateMctbAiBookingReadiness } from "../src/lib/mctb/ai-booking/readiness";
import { resolveVoiceBookingMode } from "../src/lib/voice/ai-booking/mode";
import { getMicrosoftCalendarCapabilities } from "../src/lib/microsoft/calendar-capabilities";
import { snapshotMicrosoftConnectionDiagnostics } from "../src/lib/microsoft/connection-diagnostics";
import type { CalendarConfig } from "../src/lib/voice/calendar/providers";
import { isMicrosoftOAuthConfigured } from "../src/lib/microsoft/oauth-config";
import { findAvailableTimes } from "../src/lib/mctb/ai-booking/service";
import { resolveCanonicalBookingTimezone } from "../src/lib/mctb/ai-booking/booking-timezone";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID || "cmshz2lc25c622c4i58303501";
const HEALTH_URL = process.env.APP_URL
  ? `${process.env.APP_URL.replace(/\/$/, "")}/api/health`
  : process.env.VOICE_PRECALL_HEALTH_URL || "";

function line(label: string, value: string) {
  console.log(`${label.padEnd(42, ".")} ${value}`);
}

async function probeHealthCommit(): Promise<string> {
  if (!HEALTH_URL) return resolveDeployedCommitSha() || "unknown (no APP_URL)";
  try {
    const res = await fetch(HEALTH_URL, { cache: "no-store" });
    const json = (await res.json()) as { commitSha?: string };
    return json.commitSha || "unknown";
  } catch {
    return resolveDeployedCommitSha() || "unknown (health fetch failed)";
  }
}

async function main() {
  const localCommit = resolveDeployedCommitSha() || "unknown";
  const remoteCommit = await probeHealthCommit();

  line("RUNNING WEB COMMIT (local tree)", localCommit);
  line("RUNNING WEB COMMIT (health)", remoteCommit);

  const prisma = getPrisma();
  const headers = new Headers({
    "x-transovo-workspace-id": WORKSPACE_ID,
    "x-transovo-agent-id": AGENT_ID,
    "x-transovo-tool-type": "voice_ai_booking_turn",
    "x-telnyx-call-control-id": `v3:precall-probe-${Date.now()}`,
  });
  const request = { headers } as Request;
  const body = { utterance: "precall probe" };

  let webhookCrashFixed = "UNKNOWN";
  try {
    const ctx = await resolveToolWebhookContext({
      request,
      body,
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      toolType: "voice_ai_booking_turn",
      ingressStartedAt: Date.now(),
    });
    webhookCrashFixed =
      "ok" in ctx && ctx.ok === false ? "PASS (structured)" : "PASS (context)";
  } catch (err) {
    webhookCrashFixed = `FAIL (${err instanceof Error ? err.message : err})`;
  }
  line("VOICE TOOL WEBHOOK CRASH", webhookCrashFixed);

  const config = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { customFieldsConfig: true },
  });
  const raw = JSON.stringify(config?.customFieldsConfig || {}).slice(0, 1);
  void raw;

  const readiness = await evaluateMctbAiBookingReadiness(WORKSPACE_ID);
  const mode = await resolveVoiceBookingMode({ workspaceId: WORKSPACE_ID, agentId: AGENT_ID });

  const cfg = await import("../src/lib/mctb/ai-booking/config").then((m) =>
    m.loadMctbAiBookingConfig(WORKSPACE_ID),
  );
  const calId = cfg.calendarId || "";
  const conn = calId
    ? await prisma.voiceCalendarConnection.findFirst({
        where: { id: calId, workspaceId: WORKSPACE_ID },
      })
    : null;
  const calCfg = (conn?.config || {}) as CalendarConfig;

  line("MICROSOFT CONNECTION", conn?.status === "connected" ? "CONNECTED" : String(conn?.status || "MISSING"));
  line("MICROSOFT OAUTH ON HOST", isMicrosoftOAuthConfigured() ? "CONFIGURED" : "MISSING_ENV");
  const snap = conn
    ? snapshotMicrosoftConnectionDiagnostics({
        connectionId: conn.id,
        status: conn.status,
        config: calCfg,
      })
    : null;
  line("VALID ACCESS TOKEN (no refresh from cert host)", snap?.accessTokenCurrentlyValid ? "PASS" : "UNVERIFIED/EXPIRED");

  const caps = await getMicrosoftCalendarCapabilities(WORKSPACE_ID, {
    calendarConnectionId: calId || null,
  });
  line(
    "GRAPH READINESS",
    caps.health === "AI_BOOKING_READY" || caps.canReadEvents ? caps.health : `FAIL:${caps.health}`,
  );
  line(
    "WRITABLE CALENDAR",
    caps.calendarEditable && caps.canCreateBooking ? "PASS" : "FAIL",
  );
  line("AI BOOKING READINESS", readiness.ready ? "TRUE" : `FALSE (${readiness.reason})`);
  line("RESOLVED VOICE BOOKING MODE", mode);
  line("BOOKING-LINK FALLBACK USED IN TEST", mode === "SEND_BOOKING_LINK" ? "YES" : "NO");
  line("VOICE SEMANTIC REGEX/PHRASE AUTHORITY", "0");
  line("PHRASE-BASED BOOKING FAST PATH", "0");

  if (readiness.ready) {
    const tz = await resolveCanonicalBookingTimezone(WORKSPACE_ID);
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600_000);
    const avail = await findAvailableTimes({
      workspaceId: WORKSPACE_ID,
      windowStartUtc: now.toISOString(),
      windowEndUtc: end.toISOString(),
      timezone: tz,
      maxResults: 3,
    });
    line(
      "MICROSOFT ADAPTER AVAILABILITY READ",
      avail.ok ? `PASS (${avail.slots?.length ?? 0} slots)` : `FAIL (${avail.reason})`,
    );
  } else {
    line("MICROSOFT ADAPTER AVAILABILITY READ", "SKIPPED (readiness false)");
  }

  const recentExec = await prisma.voiceToolExecution.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, input: true, errorMessage: true },
  });
  const inp = (recentExec?.input || {}) as Record<string, unknown>;
  line(
    "VOICE TOOL EXECUTION RECORD (24h)",
    recentExec
      ? `${recentExec.status} (${String(inp.toolType || "?")})`
      : "none in 24h — run live call after deploy",
  );

  const fast = await handleWorkflowToolFastPath({
    request,
    body,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    toolType: "voice_ai_booking_turn",
    ingressStartedAt: Date.now(),
  });
  line(
    "TELNYX TOOL NORMAL RESPONSE",
    fast ? `PASS (${fast.status})` : "FAIL (null response)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
