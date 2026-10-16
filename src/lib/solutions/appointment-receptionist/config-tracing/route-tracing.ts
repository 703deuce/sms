import "server-only";

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type {
  AppointmentReceptionistWizardState,
  WizardPersistAction,
  WizardStepId,
} from "../types";
import { diffWizardStates } from "./diff";
import { analyzeMergeTrace } from "./merge-trace";
import { receptionistLog } from "./log";
import {
  detectSnapshotDrift,
  ReceptionistSideEffectLedger,
  type AgentLiveSnapshot,
} from "./side-effect-ledger";
import { verifyPersistedWizardState, readWizardConfigRevision } from "./persist-verify";
import { PublishStageTracker } from "./publish-stages";
import { summarizeCompiledConfig, summarizeWizardRuntime } from "./runtime-summary";
import { formatPublishDiffLine } from "./diff";
import type { VoiceAgentConfig } from "@/lib/voice/types";

export type ReceptionistRouteTraceContext = {
  traceId: string;
  action: WizardPersistAction;
  wizardStepId?: WizardStepId;
  startedAt: number;
  ledger: ReceptionistSideEffectLedger;
  publishStages?: PublishStageTracker;
  agentSnapshotBefore?: AgentLiveSnapshot | null;
};

export async function loadAgentLiveSnapshot(
  workspaceId: string,
  agentId: string | undefined,
): Promise<AgentLiveSnapshot | null> {
  if (!agentId) return null;
  const row = await getPrisma().voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { status: true, publishedVersionId: true, phoneNumberId: true, draftConfig: true },
  });
  if (!row) return null;
  return {
    status: row.status,
    publishedVersionId: row.publishedVersionId,
    phoneNumberId: row.phoneNumberId,
    draftRevision: readWizardConfigRevision(row.draftConfig),
  };
}

export function beginRouteTrace(input: {
  traceId: string;
  action: WizardPersistAction;
  wizardStepId?: WizardStepId;
  agentId?: string;
  agentSnapshotBefore?: AgentLiveSnapshot | null;
}): ReceptionistRouteTraceContext {
  const isDraft = input.action === "save_draft" || input.action === "create_draft";
  const ctx: ReceptionistRouteTraceContext = {
    traceId: input.traceId,
    action: input.action,
    wizardStepId: input.wizardStepId,
    startedAt: Date.now(),
    ledger: new ReceptionistSideEffectLedger(input.traceId, isDraft),
    agentSnapshotBefore: input.agentSnapshotBefore,
    publishStages: input.action === "activate" ? new PublishStageTracker(input.traceId) : undefined,
  };

  const phase =
    input.action === "activate"
      ? "PUBLISH"
      : input.wizardStepId
        ? "SAVE_CONTINUE"
        : "SAVE_DRAFT";

  receptionistLog(phase, "REQUEST", {
    trace: input.traceId,
    action: input.action,
    step: input.wizardStepId,
    agent: input.agentId,
    draft_revision_before: input.agentSnapshotBefore?.draftRevision,
    published_version_before: input.agentSnapshotBefore?.publishedVersionId,
  });

  return ctx;
}

export function traceIncomingPayload(
  ctx: ReceptionistRouteTraceContext,
  input: {
    serverState: AppointmentReceptionistWizardState | null;
    clientState: AppointmentReceptionistWizardState;
    mergedState: AppointmentReceptionistWizardState;
    beforeGuardrails: AppointmentReceptionistWizardState;
    afterGuardrails: AppointmentReceptionistWizardState;
  },
): ReturnType<typeof analyzeMergeTrace> {
  const merge = analyzeMergeTrace({
    traceId: ctx.traceId,
    server: input.serverState || input.clientState,
    incoming: input.clientState,
    merged: input.mergedState,
    stepId: ctx.wizardStepId,
    beforeGuardrails: input.beforeGuardrails,
    afterGuardrails: input.afterGuardrails,
  });

  const clientDiff = diffWizardStates(input.serverState, input.clientState);
  receptionistLog("MERGE", "SUMMARY", {
    trace: ctx.traceId,
    step: ctx.wizardStepId,
    submitted: merge.submittedPaths.length,
    changed: merge.changedPaths.length,
    unchanged: merge.unchangedPaths.length,
    rejected: merge.rejectedPaths.length,
    guardrail_forced: merge.guardrailForcedPaths.length,
    client_changed_paths: clientDiff.changed.length,
  });
  return merge;
}

