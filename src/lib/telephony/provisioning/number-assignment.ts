import { getPrisma } from "@/lib/db";
import { isLiveKitVoiceRuntime } from "@/lib/voice/runtime-provider/config";
import { syncVoiceAgentPhoneAssignment } from "@/lib/voice/agent-phone";
import { ensureSharedDispatchRule, pruneStaleDispatchRules } from "./livekit/dispatch";
import { syncDidDispatchRuleSnapshot } from "./livekit/dispatch-snapshot-sync";
import { fullResetLiveKitSipIngress } from "./livekit/full-reset";
import { patchInboundTrunkE164Formats } from "./livekit/patch-trunk-e164";
import {
  ensureInboundTrunkForNumber,
  rebuildInboundTrunkForNumber,
} from "./livekit/trunk";
import {
  ensureLiveKitOutboundTrunk,
  resolvePlatformOutboundTrunkId,
} from "./livekit/outbound-trunk";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
  isWildcardTelnyxTrunk,
  type LiveKitSipInspectResult,
} from "./livekit/inspect";
import { trunkNumbersIncludeDid } from "./livekit/did";
import {
  buildExplicitDispatchMetadata,
  explicitDispatchPatchForPhoneSettings,
} from "./dispatch-metadata";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { livekitProfileFromConfig } from "@/lib/voice/frontdesk/agent-config";
import { getLiveKitAgentTemplateFromAdvanced } from "@/lib/voice/templates/agent-template-config";
import {
  ensureTelnyxLiveKitFqdnConnection,
  routeTelnyxNumberToConnection,
} from "./telnyx/sip-connection";
import { resolveAgentByCalledNumber } from "./agent-routing";
import type {
  AssignNumberToAgentInput,
  AssignNumberToAgentResult,
  EnsureNumberProvisionedInput,
  EnsureNumberProvisionedResult,
  TelephonyProvisionRecord,
  VerifyRoutingResult,
  VoiceRoutingMode,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readProvision(settingsJson: unknown): TelephonyProvisionRecord {
  const settings = asRecord(settingsJson) || {};
  const prov = asRecord(settings.telephony) || asRecord(settings.provisioning) || {};
  return {
    routingMode: prov.routingMode as VoiceRoutingMode | undefined,
    state: prov.state as TelephonyProvisionRecord["state"],
    telnyxFqdnConnectionId: prov.telnyxFqdnConnectionId
      ? String(prov.telnyxFqdnConnectionId)
      : undefined,
    telnyxFqdnId: prov.telnyxFqdnId ? String(prov.telnyxFqdnId) : undefined,
    livekitInboundTrunkId: prov.livekitInboundTrunkId
      ? String(prov.livekitInboundTrunkId)
      : undefined,
    livekitDispatchRuleId: prov.livekitDispatchRuleId
      ? String(prov.livekitDispatchRuleId)
      : undefined,
    livekitDidDispatchRuleId: prov.livekitDidDispatchRuleId
      ? String(prov.livekitDidDispatchRuleId)
      : undefined,
    livekitOutboundTrunkId: prov.livekitOutboundTrunkId
      ? String(prov.livekitOutboundTrunkId)
      : undefined,
    lastProvisionedAt: prov.lastProvisionedAt ? String(prov.lastProvisionedAt) : undefined,
    lastVerifiedAt: prov.lastVerifiedAt ? String(prov.lastVerifiedAt) : undefined,
    lastError: prov.lastError != null ? String(prov.lastError) : null,
  };
}

async function writeProvision(
  phoneNumberId: string,
  patch: TelephonyProvisionRecord,
): Promise<TelephonyProvisionRecord> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: { settingsJson: true },
  });
  const settings = asRecord(row?.settingsJson) || {};
  const prev = readProvision(settings);
  const next: TelephonyProvisionRecord = {
    ...prev,
    ...patch,
    lastProvisionedAt: patch.lastProvisionedAt || new Date().toISOString(),
  };
  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      settingsJson: {
        ...settings,
        telephony: next,
      } as object,
    },
  });
  return next;
}

