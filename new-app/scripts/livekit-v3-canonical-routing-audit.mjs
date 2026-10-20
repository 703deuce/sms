/**
 * Inspect LiveKit SIP trunks + dispatch rules; optionally prune obsolete per-DID rules.
 *
 *   cd new-app && npx tsx scripts/livekit-v3-canonical-routing-audit.mjs
 *   LIVEKIT_V3_ROUTING_RESET_ACK=1 npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply
 */
import {
  ensureCanonicalV3SharedDispatchRule,
  isObsoletePerDidDispatchRuleName,
  pruneObsoleteDispatchRules,
} from "../lib/server/receptionist/livekit/canonical-dispatch.ts";
import { getLiveKitSipClient, VOICE_V3_LIVEKIT_AGENT_NAME } from "../lib/server/receptionist/livekit/client.ts";
import {
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
} from "../lib/server/telephony/config.ts";

const apply = process.argv.includes("--apply");
const livekitUrl = process.env.LIVEKIT_URL?.trim() || "";

const client = getLiveKitSipClient();
const trunks = await client.listSipInboundTrunk();
const rules = await client.listSipDispatchRule();

console.log("=== LiveKit project ===");
console.log({ livekitUrl, expectedWorker: VOICE_V3_LIVEKIT_AGENT_NAME });

console.log("\n=== Inbound trunks (not deleted by this tool) ===");
for (const t of trunks) {
  console.log({
    id: t.sipTrunkId,
    name: t.name,
    numbers: t.numbers?.length ?? 0,
    sample: (t.numbers || []).slice(0, 5),
  });
}

console.log("\n=== Dispatch rules ===");
for (const r of rules) {
  const ruleCase = r.rule?.rule?.case;
  console.log({
    id: r.sipDispatchRuleId,
    name: r.name,
    trunks: r.trunkIds,
    numbers: r.numbers?.length ? r.numbers : "(trunk-wide)",
    ruleType: ruleCase,
    agent: r.roomConfig?.agents?.[0]?.agentName,
    obsoletePerDid: isObsoletePerDidDispatchRuleName(r.name),
    wouldDeleteOnApply:
      isObsoletePerDidDispatchRuleName(r.name) ||
      (r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME &&
        r.sipDispatchRuleId !==
          rules.find((x) => x.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME)?.sipDispatchRuleId),
  });
}

const canonicalCandidates = rules.filter((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME);
console.log("\n=== Worker linkage check ===");
for (const r of canonicalCandidates) {
  const agent = r.roomConfig?.agents?.[0]?.agentName;
  console.log({
    ruleId: r.sipDispatchRuleId,
    agent,
    ok: agent === VOICE_V3_LIVEKIT_AGENT_NAME,
    ruleType: r.rule?.rule?.case,
  });
}

const keeper =
  trunks.find((t) => t.name === TRANSOVO_LIVEKIT_TRUNK_NAME) || trunks[0];
const trunkId = keeper?.sipTrunkId;
if (!trunkId) {
  console.error("No inbound trunk found — cannot ensure canonical dispatch.");
  process.exit(1);
}

console.log("\n=== Planned changes ===");
const dry = await pruneObsoleteDispatchRules({ dryRun: true });
console.log("Dry-run prune:", dry);
console.log(
  apply
    ? "Mode: APPLY (ensure canonical + prune)"
    : "Mode: inspect only — add --apply after reviewing dry-run above",
);

if (apply) {
  if (process.env.LIVEKIT_V3_ROUTING_RESET_ACK !== "1") {
    console.error(
      "Refusing --apply without LIVEKIT_V3_ROUTING_RESET_ACK=1 (confirms you reviewed dry-run output).",
    );
    process.exit(1);
  }
  const ensured = await ensureCanonicalV3SharedDispatchRule({ trunkId });
  console.log("Ensured:", ensured);
  const pruned = await pruneObsoleteDispatchRules({
    keepRuleId: ensured.ruleId,
    dryRun: false,
  });
  console.log("Prune:", pruned);
}
