import type { SIPDispatchRuleInfo, SIPInboundTrunkInfo } from "livekit-server-sdk";
import { getLiveKitSipHost, getLiveKitSipHostSource } from "../config";
import { trunkNumbersIncludeDid } from "./did";
import { getLiveKitSipClient } from "./client";
import { missingTelnyxSignalingIps } from "./telnyx-allowlist";
import { TELNYX_US_SIGNALING_IPS } from "./telnyx-ips";

export type LiveKitTrunkSnapshot = {
  id: string;
  name: string;
  numbers: string[];
  allowedAddresses: string[];
  hasAuth: boolean;
};

export type LiveKitDispatchSnapshot = {
  id: string;
  name: string;
  trunkIds: string[];
  agentName?: string;
};

export type LiveKitSipInspectResult = {
  sipHost: string;
  sipHostSource: string | null;
  trunks: LiveKitTrunkSnapshot[];
  dispatchRules: LiveKitDispatchSnapshot[];
  trunkContainingDid: LiveKitTrunkSnapshot | null;
  dispatchRulesForTrunk: LiveKitDispatchSnapshot[];
};

function snapshotTrunk(trunk: SIPInboundTrunkInfo): LiveKitTrunkSnapshot {
  const allowed =
    (trunk as { allowedAddresses?: string[] }).allowedAddresses ||
    (trunk as { allowed_addresses?: string[] }).allowed_addresses ||
    [];
  return {
    id: trunk.sipTrunkId || "",
    name: trunk.name || "",
    numbers: trunk.numbers || [],
    allowedAddresses: allowed,
    hasAuth: Boolean((trunk as { authUsername?: string }).authUsername),
  };
}

function snapshotDispatch(rule: SIPDispatchRuleInfo): LiveKitDispatchSnapshot {
  const agents = rule.roomConfig?.agents || [];
  return {
    id: rule.sipDispatchRuleId || "",
    name: rule.name || "",
    trunkIds: rule.trunkIds || [],
    agentName: agents[0]?.agentName || undefined,
  };
}

export function isWildcardTelnyxTrunk(trunk: LiveKitTrunkSnapshot): boolean {
  if ((trunk.numbers || []).length > 0) return false;
  const allowed = new Set(trunk.allowedAddresses || []);
  return TELNYX_US_SIGNALING_IPS.every((ip) => allowed.has(ip));
}

export async function inspectLiveKitSipRouting(e164: string): Promise<LiveKitSipInspectResult> {
  const client = getLiveKitSipClient();
  const trunks = (await client.listSipInboundTrunk()).map(snapshotTrunk);
  const dispatchRules = (await client.listSipDispatchRule()).map(snapshotDispatch);

  const trunkContainingDid =
    trunks.find((t) => trunkNumbersIncludeDid(t.numbers, e164)) ||
    trunks.find((t) => isWildcardTelnyxTrunk(t)) ||
    null;

  const dispatchRulesForTrunk = trunkContainingDid
    ? dispatchRules.filter((r) => (r.trunkIds || []).includes(trunkContainingDid.id))
    : [];

  return {
    sipHost: getLiveKitSipHost(),
    sipHostSource: getLiveKitSipHostSource(),
    trunks,
    dispatchRules,
    trunkContainingDid,
    dispatchRulesForTrunk,
  };
}

export function diagnoseLiveKitSipIssues(
  inspect: LiveKitSipInspectResult,
  e164: string,
): string[] {
  const issues: string[] = [];
  if (!inspect.sipHost) issues.push("sip_host_missing");
  if (!inspect.trunkContainingDid) {
    issues.push("no_trunk_for_did");
    return issues;
  }
  if (
    !trunkNumbersIncludeDid(inspect.trunkContainingDid.numbers, e164) &&
    !isWildcardTelnyxTrunk(inspect.trunkContainingDid)
  ) {
    issues.push("trunk_missing_explicit_did");
  }
  if (inspect.trunkContainingDid.allowedAddresses.length > 0) {
    const missingIps = missingTelnyxSignalingIps(inspect.trunkContainingDid.allowedAddresses);
    if (missingIps.length) {
      issues.push(`telnyx_signaling_ip_missing:${missingIps.join(",")}`);
    }
  }
  if (inspect.dispatchRulesForTrunk.length === 0) {
    const hasGlobalRule = inspect.dispatchRules.some((r) => (r.trunkIds || []).length === 0);
    if (!hasGlobalRule) issues.push("no_dispatch_rule_for_trunk");
  }
  const duplicateOwners = inspect.trunks.filter((t) => trunkNumbersIncludeDid(t.numbers, e164));
  if (duplicateOwners.length > 1) issues.push("duplicate_trunk_for_did");
  return issues;
}