function resolveRoutingMode(explicit?: VoiceRoutingMode): VoiceRoutingMode {
  if (explicit) return explicit;
  return isLiveKitVoiceRuntime() ? "livekit_sip" : "telnyx_assistant";
}

async function buildDispatchMetadataForAgent(input: {
  workspaceId: string;
  agentId: string;
  toE164: string;
  publishedVersionId?: string | null;
  publishedConfig?: import("@/lib/voice/types").VoiceAgentConfig;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { publishedVersionId: true, draftConfig: true, name: true },
  });
  let config = input.publishedConfig;
  if (!config) {
    if (input.publishedVersionId || agent?.publishedVersionId) {
      const versionId = input.publishedVersionId || agent?.publishedVersionId;
      const ver = versionId
        ? await prisma.voiceAgentVersion.findFirst({
            where: { id: versionId, workspaceId: input.workspaceId },
            select: { config: true },
          })
        : null;
      config = parseVoiceAgentConfig(ver?.config || agent?.draftConfig);
    } else {
      config = parseVoiceAgentConfig(agent?.draftConfig);
    }
  }
  const { buildPythonRuntimeBootstrapSnapshot } = await import(
    "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot"
  );
  const snapshot = buildPythonRuntimeBootstrapSnapshot(config, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentName: agent?.name || undefined,
  });
  return buildExplicitDispatchMetadata({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId || agent?.publishedVersionId,
    livekitProfile: livekitProfileFromConfig(config.advanced as Record<string, unknown>),
    agentTemplate: getLiveKitAgentTemplateFromAdvanced(
      config.advanced as Record<string, unknown>,
    ),
    toE164: input.toE164,
    dispatchSource: "phone_provision",
    pythonRuntimeBootstrapSnapshot: snapshot,
  });
}

/**
 * Idempotent: ensure shared LiveKit trunk + dispatch + Telnyx FQDN route for one DID.
 */
export async function ensureNumberProvisioned(
  input: EnsureNumberProvisionedInput,
): Promise<EnsureNumberProvisionedResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      routingMode: resolveRoutingMode(input.routingMode),
      provision: {},
      actions: [],
      error: "Phone number not found",
    };
  }

  const routingMode = resolveRoutingMode(input.routingMode);
  const actions: string[] = [];

  if (routingMode === "telnyx_assistant") {
    const provision = await writeProvision(phone.id, {
      routingMode,
      state: "active",
      lastError: null,
    });
    return {
      ok: true,
      phoneNumberId: phone.id,
      e164: phone.e164,
      routingMode,
      provision,
      actions: ["telnyx_assistant_no_livekit_provision"],
    };
  }

  try {
    const { connectionId, fqdnId, actions: telnyxActions } =
      await ensureTelnyxLiveKitFqdnConnection();
    actions.push(...telnyxActions);

    const route = await routeTelnyxNumberToConnection({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
      connectionId,
    });
    if (route.previousConnectionId && route.previousConnectionId !== connectionId) {
      actions.push(`telnyx_rerouted:${route.previousConnectionId}->${connectionId}`);
    } else {
      actions.push("telnyx_route_ok");
    }

    const { trunk, actions: trunkActions } = await ensureInboundTrunkForNumber(phone.e164);
    actions.push(...trunkActions);

    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) throw new Error("LiveKit inbound trunk id missing after ensure");

    const { rule, actions: dispatchActions } = await ensureSharedDispatchRule({
      trunkId,
    });
    actions.push(...dispatchActions);

    let livekitDidDispatchRuleId: string | undefined;
    let explicitDispatchPatch: Record<string, unknown> | undefined;
    if (input.agentId) {
      const dispatchMetadata = await buildDispatchMetadataForAgent({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        toE164: phone.e164,
        publishedVersionId: input.publishedVersionId,
        publishedConfig: input.publishedConfig,
      });
      explicitDispatchPatch = explicitDispatchPatchForPhoneSettings(dispatchMetadata);
      try {
        const synced = await syncDidDispatchRuleSnapshot({
          e164: phone.e164,
          trunkId,
          dispatchMetadata,
        });
        actions.push(...synced.actions);
        livekitDidDispatchRuleId = synced.ruleId;
      } catch (syncErr) {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
        actions.push(`livekit_did_dispatch_snapshot_failed:${msg}`);
        console.error("[telephony] LiveKit did dispatch snapshot sync failed", syncErr);
      }
    }

    let livekitOutboundTrunkId: string | undefined;
    try {
      const { trunk: outboundTrunk, actions: outboundActions } =
        await ensureLiveKitOutboundTrunk({ callerIdE164: phone.e164 });
      actions.push(...outboundActions);
      livekitOutboundTrunkId = outboundTrunk.sipTrunkId || undefined;
    } catch (outboundErr) {
      const msg = outboundErr instanceof Error ? outboundErr.message : String(outboundErr);
      actions.push(`outbound_trunk_skipped:${msg}`);
    }

    const provision = await writeProvision(phone.id, {
      routingMode,
      state: "active",
      telnyxFqdnConnectionId: connectionId,
      telnyxFqdnId: fqdnId,
      livekitInboundTrunkId: trunkId,
      livekitDispatchRuleId: rule.sipDispatchRuleId,
      livekitDidDispatchRuleId,
      livekitOutboundTrunkId,
      lastError: null,
      ...(explicitDispatchPatch || {}),
    });

    return {
      ok: true,
      phoneNumberId: phone.id,
      e164: phone.e164,
      routingMode,
      provision,
      actions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const provision = await writeProvision(phone.id, {
      routingMode,
      state: "error",
      lastError: message,
    });
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      routingMode,
      provision,
      actions,
      error: message,
    };
  }
}

