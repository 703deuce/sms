/**
 * Full config trace without Next dev server: real POST handler, prod DB (hydrated),
 * all 8 wizard save_draft steps, optional publish on DRAFT-only agent, RUNTIME_LOAD sim.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/receptionist-trace-full-integration.ts
 *
 * Env:
 *   RECEPTIONIST_TRACE_AGENT_ID — optional; default newest appointment_receptionist agent in workspace
 *   RECEPTIONIST_TRACE_ALLOW_PUBLISH=1 — publish after saves (only if agent status is DRAFT)
 *   RECEPTIONIST_TRACE_RESTORE_BOOKING — after run: `1` = restore initial snapshot;
 *     or explicit strategy (MICROSOFT_365 | SEND_LINK | …)
 */
import Module from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { logger } from "@/lib/observability/logger";
import { createReceptionistTraceId } from "@/lib/solutions/appointment-receptionist/config-tracing/trace-id";
import type { AppointmentReceptionistWizardState, WizardStepId } from "@/lib/solutions/appointment-receptionist/types";
import { getPrisma } from "@/lib/db";
import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY } from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { receptionistLog } from "@/lib/solutions/appointment-receptionist/config-tracing/log";
import {
  beginRouteTrace,
  loadPublishedConfig,
  tracePublishDiff,
} from "@/lib/solutions/appointment-receptionist/config-tracing/route-tracing";
import { buildWizardAgentConfig } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { VoiceAgentConfig } from "@/lib/voice/types";

const ARTIFACT = "/opt/cursor/artifacts";
const LOG_OUT = `${ARTIFACT}/receptionist-trace-full-integration.log`;
const JSON_OUT = `${ARTIFACT}/receptionist-trace-full-integration.json`;

const STEPS: WizardStepId[] = [
  "goals",
  "phone",
  "information",
  "appointments",
  "call-handling",
  "voice",
  "test",
  "activate",
];

const captured: string[] = [];

let traceWorkspaceId = "";

function installNextHeaderMock() {
  const originalLoad = Module._load;
  // @ts-expect-error Node internal
  Module._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === "next/headers") {
      return {
        cookies: async () => ({
          get: () => undefined,
        }),
        headers: async () => new Map(),
      };
    }
    if (
      request === "@/lib/api-auth" ||
      request.endsWith("/lib/api-auth") ||
      request.endsWith("/lib/api-auth.ts")
    ) {
      return {
        requireSession: async () => ({
          session: { userId: "trace-script", email: "trace@transovo.test", name: "Trace", isAdmin: true },
          workspaceId: traceWorkspaceId,
        }),
        jsonError: (err: unknown, status: number) =>
          new Response(JSON.stringify({ error: String(err) }), { status }),
      };
    }
    // @ts-expect-error Node internal
    return originalLoad(request, parent, isMain);
  };
}

function hookLogger() {
  const origInfo = logger.info.bind(logger);
  const origWarn = logger.warn.bind(logger);
  const origError = logger.error.bind(logger);
  const tap = (msg: string, fields?: Record<string, unknown>) => {
    if (msg === "receptionist_config_trace" && fields?.line) {
      captured.push(String(fields.line));
    }
  };
  logger.info = (m, f) => {
    tap(m, f);
    origInfo(m, f);
  };
  logger.warn = (m, f) => {
    tap(m, f);
    origWarn(m, f);
  };
  logger.error = (m, f) => {
    tap(m, f);
    origError(m, f);
  };
}

