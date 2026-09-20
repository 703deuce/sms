/**
 * Canonical Telnyx → LiveKit repair for +15717491060 (Phase 54).
 *
 * Follows:
 * - LiveKit inbound trunk with explicit +E.164 numbers (Telnyx provider doc)
 * - allowed_addresses 192.76.120.0/22 (Telnyx×LiveKit quickstart)
 * - Shared dispatch rule scoped to trunk (transovo provisioning)
 * - Telnyx FQDN → project *.sip.livekit.cloud (LiveKit Cloud, not livekit-telnyx.com)
 *
 *   MEDIA_BACKEND_MODE=livekit_cloud PHONE_E164=+15717491060 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/repair-571-livekit-sip-canonical.ts
 */
import { ListUpdate } from "@livekit/protocol";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleIndividual,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import { getPrisma } from "../src/lib/db";
import {
  ensureInboundTrunkForNumber,
  addNumberToInboundTrunk,
} from "../src/lib/telephony/provisioning/livekit/trunk";
import { ensureSharedDispatchRule } from "../src/lib/telephony/provisioning/livekit/dispatch";
import { ensureTelnyxSignalingAllowlist } from "../src/lib/telephony/provisioning/livekit/telnyx-allowlist";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
} from "../src/lib/telephony/provisioning/livekit/inspect";
import { getLiveKitSipClient } from "../src/lib/telephony/provisioning/livekit/client";
import {
  ensureTelnyxLiveKitFqdnConnection,
  routeTelnyxNumberToConnection,
  pruneStaleTelnyxFqdns,
} from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import { liveKitDidLookupVariants } from "../src/lib/telephony/provisioning/livekit/did";

const E164 = (process.env.PHONE_E164 || "+15717491060").trim();
const LEGACY_866 = (process.env.LEGACY_866_E164 || "+18663464256").trim();
const V3_AGENT =
  process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();

async function patchDispatchAgentV3(trunkId: string, ruleId: string) {
  const client = getLiveKitSipClient("livekit_cloud");
  const listed = await client.listSipDispatchRule({ dispatchRuleIds: [ruleId] });
  const rule = listed[0];
  if (!rule?.sipDispatchRuleId) throw new Error(`dispatch rule ${ruleId} not found`);

  const updated = await client.updateSipDispatchRule(
    rule.sipDispatchRuleId,
    new SIPDispatchRuleInfo({
      sipDispatchRuleId: rule.sipDispatchRuleId,
      rule: new SIPDispatchRule({
        rule: {
          case: "dispatchRuleIndividual",
          value: new SIPDispatchRuleIndividual({
            roomPrefix: "transovo-call-",
            pin: "",
            noRandomness: false,
          }),
        },
      }),
      trunkIds: [trunkId],
      hidePhoneNumber: rule.hidePhoneNumber,
      name: rule.name,
      metadata: rule.metadata,
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: V3_AGENT,
            metadata: JSON.stringify({
              runtime: "voice_v3_gpt_live",
              toE164: E164,
              dispatchSource: "repair_571_canonical",
            }),
          }),
        ],
      }),
    }),
  );
  return updated;
}

async function main() {
  process.env.MEDIA_BACKEND_MODE = "livekit_cloud";

  console.log("=== Before ===");
  console.log(JSON.stringify(await inspectLiveKitSipRouting(E164), null, 2));

  const pruned = await pruneStaleTelnyxFqdns();
  console.log("TELNYX_FQDN", pruned);

  const { connectionId, actions: telnyxActions } =
    await ensureTelnyxLiveKitFqdnConnection();
  console.log("TELNYX_CONN", { connectionId, telnyxActions });

  const route = await routeTelnyxNumberToConnection({
    e164: E164,
    connectionId,
  });
  console.log("TELNYX_ROUTE", route);

  const { trunk, actions: trunkActions } = await ensureInboundTrunkForNumber(E164, {
    backend: "livekit_cloud",
  });
  const trunkId = trunk.sipTrunkId || "";
  if (!trunkId) throw new Error("missing trunk id");
  console.log("TRUNK_ENSURE", { trunkId, numbers: trunk.numbers, trunkActions });

  const allow = await ensureTelnyxSignalingAllowlist({
    trunkId,
    backend: "livekit_cloud",
  });
  console.log("ALLOWLIST", allow);

  try {
    const { trunk: trunk866 } = await addNumberToInboundTrunk(trunkId, LEGACY_866);
    console.log("TRUNK_866", { numbers: trunk866.numbers });
  } catch (err) {
    console.warn("TRUNK_866_SKIP", err instanceof Error ? err.message : String(err));
  }

  const { rule, actions: dispatchActions } = await ensureSharedDispatchRule({
    trunkId,
    backend: "livekit_cloud",
  });
  const ruleId = rule.sipDispatchRuleId || "";
  if (!ruleId) throw new Error("missing dispatch rule id");
  console.log("DISPATCH_ENSURE", { ruleId, dispatchActions });

  const dispatch = await patchDispatchAgentV3(trunkId, ruleId);
  console.log("DISPATCH_V3", {
    agent: dispatch.roomConfig?.agents?.[0]?.agentName,
    trunkIds: dispatch.trunkIds,
  });

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: E164, workspaceId: WORKSPACE_ID },
    select: { id: true },
  });
  if (phone?.id) {
    const settings = (phone.settingsJson as Record<string, unknown>) || {};
    const telephony = (settings.telephony as Record<string, unknown>) || {};
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        settingsJson: {
          ...settings,
          telephony: {
            ...telephony,
            routingMode: "livekit_sip",
            state: "active",
            telnyxFqdnConnectionId: connectionId,
            livekitInboundTrunkId: trunkId,
            livekitDispatchRuleId: ruleId,
            lastProvisionedAt: new Date().toISOString(),
            lastError: null,
          },
        },
      },
    });
    console.log("DB_PROVISION", { phoneNumberId: phone.id });
  }

  const after = await inspectLiveKitSipRouting(E164);
  const issues = diagnoseLiveKitSipIssues(after, E164);
  const owns = after.trunkContainingDid?.numbers?.some((n) =>
    liveKitDidLookupVariants(E164).includes(n),
  );
  console.log("=== After ===");
  console.log(JSON.stringify({ after, issues, explicitDidOnTrunk: owns }, null, 2));

  if (!owns) {
    throw new Error("repair failed: trunk missing explicit DID variants");
  }
  const blocking = issues.filter((i) => !i.startsWith("telnyx_signaling_ip_missing"));
  if (blocking.length) {
    throw new Error(`repair issues remain: ${blocking.join(",")}`);
  }
  if (issues.length) {
    console.warn("NON_BLOCKING_ISSUES", issues);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