export async function assignNumberToAgent(
  input: AssignNumberToAgentInput,
): Promise<AssignNumberToAgentResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    throw new Error("Phone number not found in workspace");
  }

  await syncVoiceAgentPhoneAssignment({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    phoneNumberId: input.phoneNumberId,
    exclusive: input.exclusive !== false,
  });

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { phoneNumberId: input.phoneNumberId },
  });

  const provision = await ensureNumberProvisioned({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
  });

  return {
    ok: provision.ok,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
    e164: phone.e164,
    provision,
  };
}

export async function verifyNumberRouting(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<VerifyRoutingResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      e164: "",
      routingMode: "unknown",
      issues: ["phone_not_found"],
    };
  }

  const provision = readProvision(phone.settingsJson);
  const routingMode = provision.routingMode || resolveRoutingMode();
  const issues: string[] = [];

  let telnyxConnectionId: string | undefined;
  let telnyxConnectionName: string | undefined;
  let livekitTrunkHasNumber = false;
  const livekitDetails: Partial<VerifyRoutingResult> = {};

  if (phone.providerNumberId) {
    try {
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
      );
      telnyxConnectionId = res.data?.connection_id
        ? String(res.data.connection_id)
        : undefined;
      telnyxConnectionName = res.data?.connection_name
        ? String(res.data.connection_name)
        : undefined;
    } catch {
      issues.push("telnyx_number_lookup_failed");
    }
  }

  if (routingMode === "livekit_sip") {
    try {
      const inspect = await inspectLiveKitSipRouting(phone.e164);
      const trunk = inspect.trunkContainingDid;
      livekitTrunkHasNumber = Boolean(
        trunk &&
          (trunkNumbersIncludeDid(trunk.numbers, phone.e164) ||
            isWildcardTelnyxTrunk(trunk)),
      );
      if (trunk) {
        livekitDetails.livekitTrunkId = trunk.id;
        livekitDetails.livekitTrunkNumbers = trunk.numbers;
      }
      livekitDetails.livekitSipHost = inspect.sipHost;
      if (provision.livekitDispatchRuleId) {
        livekitDetails.livekitDispatchRuleId = provision.livekitDispatchRuleId;
        const rule = inspect.dispatchRules.find(
          (r) => r.id === provision.livekitDispatchRuleId,
        );
        if (rule) {
          livekitDetails.livekitDispatchTrunkIds = rule.trunkIds;
          if (trunk && (rule.trunkIds || []).length > 0 && !rule.trunkIds.includes(trunk.id)) {
            issues.push("dispatch_rule_missing_trunk");
          }
        } else {
          issues.push("dispatch_rule_not_found");
        }
      } else if (
        inspect.dispatchRulesForTrunk.length === 0 &&
        !inspect.dispatchRules.some((r) => (r.trunkIds || []).length === 0)
      ) {
        issues.push("dispatch_rule_missing_trunk");
      }
      issues.push(...diagnoseLiveKitSipIssues(inspect, phone.e164));
      if (!livekitTrunkHasNumber) issues.push("livekit_trunk_missing_number");
      if (provision.telnyxFqdnConnectionId && telnyxConnectionId !== provision.telnyxFqdnConnectionId) {
        issues.push("telnyx_connection_mismatch");
      }
      if (inspect.sipHost && provision.telnyxFqdnId) {
        // FQDN host is validated during provision; surface mismatch in issues only when empty.
      }

      try {
        const outboundTrunkId =
          provision.livekitOutboundTrunkId ||
          (await resolvePlatformOutboundTrunkId({ callerIdE164: phone.e164 }));
        if (!outboundTrunkId) {
          issues.push("livekit_outbound_trunk_missing");
        } else {
          livekitDetails.livekitOutboundTrunkId = outboundTrunkId;
          const { getLiveKitSipClient } = await import("./livekit/client");
          const listed = await getLiveKitSipClient().listSipOutboundTrunk({
            trunkIds: [outboundTrunkId],
          });
          const outbound = listed[0];
          if (!outbound) {
            issues.push("livekit_outbound_trunk_not_found");
          } else if (!trunkNumbersIncludeDid(outbound.numbers || [], phone.e164)) {
            issues.push("livekit_outbound_trunk_missing_caller_id");
          }
        }
      } catch {
        issues.push("livekit_outbound_trunk_lookup_failed");
      }
    } catch {
      issues.push("livekit_trunk_lookup_failed");
    }
  }

  const routing = await resolveAgentByCalledNumber(phone.e164);
  if (!routing) issues.push("no_active_agent_for_number");

  const uniqueIssues = [...new Set(issues)];

  return {
    ok: uniqueIssues.length === 0,
    e164: phone.e164,
    routingMode,
    telnyxConnectionId,
    telnyxConnectionName,
    livekitTrunkHasNumber,
    dbAgentId: routing?.agentId || null,
    issues: uniqueIssues,
    ...livekitDetails,
  };
}

