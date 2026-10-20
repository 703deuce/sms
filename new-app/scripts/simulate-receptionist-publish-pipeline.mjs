/**
 * End-to-end simulation of the AI Receptionist **Publish** button (and optional Numbers switch).
 * Uses the same server modules as POST /api/receptionist/publish and switch-product — no duplicate logic.
 *
 * Dry-run (validate + assert current DB; no mutations):
 *   cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/simulate-receptionist-publish-pipeline.mjs --workspace ws_1 --e164 +15716986481
 *
 * Apply publish (mutates — same as clicking Publish after a saved draft):
 *   ... --workspace ws_1 --e164 +15716986481 --apply
 *
 * Switch number to receptionist then publish (mutates — switch UI + publish):
 *   ... --workspace ws_1 --e164 +15716986481 --switch --apply
 *
 * Production container (repo at /app):
 *   NODE_OPTIONS='--import /app/scripts/preload-server-only.mjs' npx tsx new-app/scripts/simulate-receptionist-publish-pipeline.mjs --workspace ws_1 --e164 +15716986481 --apply
 */
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);

function flag(name) {
  return args.includes(name);
}

function opt(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
}

const workspaceId = opt("--workspace") || process.env.SIM_WORKSPACE_ID?.trim() || "ws_1";
const e164Arg = opt("--e164") || args.find((a) => a.startsWith("+")) || null;
const phoneNumberIdArg = opt("--phone-number-id") || null;
const apply = flag("--apply");
const doSwitch = flag("--switch");

const { publishReceptionist, getReceptionistState } = await import(
  "../lib/server/receptionist/agent-service.ts"
);
const { ensureWorkspaceReceptionistAgent, loadDraftFromAgent } = await import(
  "../lib/server/receptionist/agent-store.ts"
);
const { validateReceptionistPublish } = await import("../lib/server/voice-v3/publish-gate.ts");
const { alignEditorConnectionForPublish, newestActiveLiveKitPhoneId } = await import(
  "../lib/server/receptionist/resolve-publish-phone.ts"
);
const { resolveReceptionistByCalledNumber } = await import(
  "../lib/server/receptionist/routing-resolve.ts"
);
const { getReceptionistReadiness } = await import(
  "../lib/server/receptionist/readiness-service.ts"
);
const { switchNumberToProduct } = await import("../lib/server/telephony/switch-product.ts");
const { RECEPTIONIST_AGENT_TYPE } = await import("../lib/server/receptionist/constants.ts");
const { readTelephonyProvision } = await import("../lib/server/telephony/telephony-record.ts");
const { resolveNativeVoiceV3LiveKitSession } = await import(
  "../lib/server/voice-v3/resolve-livekit-session.ts"
);

const prisma = new PrismaClient();
const BROWSER_TEST_PREFIX =
  process.env.LIVEKIT_BROWSER_TEST_ROOM_PREFIX?.trim() || "transovo-browser-test-";

function normalizeE164(phone) {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function resolveTargetPhone() {
  if (phoneNumberIdArg) {
    const row = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberIdArg, workspaceId },
      select: { id: true, e164: true, status: true, settingsJson: true },
    });
    if (!row) throw new Error(`phone-number-id ${phoneNumberIdArg} not found in ${workspaceId}`);
    return row;
  }
  if (e164Arg) {
    const e164 = normalizeE164(e164Arg);
    const row = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164, status: "Active" },
      select: { id: true, e164: true, status: true, settingsJson: true },
    });
    if (!row) throw new Error(`Active phone ${e164} not found for workspace ${workspaceId}`);
    return row;
  }
  const ingressId = await newestActiveLiveKitPhoneId(workspaceId);
  if (!ingressId) {
    throw new Error("No --e164 / --phone-number-id and no newest active livekit_sip phone in workspace");
  }
  const row = await prisma.phoneNumber.findFirst({
    where: { id: ingressId, workspaceId },
    select: { id: true, e164: true, status: true, settingsJson: true },
  });
  if (!row) throw new Error(`Ingress phone id ${ingressId} missing`);
  return row;
}

