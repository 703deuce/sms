import type { SIPDispatchRuleInfo, SIPInboundTrunkInfo } from "livekit-server-sdk";
import { getLiveKitSipHost, getLiveKitSipHostSource } from "../config";
import { getLiveKitSipClient } from "./client";

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

export async function inspectLiveKitSipRouting(e164: string): Promise<LiveKitSipInspectResult> {
  const client = getLiveKitSipClient();
  const trunks = (await client.listSipInboundTrunk()).map(snapshotTrunk);
  const dispatchRules = (await client.listSipDispatchRule()).map(snapshotDispatch);

  const trunkContainingDid = trunks.find((t) => t.numbers.includes(e164)) || null;

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
  if (!inspect.trunkContainingDid.numbers.includes(e164)) {
    issues.push("trunk_missing_explicit_did");
  }
  if (inspect.trunkContainingDid.allowedAddresses.length > 0) {
    issues.push("trunk_has_ip_allowlist");
  }
  if (inspect.dispatchRulesForTrunk.length === 0) {
    issues.push("no_dispatch_rule_for_trunk");
  }
  const duplicateOwners = inspect.trunks.filter((t) => t.numbers.includes(e164));
  if (duplicateOwners.length > 1) issues.push("duplicate_trunk_for_did");
  return issues;
}