function countPhases(lines: string[]) {
  const joined = lines.join("\n");
  return {
    UI_CHANGE: (joined.match(/\[RECEPTIONIST\]\[UI_CHANGE\]/g) || []).length,
    SAVE_DRAFT: (joined.match(/\[RECEPTIONIST\]\[SAVE_DRAFT\]/g) || []).length,
    SAVE_CONTINUE: (joined.match(/\[RECEPTIONIST\]\[SAVE_CONTINUE\]/g) || []).length,
    MERGE: (joined.match(/\[RECEPTIONIST\]\[MERGE\]/g) || []).length,
    PERSIST: (joined.match(/\[RECEPTIONIST\]\[PERSIST\]/g) || []).length,
    PUBLISH_DIFF:
      (joined.match(/\[RECEPTIONIST\]\[PUBLISH_DIFF\]/g) || []).length +
      (joined.match(/\[RECEPTIONIST\]\[PUBLISH\]\[DIFF_SUMMARY\]/g) || []).length,
    PUBLISH: (joined.match(/\[RECEPTIONIST\]\[PUBLISH\]/g) || []).length,
    RUNTIME_COMPILE: (joined.match(/\[RECEPTIONIST\]\[RUNTIME_COMPILE\]/g) || []).length,
    RUNTIME_LOAD: (joined.match(/\[RECEPTIONIST\]\[RUNTIME_LOAD\]/g) || []).length,
    SIDE_EFFECT: (joined.match(/\[RECEPTIONIST\]\[SIDE_EFFECT\]/g) || []).length,
  };
}

async function resolveAgent(workspaceId: string): Promise<{ agentId: string; status: string }> {
  const prisma = getPrisma();
  const fromEnv = process.env.RECEPTIONIST_TRACE_AGENT_ID?.trim();
  if (fromEnv) {
    const row = await prisma.voiceAgent.findFirst({
      where: { id: fromEnv, workspaceId },
      select: { id: true, status: true },
    });
    if (!row) throw new Error(`Agent ${fromEnv} not found in workspace ${workspaceId}`);
    return { agentId: row.id, status: row.status };
  }
  const agent = await prisma.voiceAgent.findFirst({
    where: {
      workspaceId,
      archivedAt: null,
      purpose: "appointment_receptionist",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true },
  });
  if (!agent) throw new Error("No appointment_receptionist agent in workspace");
  return { agentId: agent.id, status: agent.status };
}

async function emitRuntimeLoadFromPublished(
  workspaceId: string,
  agentId: string,
  publishedVersionId: string | null,
  traceId: string,
): Promise<void> {
  if (!publishedVersionId) {
    receptionistLog("RUNTIME_LOAD", "SKIPPED", {
      trace: traceId,
      agent: agentId,
      reason: "no_published_version",
    });
    return;
  }
  const version = await getPrisma().voiceAgentVersion.findFirst({
    where: { id: publishedVersionId, workspaceId },
    select: { config: true },
  });
  if (!version?.config) return;
  const config = parseVoiceAgentConfig(version.config);
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const bootstrap = advanced[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY] as Record<string, unknown> | undefined;
  const wizard = advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  const caps = wizard?.capabilities || [];
  const strategy = wizard?.bookingStrategy || "MICROSOFT_365";
  let booking = "BOOKING_DISABLED";
  if (caps.includes("book_appointments")) {
    booking = strategy === "SEND_LINK" ? "SEND_LINK" : String(strategy);
  }
  receptionistLog("RUNTIME_LOAD", "BOOTSTRAP", {
    trace: traceId,
    agent: agentId,
    published_version: publishedVersionId,
    published_mode: "production",
    bootstrap_path: bootstrap ? "pythonRuntimeBootstrapSnapshot" : "missing_snapshot",
    wizard_revision: (wizard as { wizardConfigRevision?: number })?.wizardConfigRevision,
    booking,
    transfer: Boolean(wizard?.transferDestinationPhone?.trim()),
    voice: wizard?.voiceId || bootstrap?.realtimeVoice || "unknown",
    tools: bootstrap?.receptionistCompiled ? "from_bootstrap" : "from_wizard",
    capabilities: caps,
    note: "Emitted by trace integration from published config (same summary shape as Python worker)",
  });
}