/**
 * Hard repair for SIP 404: rebuild LiveKit inbound trunk + resync dispatch + Telnyx FQDN.
 */
export async function repairLiveKitSipRouting(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId?: string | null;
}): Promise<{
  ok: boolean;
  before: LiveKitSipInspectResult;
  after: LiveKitSipInspectResult;
  provision: EnsureNumberProvisionedResult;
  actions: string[];
}> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    throw new Error("Phone number not found");
  }

  const before = await inspectLiveKitSipRouting(phone.e164);
  const actions: string[] = [];

  const { connectionId, fqdnId, actions: telnyxActions } =
    await ensureTelnyxLiveKitFqdnConnection();
  actions.push(...telnyxActions);

  const route = await routeTelnyxNumberToConnection({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    connectionId,
  });
  actions.push(
    route.previousConnectionId && route.previousConnectionId !== connectionId
      ? `telnyx_rerouted:${route.previousConnectionId}->${connectionId}`
      : "telnyx_route_ok",
  );

  const { trunk, actions: rebuildActions } = await rebuildInboundTrunkForNumber(phone.e164);
  actions.push(...rebuildActions);

  const trunkId = trunk.sipTrunkId || "";
  if (!trunkId) throw new Error("LiveKit inbound trunk id missing after rebuild");

  const { rule, actions: dispatchActions } = await ensureSharedDispatchRule({ trunkId });
  actions.push(...dispatchActions);

  const pruned = await pruneStaleDispatchRules(rule.sipDispatchRuleId);
  actions.push(...pruned.actions);

  return runRepairFinish(
    input,
    phone,
    actions,
    connectionId,
    fqdnId,
    trunkId,
    rule.sipDispatchRuleId,
    before,
  );
}

/**
 * Nuclear ingress reset: wildcard Telnyx trunk + global dispatch (no trunkIds).
 * Use when numbered trunks verify OK but PSTN still gets SIP 404.
 */