async function collectSnapshot(workspaceId, agentId, targetPhoneId, targetE164) {
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: {
      id: true,
      status: true,
      phoneNumberId: true,
      publishedVersionId: true,
      emergencyDisabled: true,
    },
  });
  const draftAgent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const draftEnvelope = loadDraftFromAgent(draftAgent);
  const connectionId =
    draftEnvelope.editor.connection?.kind === "owned"
      ? draftEnvelope.editor.connection.id?.trim() || null
      : null;

  const assignment = await prisma.voiceAgentPhoneNumber.findFirst({
    where: { agentId, phoneNumberId: targetPhoneId },
  });
  const routing = await prisma.workspaceCallRouting.findUnique({ where: { workspaceId } });
  const policy =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? routing.policyJson
      : null;
  const policyNumberId = policy && typeof policy.numberId === "string" ? policy.numberId : null;

  const resolve = targetE164 ? await resolveReceptionistByCalledNumber(targetE164) : null;

  const targetPhone = await prisma.phoneNumber.findFirst({
    where: { id: targetPhoneId },
    select: { settingsJson: true },
  });
  const prov = readTelephonyProvision(targetPhone?.settingsJson);

  return {
    agent: agent || null,
    draftConnectionPhoneId: connectionId,
    voiceAgentPhoneNumber: assignment
      ? {
          inboundEnabled: assignment.inboundEnabled,
          isDefault: assignment.isDefault,
        }
      : null,
    policyNumberId,
    providerSyncStatus: routing?.providerSyncStatus ?? null,
    telephony: {
      routingMode: prov.routingMode,
      state: prov.state,
      lastProvisionedAt: prov.lastProvisionedAt ?? null,
    },
    resolveReceptionist: resolve,
  };
}

function assertInvariants(label, snap, targetPhoneId, targetE164) {
  const failures = [];
  const { agent, draftConnectionPhoneId, voiceAgentPhoneNumber, policyNumberId, resolveReceptionist } =
    snap;

  if (!agent) failures.push(`${label}: receptionist agent row missing`);
  if (draftConnectionPhoneId !== targetPhoneId) {
    failures.push(
      `${label}: draft connection id ${draftConnectionPhoneId ?? "null"} !== target ${targetPhoneId}`,
    );
  }
  if (agent?.phoneNumberId !== targetPhoneId) {
    failures.push(
      `${label}: voiceAgent.phoneNumberId ${agent?.phoneNumberId ?? "null"} !== target ${targetPhoneId}`,
    );
  }
  if (!voiceAgentPhoneNumber?.inboundEnabled) {
    failures.push(`${label}: voiceAgentPhoneNumber missing or inboundEnabled=false`);
  }
  if (policyNumberId !== targetPhoneId) {
    failures.push(
      `${label}: workspaceCallRouting.policyJson.numberId ${policyNumberId ?? "null"} !== target ${targetPhoneId}`,
    );
  }
  if (!resolveReceptionist) {
    failures.push(`${label}: resolveReceptionistByCalledNumber(${targetE164}) returned null`);
  } else if (resolveReceptionist.agentId !== agent?.id) {
    failures.push(`${label}: resolve agentId mismatch`);
  } else if (resolveReceptionist.phoneNumberId !== targetPhoneId) {
    failures.push(`${label}: resolve phoneNumberId mismatch`);
  }
  if (!agent?.publishedVersionId) {
    failures.push(`${label}: agent has no publishedVersionId (inbound PSTN will 500)`);
  }
  if (agent?.status !== "ACTIVE" && agent?.status !== "TESTING") {
    failures.push(`${label}: agent status is ${agent?.status} (expected ACTIVE or TESTING)`);
  }

  return failures;
}

