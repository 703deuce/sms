/**
 * Phase 54 — controlled LiveKit cutover for +15717491060 → transovo-voice-v3.
 *
 * Steps (incremental, read-back after each mutation):
 *   record | trunk | dispatch | telnyx | verify
 *
 * Run on production web container with App 2 LiveKit creds overlaid:
 *   PHONE_E164=+15717491060 STEP=record \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/cutover-571-livekit-v3-phase54.ts
 */
import { writeFileSync } from "node:fs";
import { ListUpdate } from "@livekit/protocol";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleIndividual,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
  resolveTelnyxIngressLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";
import { getLiveKitSipClient } from "../src/lib/telephony/provisioning/livekit/client";
import {
  dispatchRuleNameForDid,
  findDidDispatchRuleByName,
} from "../src/lib/telephony/provisioning/livekit/dispatch-snapshot-sync";
import { liveKitDidLookupVariants, toLiveKitInboundDid } from "../src/lib/telephony/provisioning/livekit/did";
import { inspectLiveKitSipRouting } from "../src/lib/telephony/provisioning/livekit/inspect";
import {
  addNumberToInboundTrunk,
  dedupeInboundTrunkNumber,
} from "../src/lib/telephony/provisioning/livekit/trunk";
import {
  ensureTelnyxLiveKitFqdnConnection,
  findFqdnConnectionByName,
  routeTelnyxNumberToConnection,
} from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const E164 = (process.env.PHONE_E164 || "+15717491060").trim();
const TRUNK_ID = (process.env.LIVEKIT_INBOUND_TRUNK_ID || "ST_MqBTBjwPieAv").trim();
const V3_AGENT =
  process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";
const STEP = (process.env.STEP || "all").trim().toLowerCase();
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ phase: "54", event, e164: E164, ...payload }));
}

async function recordState(): Promise<Record<string, unknown>> {
  const inspect = await inspectLiveKitSipRouting(E164);
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164, "page[size]": 1 } },
  );
  const pn = listed.data?.[0];
  const fqdnConn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const ingress = resolveTelnyxIngressLiveKitSipHost();
  const voiceCtr = process.env.VOICE_APP_IMAGE || null;
  return {
    recordedAtUtc: new Date().toISOString(),
    gitSha: process.env.CUTOVER_GIT_SHA || null,
    voiceAppImage: voiceCtr,
    trunkId: TRUNK_ID,
    v3Agent: V3_AGENT,
    livekit: inspect,
    telnyx: {
      connection_id: pn?.connection_id,
      connection_name: pn?.connection_name,
      status: pn?.status,
      livekitFqdnConnectionId: fqdnConn?.id,
      livekitFqdnConnectionName: fqdnConn?.connection_name || TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
      ingressHost: ingress.host,
    },
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  };
}

async function stepTrunk(): Promise<void> {
  await dedupeInboundTrunkNumber(E164, TRUNK_ID);
  const { trunk, added } = await addNumberToInboundTrunk(TRUNK_ID, E164);
  const inspect = await inspectLiveKitSipRouting(E164);
  const owns =
    inspect.trunkContainingDid?.id === TRUNK_ID &&
    (inspect.trunkContainingDid?.numbers || []).some((n) =>
      liveKitDidLookupVariants(E164).includes(n),
    );
  log("trunk_patch", {
    added,
    trunkNumbers: trunk.numbers,
    livekitTrunkOwnsDid: owns ? "YES" : "NO",
  });
  if (!owns) {
    throw new Error("Boundary A: LIVEKIT TRUNK OWNS +15717491060 = NO");
  }
}

const LEGACY_866_E164 = (process.env.LEGACY_866_E164 || "+18663464256").trim();

const LEGACY_DISPATCH_RULE_ID = "SDR_VjjkrrgEjiR3";

async function createCalleeDispatchRule(input: {
  name: string;
  numbers: string[];
  agentName: string;
  agentMetadata: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const client = getLiveKitSipClient();
  const roomPrefix =
    TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const ruleInfo = new SIPDispatchRuleInfo({
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleCallee",
        value: new SIPDispatchRuleCallee({
          roomPrefix,
          randomize: true,
        }),
      },
    }),
    trunkIds: [TRUNK_ID],
    numbers: input.numbers,
    hidePhoneNumber: false,
    name: input.name,
    metadata: JSON.stringify(input.metadata),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: input.agentName,
          metadata: input.agentMetadata,
        }),
      ],
    }),
  });

  const created = await client.createSipDispatchRule(
    { type: "callee", roomPrefix, randomize: true },
    {
      name: input.name,
      trunkIds: [TRUNK_ID],
      hidePhoneNumber: false,
      metadata: ruleInfo.metadata,
      roomConfig: ruleInfo.roomConfig,
    },
  );
  const createdId = created.sipDispatchRuleId || "";
  if (!createdId) throw new Error(`dispatch rule id missing after create (${input.name})`);
  ruleInfo.sipDispatchRuleId = createdId;
  const updated = await client.updateSipDispatchRule(createdId, ruleInfo);
  return updated.sipDispatchRuleId || createdId;
}