export async function fullResetLiveKitSipRouting(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId?: string | null;
}): Promise<{
  ok: boolean;
  before: LiveKitSipInspectResult;
  after: LiveKitSipInspectResult;
  provision: EnsureNumberProvisionedResult;
  actions: string[];
}> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) throw new Error("Phone number not found");

  const before = await inspectLiveKitSipRouting(phone.e164);
  const actions: string[] = [];

  const { connectionId, fqdnId, actions: telnyxActions } =
    await ensureTelnyxLiveKitFqdnConnection();
  actions.push(...telnyxActions);

  const route = await routeTelnyxNumberToConnection({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    connectionId,
  });
  actions.push(
    route.previousConnectionId && route.previousConnectionId !== connectionId
      ? `telnyx_rerouted:${route.previousConnectionId}->${connectionId}`
      : "telnyx_route_ok",
  );

  const reset = await fullResetLiveKitSipIngress(phone.e164);
  actions.push(...reset.actions);

  return runRepairFinish(
    input,
    phone,
    actions,
    connectionId,
    fqdnId,
    reset.trunkId,
    reset.dispatchRuleId,
    before,
  );
}

async function runRepairFinish(
  input: { workspaceId: string; phoneNumberId: string },
  phone: { id: string; e164: string; settingsJson: unknown },
  actions: string[],
  connectionId: string,
  fqdnId: string,
  trunkId: string,
  dispatchRuleId: string | undefined,
  before?: LiveKitSipInspectResult,
): Promise<{
  ok: boolean;
  before: LiveKitSipInspectResult;
  after: LiveKitSipInspectResult;
  provision: EnsureNumberProvisionedResult;
  actions: string[];
}> {
  const prisma = getPrisma();
  const beforeInspect = before ?? (await inspectLiveKitSipRouting(phone.e164));

  await writeProvision(phone.id, {
    routingMode: "livekit_sip",
    state: "active",
    telnyxFqdnConnectionId: connectionId,
    telnyxFqdnId: fqdnId,
    livekitInboundTrunkId: trunkId,
    livekitDispatchRuleId: dispatchRuleId,
    lastError: null,
  });

  const after = await inspectLiveKitSipRouting(phone.e164);
  const verify = await verifyNumberRouting({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  const provision: EnsureNumberProvisionedResult = {
    ok: verify.ok,
    phoneNumberId: phone.id,
    e164: phone.e164,
    routingMode: "livekit_sip",
    provision: readProvision(
      (
        await prisma.phoneNumber.findUnique({
          where: { id: phone.id },
          select: { settingsJson: true },
        })
      )?.settingsJson,
    ),
    actions,
    error: verify.ok ? undefined : verify.issues.join(", "),
  };

  return {
    ok: verify.ok,
    before: beforeInspect,
    after,
    provision,
    actions,
  };
}

/** Emergency: route DID back to Telnyx TeXML assistant so PSTN works while debugging LiveKit SIP. */
export async function restoreTexmlInboundRoute(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
}): Promise<{
  ok: boolean;
  e164: string;
  texmlRoute: Record<string, unknown>;
}> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) throw new Error("Phone number not found");

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent?.telnyxAssistantId) {
    throw new Error("Agent has no Telnyx assistant id — cannot restore TeXML route");
  }

  const { routePhoneToTexmlAssistant } = await import(
    "@/lib/voice/telnyx/texml-direct-route"
  );
  const texmlRoute = await routePhoneToTexmlAssistant({
    e164: phone.e164,
    assistantId: agent.telnyxAssistantId,
    providerNumberId: phone.providerNumberId,
  });

  await writeProvision(phone.id, {
    routingMode: "telnyx_assistant",
    state: "active",
    lastError: null,
  });

  return {
    ok: Boolean(texmlRoute.matched),
    e164: phone.e164,
    texmlRoute: texmlRoute as unknown as Record<string, unknown>,
  };
}

export {
  resolveAgentByCalledNumber,
  resolveAgentRoutingForCall,
  resolveFallbackInboundCalledNumber,
} from "./agent-routing";
export { patchInboundTrunkE164Formats } from "./livekit/patch-trunk-e164";