async function simulateBootstrapAfterPublish(workspaceId, agentId) {
  const roomName = `${BROWSER_TEST_PREFIX}publish-pipeline-sim-${Date.now()}`;
  try {
    const result = await resolveNativeVoiceV3LiveKitSession({
      roomName,
      workspaceId,
      agentId,
      bootstrapPath: "livekit_sip",
    });
    return {
      ok: true,
      liveSessionId: result.liveSessionId,
      agentId: result.agentId,
      configSource: result.configSource,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry_run",
  workspaceId,
  switchRequested: doSwitch,
  steps: [],
};

let exitCode = 0;

try {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }

  const targetPhone = await resolveTargetPhone();
  const targetE164 = targetPhone.e164;
  const targetPhoneId = targetPhone.id;

  report.target = {
    phoneNumberId: targetPhoneId,
    e164: targetE164,
    telephony: readTelephonyProvision(targetPhone.settingsJson),
  };

  const agentRow = await ensureWorkspaceReceptionistAgent(workspaceId);
  report.agentId = agentRow.id;

  report.before = await collectSnapshot(workspaceId, agentRow.id, targetPhoneId, targetE164);
  report.steps.push({ step: "before_snapshot", ok: true });

  if (doSwitch) {
    if (!apply) {
      report.steps.push({
        step: "switch_product",
        skipped: true,
        reason: "Pass --apply with --switch to run switchNumberToProduct (Telnyx/LiveKit mutations)",
      });
    } else {
      const sw = await switchNumberToProduct({
        workspaceId,
        phoneNumberId: targetPhoneId,
        targetProduct: "receptionist",
        confirmSwitch: true,
        agentId: agentRow.id,
        ingressStrategy: "shared_voice",
      });
      report.steps.push({ step: "switch_product", ok: sw.ok, result: sw });
      if (!sw.ok) {
        exitCode = 1;
        throw new Error(sw.error || "switch failed");
      }
    }
  }

  const readiness = await getReceptionistReadiness(workspaceId);
  report.steps.push({
    step: "readiness",
    canPublish: readiness.canPublish,
    publishBlockers: readiness.publishBlockers,
    inboundPhoneNumberId: readiness.inboundPhoneNumberId,
  });

  const state = await getReceptionistState(workspaceId);
  const agentForDraft = await ensureWorkspaceReceptionistAgent(workspaceId);
  const draftEnvelope = loadDraftFromAgent(agentForDraft);
  const alignedEditor = await alignEditorConnectionForPublish(workspaceId, draftEnvelope.editor);
  const wouldRealign =
    JSON.stringify(alignedEditor.connection) !== JSON.stringify(draftEnvelope.editor.connection);

  report.steps.push({
    step: "align_editor_for_publish",
    wouldRealignDraftConnection: wouldRealign,
    alignedConnection:
      alignedEditor.connection?.kind === "owned" ? alignedEditor.connection.id : null,
    targetPhoneId,
  });

  const editorForValidation = wouldRealign ? alignedEditor : draftEnvelope.editor;
  const validation = await validateReceptionistPublish(workspaceId, editorForValidation);
  report.steps.push({ step: "validate_publish", ok: validation.ok, errors: validation.errors });

  if (!validation.ok) {
    exitCode = 1;
  }

  if (apply && validation.ok) {
    const pub = await publishReceptionist(workspaceId);
    report.steps.push({ step: "publish_receptionist", ok: pub.ok, errors: pub.errors });
    if (!pub.ok) {
      exitCode = 1;
    }
  } else if (!apply) {
    report.steps.push({
      step: "publish_receptionist",
      skipped: true,
      reason: "Pass --apply to call publishReceptionist (same as Publish button)",
    });
  }

  report.after = await collectSnapshot(workspaceId, agentRow.id, targetPhoneId, targetE164);
  report.steps.push({ step: "after_snapshot", ok: true });

  const assertionLabel = apply && validation.ok ? "after_publish" : "current_state";
  const failures = assertInvariants(
    assertionLabel,
    report.after,
    targetPhoneId,
    targetE164,
  );

  if (apply && validation.ok && report.steps.find((s) => s.step === "publish_receptionist")?.ok) {
    const boot = await simulateBootstrapAfterPublish(workspaceId, agentRow.id);
    report.steps.push({ step: "worker_bootstrap_smoke", ...boot });
    if (!boot.ok) failures.push(`worker_bootstrap_smoke: ${boot.error}`);
  }

  report.assertions = { ok: failures.length === 0, failures };
  if (failures.length > 0) exitCode = 1;

  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  report.fatal = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify(report, null, 2));
  exitCode = exitCode || 1;
} finally {
  await prisma.$disconnect();
}

process.exit(exitCode);