async function main() {
  mkdirSync(ARTIFACT, { recursive: true });
  process.env.RECEPTIONIST_CONFIG_TRACE = "1";
  process.env.RECEPTIONIST_CONFIG_TRACE_VERBOSE = "1";
  process.env.DEV_AUTH_BYPASS = "1";
  process.env.DEV_AUTH_BYPASS_AUTO = "1";

  if (!hydrateProdDatabaseUrlFromCoolify()) {
    throw new Error("DATABASE_URL hydrate failed");
  }
  hydrateProdSupabaseFromCoolify();

  hookLogger();

  const prisma = getPrisma();
  const seedAgent = await prisma.voiceAgent.findFirst({
    where: { archivedAt: null, purpose: "appointment_receptionist" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, workspaceId: true, status: true },
  });
  if (!seedAgent) throw new Error("No appointment_receptionist agent in database");
  traceWorkspaceId = seedAgent.workspaceId;
  installNextHeaderMock();

  const { POST } = await import("@/app/api/solutions/appointment-receptionist/route");

  const workspaceId = traceWorkspaceId;
  const { agentId, status: agentStatus } = await resolveAgent(workspaceId);
  const loaded = await loadAppointmentReceptionistSetup(workspaceId, { agentId });
  if (!loaded?.state) throw new Error("No wizard state");

  let state = loaded.state as AppointmentReceptionistWizardState;
  const bookingBefore = state.bookingStrategy;
  const restoreBooking = process.env.RECEPTIONIST_TRACE_RESTORE_BOOKING?.trim();

  const stepResults: Array<{
    step: WizardStepId;
    traceId: string;
    httpStatus: number;
    receptionistTraceId?: string;
    published?: boolean;
    liveSyncPending?: boolean;
    error?: string;
  }> = [];

  for (const step of STEPS) {
    const traceId = createReceptionistTraceId();
    if (step === "appointments") {
      state = { ...state, bookingStrategy: "SEND_LINK" };
    }
    const req = new Request("http://trace.local/api/solutions/appointment-receptionist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-receptionist-trace-id": traceId,
      },
      body: JSON.stringify({
        action: "save_draft",
        wizardStepId: step,
        receptionistTraceId: traceId,
        state,
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    if (body?.data?.state) {
      state = body.data.state as AppointmentReceptionistWizardState;
    }
    stepResults.push({
      step,
      traceId,
      httpStatus: res.status,
      receptionistTraceId: body?.data?.receptionistTraceId,
      published: body?.data?.published,
      liveSyncPending: body?.data?.liveSyncPending,
      error: body?.error,
    });
    if (res.status >= 400) {
      console.warn(`Step ${step} returned ${res.status}:`, body?.error || body);
    }
  }

  let publishResult: Record<string, unknown> | null = null;
  const allowPublish = process.env.RECEPTIONIST_TRACE_ALLOW_PUBLISH === "1";
  if (allowPublish && agentStatus === "DRAFT") {
    const traceId = createReceptionistTraceId();
    const req = new Request("http://trace.local/api/solutions/appointment-receptionist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-receptionist-trace-id": traceId,
      },
      body: JSON.stringify({
        action: "activate",
        wizardStepId: "activate",
        receptionistTraceId: traceId,
        state: { ...state, activationMode: "activate_now" },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    publishResult = { status: res.status, traceId, body };
    if (body?.data?.state) state = body.data.state;

    const agentRow = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { publishedVersionId: true },
    });
    await emitRuntimeLoadFromPublished(
      workspaceId,
      agentId,
      agentRow?.publishedVersionId ?? null,
      traceId,
    );
  } else if (allowPublish && agentStatus !== "DRAFT") {
    publishResult = {
      skipped: true,
      reason: `Agent status is ${agentStatus} — publish only allowed on DRAFT`,
    };
    const agentRow = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { publishedVersionId: true },
    });
    await emitRuntimeLoadFromPublished(
      workspaceId,
      agentId,
      agentRow?.publishedVersionId ?? null,
      createReceptionistTraceId(),
    );
  } else {
    const agentRow = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { publishedVersionId: true },
    });
    await emitRuntimeLoadFromPublished(
      workspaceId,
      agentId,
      agentRow?.publishedVersionId ?? null,
      createReceptionistTraceId(),
    );
  }

  const agentRowFinal = await getPrisma().voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { publishedVersionId: true },
  });
  const publishedBefore = agentRowFinal?.publishedVersionId
    ? await loadPublishedConfig(workspaceId, agentRowFinal.publishedVersionId)
    : null;
  const pubWizardBefore = (publishedBefore?.advanced as Record<string, unknown> | undefined)
    ?.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  const draftForDiff: AppointmentReceptionistWizardState = {
    ...state,
    bookingStrategy:
      pubWizardBefore?.bookingStrategy === state.bookingStrategy
        ? ("SEND_LINK" as const)
        : state.bookingStrategy,
  };
  const shouldDryRunPublishDiff =
    process.env.RECEPTIONIST_TRACE_PUBLISH_DIFF_DRY_RUN !== "0" &&
    !allowPublish &&
    publishedBefore &&
    pubWizardBefore?.bookingStrategy !== draftForDiff.bookingStrategy;
  if (shouldDryRunPublishDiff) {
    const diffTraceId = createReceptionistTraceId();
    const diffCtx = beginRouteTrace({
      traceId: diffTraceId,
      action: "activate",
      wizardStepId: "activate",
      agentId,
    });
    const simulatedPublished: VoiceAgentConfig = {
      ...publishedBefore,
      ...buildWizardAgentConfig(draftForDiff),
      advanced: {
        ...(publishedBefore.advanced as Record<string, unknown>),
        appointmentReceptionistWizard: draftForDiff,
      },
    };
    await tracePublishDiff(diffCtx, {
      draftState: draftForDiff,
      publishedConfigBefore: publishedBefore,
      publishedConfigAfter: simulatedPublished,
      publishedVersionId: agentRowFinal?.publishedVersionId ?? null,
    });
    publishResult = {
      ...(publishResult || {}),
      publishDiffDryRun: true,
      diffTraceId,
      booking_published: pubWizardBefore?.bookingStrategy,
      booking_draft: draftForDiff.bookingStrategy,
      note: "No DB publish — emits PUBLISH_DIFF logs for draft vs published snapshot",
    };
  }

  const restoreStrategy =
    restoreBooking === "1" && bookingBefore
      ? bookingBefore
      : restoreBooking && restoreBooking !== "1"
        ? restoreBooking
        : null;
  if (restoreStrategy) {
    const traceId = createReceptionistTraceId();
    const req = new Request("http://trace.local/api/solutions/appointment-receptionist", {
      method: "POST",
      headers: { "content-type": "application/json", "x-receptionist-trace-id": traceId },
      body: JSON.stringify({
        action: "save_draft",
        wizardStepId: "appointments",
        receptionistTraceId: traceId,
        state: { ...state, bookingStrategy: restoreStrategy },
      }),
    });
    await POST(req);
  }

  const phases = countPhases(captured);
  const report = {
    workspaceId,
    agentId,
    agentStatus,
    bookingBefore,
    bookingAfterDraft: state.bookingStrategy,
    stepResults,
    publishResult,
    capturedLineCount: captured.length,
    phases,
    publishDiffDryRun: shouldDryRunPublishDiff,
    complete:
      phases.MERGE >= STEPS.length &&
      phases.SAVE_DRAFT >= 1 &&
      phases.RUNTIME_COMPILE >= STEPS.length &&
      (phases.PUBLISH_DIFF >= 1 || !shouldDryRunPublishDiff),
  };

  writeFileSync(LOG_OUT, captured.join("\n\n"));
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("Wrote", LOG_OUT);

  const missing: string[] = [];
  if (phases.MERGE < STEPS.length) missing.push("MERGE");
  if (phases.SAVE_DRAFT < 1) missing.push("SAVE_DRAFT");
  if (phases.RUNTIME_COMPILE < 1) missing.push("RUNTIME_COMPILE");
  if (shouldDryRunPublishDiff && phases.PUBLISH_DIFF < 1) missing.push("PUBLISH_DIFF");
  if (phases.RUNTIME_LOAD < 1) missing.push("RUNTIME_LOAD");
  if (missing.length) {
    console.error("INCOMPLETE TRACE — missing phases:", missing.join(", "));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