export async function finalizeDraftSaveTrace(
  ctx: ReceptionistRouteTraceContext,
  input: {
    workspaceId: string;
    agentId: string;
    savedState: AppointmentReceptionistWizardState;
    expectedRevision?: number;
    agentSnapshotAfter?: AgentLiveSnapshot | null;
  },
): Promise<void> {
  const verify = await verifyPersistedWizardState({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    expected: input.savedState,
    expectedRevision: input.expectedRevision,
  });

  const drift =
    ctx.agentSnapshotBefore && input.agentSnapshotAfter
      ? detectSnapshotDrift(ctx.agentSnapshotBefore, input.agentSnapshotAfter)
      : [];

  const runtime = summarizeWizardRuntime(input.savedState, "draft_compile");

  receptionistLog("SAVE_DRAFT", verify.diff.changed.length ? "SUCCESS" : "SUCCESS", {
    trace: ctx.traceId,
    step: ctx.wizardStepId,
    revision: verify.persistedRevision,
    revision_match: verify.revisionMatch,
    submitted: verify.diff.changed.length + verify.diff.unchanged.length,
    persisted_changed: verify.diff.changed.length,
    unchanged: verify.diff.unchanged.length,
    rejected: 0,
    missing: verify.missingPaths.length,
    unexpected_live_drift: drift,
    unexpected_live_effects: ctx.ledger.unexpectedCountForDraftSave(),
    duration_ms: Date.now() - ctx.startedAt,
    booking: runtime.bookingMode,
    transfer: runtime.transferEnabled,
    voice: runtime.voiceId,
    config_fingerprint: runtime.configFingerprint,
  });

  if (drift.length) {
    receptionistLog("SIDE_EFFECT", "UNEXPECTED_LIVE_EFFECT", {
      trace: ctx.traceId,
      drift_fields: drift,
      draft_save: true,
    });
  }
}

export function traceCompileAndRuntime(
  ctx: ReceptionistRouteTraceContext,
  input: {
    state: AppointmentReceptionistWizardState;
    compiled: VoiceAgentConfig;
    mode: "draft_compile" | "publish";
  },
): void {
  ctx.ledger.record("build_agent_config", { mode: input.mode });
  const summary = summarizeCompiledConfig(input.compiled, input.mode === "publish" ? "production" : "draft_compile");
  receptionistLog("RUNTIME_COMPILE", "SUMMARY", {
    trace: ctx.traceId,
    mode: input.mode,
    booking: summary.bookingMode,
    transfer: summary.transferEnabled,
    voice: summary.voiceId,
    tools_expected: summary.bookingToolsExpected,
    transfer_tools_expected: summary.transferToolsExpected,
    enabled_tools: summary.enabledTools,
    config_fingerprint: summary.configFingerprint,
  });
}

export async function tracePublishDiff(
  ctx: ReceptionistRouteTraceContext,
  input: {
    draftState: AppointmentReceptionistWizardState;
    publishedConfigBefore: VoiceAgentConfig | null;
    publishedConfigAfter: VoiceAgentConfig | null;
    publishedVersionId: string | null;
  },
): Promise<void> {
  const beforeWizard =
    (input.publishedConfigBefore?.advanced as Record<string, unknown> | undefined)
      ?.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  const afterWizard =
    (input.publishedConfigAfter?.advanced as Record<string, unknown> | undefined)
      ?.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;

  const diff = diffWizardStates(beforeWizard || {}, input.draftState);
  const expectedChanges = new Set(diff.changed);

  for (const entry of diff.entries.filter((e) => e.changed)) {
    entry.expectedChange = expectedChanges.has(entry.path);
    receptionistLog("PUBLISH_DIFF", "FIELD", {
      trace: ctx.traceId,
      line: formatPublishDiffLine({
        ...entry,
        before: entry.before,
        after: entry.after,
      }),
    });
  }

  const unexpected = diff.entries.filter((e) => e.changed && !expectedChanges.has(e.path));

  receptionistLog("PUBLISH", "DIFF_SUMMARY", {
    trace: ctx.traceId,
    published_version: input.publishedVersionId,
    expected_changes: diff.changed.length,
    unexpected_changes: unexpected.length,
    verified_after: afterWizard ? diffWizardStates(input.draftState, afterWizard).changed.length : null,
  });
}

export async function loadPublishedConfig(
  workspaceId: string,
  publishedVersionId: string | null,
): Promise<VoiceAgentConfig | null> {
  if (!publishedVersionId) return null;
  const version = await getPrisma().voiceAgentVersion.findFirst({
    where: { id: publishedVersionId, workspaceId },
    select: { config: true },
  });
  if (!version?.config) return null;
  return parseVoiceAgentConfig(version.config);
}

export function finalizeActivateTrace(
  ctx: ReceptionistRouteTraceContext,
  input: {
    published: boolean;
    publishError: string | null;
    draftRevision: number | null;
    publishedVersionId: string | null;
    runtimeBootstrapGenerated: boolean;
    providerPublishVerified: boolean;
  },
): void {
  receptionistLog("PUBLISH", input.published ? "SUCCESS" : "FAILED", {
    trace: ctx.traceId,
    draft_revision: input.draftRevision,
    published_version: input.publishedVersionId,
    publish_error: input.publishError,
    runtime_bootstrap: input.runtimeBootstrapGenerated ? "GENERATED" : "SKIPPED",
    provider_publish: input.providerPublishVerified ? "VERIFIED" : "NOT_VERIFIED",
    unexpected_live_effects: ctx.ledger.unexpectedCountForDraftSave(),
    duration_ms: Date.now() - ctx.startedAt,
    stages: ctx.publishStages?.snapshot(),
  });
}
