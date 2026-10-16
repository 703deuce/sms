/**
 * Exercises tracing log emission against production DB (hydrated) without Next dev server.
 * Simulates one Save Draft (appointments) + documents published version before/after.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getPrisma } from "@/lib/db";
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { loadAppointmentReceptionistSetup } from "@/lib/solutions/appointment-receptionist/save-setup";
import { mergeWizardStateForSave } from "@/lib/solutions/appointment-receptionist/merge-wizard-state-on-save";
import { applyMandatoryConversationGuardrails } from "@/lib/solutions/appointment-receptionist/conversation-guardrails";
import { createReceptionistTraceId } from "@/lib/solutions/appointment-receptionist/config-tracing/trace-id";
import {
  beginRouteTrace,
  finalizeDraftSaveTrace,
  loadAgentLiveSnapshot,
  loadPublishedConfig,
  traceIncomingPayload,
  tracePublishDiff,
} from "@/lib/solutions/appointment-receptionist/config-tracing/route-tracing";
import { logger } from "@/lib/observability/logger";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

const ARTIFACT = "/opt/cursor/artifacts";
const LOG_OUT = `${ARTIFACT}/receptionist-trace-handler-audit.log`;

const captured: string[] = [];

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

async function findReceptionistAgent(): Promise<{ workspaceId: string; agentId: string }> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: {
      archivedAt: null,
      purpose: "appointment_receptionist",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, workspaceId: true },
  });
  if (!agent) throw new Error("No appointment_receptionist VoiceAgent found");
  return { workspaceId: agent.workspaceId, agentId: agent.id };
}

async function main() {
  mkdirSync(ARTIFACT, { recursive: true });
  process.env.RECEPTIONIST_CONFIG_TRACE = "1";
  process.env.RECEPTIONIST_CONFIG_TRACE_VERBOSE = "1";

  if (!hydrateProdDatabaseUrlFromCoolify()) {
    throw new Error("DATABASE_URL hydrate failed");
  }
  hydrateProdSupabaseFromCoolify();
  hookLogger();

  const { workspaceId, agentId } = await findReceptionistAgent();
  const loaded = await loadAppointmentReceptionistSetup(workspaceId, { agentId });
  if (!loaded?.state) throw new Error("No wizard state for agent");

  const serverState = loaded.state as AppointmentReceptionistWizardState;
  const incoming = {
    ...serverState,
    bookingStrategy: "SEND_LINK" as const,
  };
  const merged = mergeWizardStateForSave(serverState, incoming, "appointments");
  const afterGuardrails = applyMandatoryConversationGuardrails(merged);

  const traceId = createReceptionistTraceId();
  const beforeSnap = await loadAgentLiveSnapshot(workspaceId, agentId);
  const prisma = getPrisma();
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { publishedVersionId: true },
  });
  const publishedBefore = agentRow?.publishedVersionId
    ? await loadPublishedConfig(workspaceId, agentRow.publishedVersionId)
    : null;
  const pubWizardBefore = (publishedBefore?.advanced as Record<string, unknown> | undefined)
    ?.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;

  const routeTrace = beginRouteTrace({
    traceId,
    action: "save_draft",
    wizardStepId: "appointments",
    agentId,
    agentSnapshotBefore: beforeSnap,
  });
  traceIncomingPayload(routeTrace, {
    serverState,
    clientState: incoming,
    mergedState: merged,
    beforeGuardrails: merged,
    afterGuardrails,
  });

  await tracePublishDiff(routeTrace, {
    draftState: afterGuardrails,
    publishedConfigBefore: publishedBefore,
    publishedConfigAfter: publishedBefore,
    publishedVersionId: agentRow?.publishedVersionId ?? null,
  });

  await finalizeDraftSaveTrace(routeTrace, {
    workspaceId,
    agentId,
    savedState: afterGuardrails,
    agentSnapshotAfter: beforeSnap,
  });

  const report = {
    traceId,
    agentId,
    workspaceId,
    bookingStrategy_incoming: incoming.bookingStrategy,
    bookingStrategy_server_before: serverState.bookingStrategy,
    bookingStrategy_published_before: pubWizardBefore?.bookingStrategy,
    publishedVersionId: agentRow?.publishedVersionId,
    note:
      "Handler audit emits trace logs only; intentional no DB write in this script to avoid mutating production. Use prod UI audit for real saves.",
    capturedLines: captured.length,
  };

  writeFileSync(LOG_OUT, captured.join("\n\n"));
  writeFileSync(`${ARTIFACT}/receptionist-trace-handler-audit.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("Wrote log lines to", LOG_OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