/**
 * LiveKit Cloud rejects a second per-DID rule while a trunk-wide rule exists.
 * Replace the legacy shared rule with two callee-scoped rules (866 legacy, 571 V3).
 */
async function replaceSharedDispatchWithScopedRules(): Promise<{
  legacyRuleId: string;
  v3RuleId: string;
}> {
  const client = getLiveKitSipClient();
  const rules = await client.listSipDispatchRule();
  const shared =
    rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME) ||
    rules.find((r) => r.sipDispatchRuleId === LEGACY_DISPATCH_RULE_ID) ||
    null;

  const legacyAgent =
    shared?.roomConfig?.agents?.[0]?.agentName || TRANSOVO_LIVEKIT_AGENT_NAME;
  const legacyMeta = shared?.roomConfig?.agents?.[0]?.metadata || "";

  if (shared?.sipDispatchRuleId) {
    await client.deleteSipDispatchRule(shared.sipDispatchRuleId);
    log("deleted_shared_dispatch", { ruleId: shared.sipDispatchRuleId });
  }

  const legacyNumbers = [
    ...new Set(liveKitDidLookupVariants(LEGACY_866_E164).map(toLiveKitInboundDid)),
  ];
  const legacyRuleId = await createCalleeDispatchRule({
    name: TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
    numbers: legacyNumbers,
    agentName: legacyAgent,
    agentMetadata: legacyMeta,
    metadata: {
      owner: "transovo",
      kind: "shared_inbound_dispatch",
      numbers: legacyNumbers,
    },
  });

  const v3Numbers = [
    ...new Set(liveKitDidLookupVariants(E164).map(toLiveKitInboundDid)),
  ];
  const v3RuleId = await createCalleeDispatchRule({
    name: dispatchRuleNameForDid(E164),
    numbers: v3Numbers,
    agentName: V3_AGENT,
    agentMetadata: JSON.stringify({
      runtime: "voice_v3_gpt_live",
      resolve: "http_backend_on_sip",
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      toE164: E164,
      dispatchSource: "phase54_cutover",
    }),
    metadata: {
      owner: "transovo",
      kind: "did_dispatch_voice_v3",
      e164: toLiveKitInboundDid(E164),
      agentId: AGENT_ID,
      workspaceId: WORKSPACE_ID,
      livekitAgent: V3_AGENT,
    },
  });

  log("replaced_shared_dispatch", {
    legacyRuleId,
    v3RuleId,
    legacyNumbers,
    v3Numbers,
    legacyAgent,
    v3Agent: V3_AGENT,
  });
  return { legacyRuleId, v3RuleId };
}

/**
 * LiveKit Cloud did not honor per-DID `numbers` scoping on this trunk (list API + create conflicts).
 * Narrowest working cutover: point the existing trunk dispatch rule at `transovo-voice-v3`.
 * V3 resolves agent config by dialed E.164 at runtime (571 cert path).
 */
async function stepDispatch(): Promise<void> {
  const client = getLiveKitSipClient();
  const rules = await client.listSipDispatchRule();
  const trunkRule =
    rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME) ||
    rules.find((r) => (r.trunkIds || []).includes(TRUNK_ID)) ||
    null;
  if (!trunkRule?.sipDispatchRuleId) {
    throw new Error("Boundary A: no dispatch rule for inbound trunk");
  }

  const roomPrefix =
    TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call-";
  const ruleInfo = new SIPDispatchRuleInfo({
    sipDispatchRuleId: trunkRule.sipDispatchRuleId,
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleIndividual",
        value: new SIPDispatchRuleIndividual({
          roomPrefix: `${roomPrefix}-`,
          pin: "",
          noRandomness: false,
        }),
      },
    }),
    trunkIds: trunkRule.trunkIds || [TRUNK_ID],
    numbers: trunkRule.numbers || [],
    hidePhoneNumber: trunkRule.hidePhoneNumber ?? false,
    name: trunkRule.name || TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
    metadata:
      trunkRule.metadata ||
      JSON.stringify({ owner: "transovo", kind: "phase54_v3_trunk_dispatch" }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: V3_AGENT,
          metadata: JSON.stringify({
            runtime: "voice_v3_gpt_live",
            resolve: "http_backend_on_sip",
            workspaceId: WORKSPACE_ID,
            agentId: AGENT_ID,
            toE164: E164,
            dispatchSource: "phase54_cutover",
          }),
        }),
      ],
    }),
  });

  const updated = await client.updateSipDispatchRule(trunkRule.sipDispatchRuleId, ruleInfo);
  const trunkNumbers = [
    ...new Set([
      ...liveKitDidLookupVariants(LEGACY_866_E164).map(toLiveKitInboundDid),
      ...liveKitDidLookupVariants(LEGACY_866_E164).map((n) => n.replace(/^\+/, "")),
      ...liveKitDidLookupVariants(E164).map(toLiveKitInboundDid),
      ...liveKitDidLookupVariants(E164).map((n) => n.replace(/^\+/, "")),
    ]),
  ];
  await client.updateSipInboundTrunkFields(TRUNK_ID, {
    numbers: new ListUpdate({ set: trunkNumbers }),
  });
  const ruleId = updated.sipDispatchRuleId || trunkRule.sipDispatchRuleId;
  const agentOk = updated.roomConfig?.agents?.[0]?.agentName === V3_AGENT;

  const inspect = await inspectLiveKitSipRouting(E164);
  log("dispatch", {
    ruleId,
    ruleName: updated.name,
    agent: updated.roomConfig?.agents?.[0]?.agentName,
    v3Dispatch: agentOk ? "YES" : "NO",
    dispatchRulesForTrunk: inspect.dispatchRulesForTrunk,
    note:
      "Trunk-wide V3 dispatch (LiveKit per-DID split blocked). 866 also dispatches to V3 until follow-up split.",
  });
  if (!agentOk) {
    throw new Error("Boundary A: V3 dispatch rule agent mismatch");
  }
}

async function stepTelnyx(): Promise<void> {
  const before = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164, "page[size]": 1 } },
  );
  const beforePn = before.data?.[0];
  const { connectionId } = await ensureTelnyxLiveKitFqdnConnection();
  const route = await routeTelnyxNumberToConnection({
    e164: E164,
    connectionId,
  });
  const after = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164, "page[size]": 1 } },
  );
  const afterPn = after.data?.[0];
  const fqdnConn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const ingress = resolveTelnyxIngressLiveKitSipHost();
  const connId = String(afterPn?.connection_id || "");
  const onLiveKit = connId === String(fqdnConn?.id || connectionId);
  log("telnyx_route", {
    previousConnectionId: route.previousConnectionId,
    beforeConnection: beforePn?.connection_name,
    afterConnection: afterPn?.connection_name,
    afterConnectionId: afterPn?.connection_id,
    onLiveKitConnection: onLiveKit ? "YES" : "NO",
    ingressHost: ingress.host,
  });
  if (!onLiveKit) {
    throw new Error("Boundary A: Telnyx not on LiveKit Inbound connection");
  }
}

async function main() {
  // Web app defaults to self_hosted; cutover must use LiveKit Cloud (App 2 project).
  process.env.MEDIA_BACKEND_MODE = "livekit_cloud";

  const steps = STEP === "all"
    ? ["record", "trunk", "dispatch", "telnyx", "verify"]
    : STEP.split(",").map((s) => s.trim());

  if (steps.includes("record")) {
    const state = await recordState();
    log("pre_cutover_state", { state });
    const out =
      process.env.CUTOVER_STATE_OUT ||
      `/tmp/phase54-pre-cutover-${E164.replace(/\D/g, "")}.json`;
    writeFileSync(out, JSON.stringify(state, null, 2));
    log("state_written", { path: out });
  }

  if (steps.includes("trunk")) await stepTrunk();
  if (steps.includes("dispatch")) await stepDispatch();
  if (steps.includes("telnyx")) await stepTelnyx();

  if (steps.includes("verify")) {
    const { execSync } = await import("node:child_process");
    execSync("npx tsx scripts/verify-571-livekit-callable.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        PHONE_E164: E164,
        NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
      },
    });
  }

  log("done", { steps });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
