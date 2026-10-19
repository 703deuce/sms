/**
 * Inspect LiveKit SIP trunks + dispatch rules; optionally prune obsolete per-DID rules.
 *
 *   cd new-app && npx tsx scripts/livekit-v3-canonical-routing-audit.mjs
 *   cd new-app && npx tsx scripts/livekit-v3-canonical-routing-audit.mjs --apply
 */
import {
  ensureCanonicalV3SharedDispatchRule,
  isObsoletePerDidDispatchRuleName,
  pruneObsoleteDispatchRules,
} from "../lib/server/receptionist/livekit/canonical-dispatch.ts";
import { getLiveKitSipClient } from "../lib/server/receptionist/livekit/client.ts";
import { TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME, TRANSOVO_LIVEKIT_TRUNK_NAME } from "../lib/server/telephony/config.ts";

const apply = process.argv.includes("--apply");

const client = getLiveKitSipClient();
const trunks = await client.listSipInboundTrunk();
const rules = await client.listSipDispatchRule();

console.log("=== Inbound trunks ===");
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
  console.log({
    id: r.sipDispatchRuleId,
    name: r.name,
    trunks: r.trunkIds,
    numbers: r.numbers?.length ? r.numbers : "(trunk-wide)",
    agent: r.roomConfig?.agents?.[0]?.agentName,
    obsoletePerDid: isObsoletePerDidDispatchRuleName(r.name),
  });
}

const keeper =
  trunks.find((t) => t.name === TRANSOVO_LIVEKIT_TRUNK_NAME) || trunks[0];
const trunkId = keeper?.sipTrunkId;
if (!trunkId) {
  console.error("No inbound trunk found — cannot ensure canonical dispatch.");
  process.exit(1);
}

console.log("\n=== Canonical rule (ensure) ===");
if (apply) {
  const ensured = await ensureCanonicalV3SharedDispatchRule({ trunkId });
  console.log(ensured);
  const pruned = await pruneObsoleteDispatchRules({
    keepRuleId: ensured.ruleId,
    dryRun: false,
  });
  console.log("Prune:", pruned);
} else {
  const dry = await pruneObsoleteDispatchRules({ dryRun: true });
  console.log("Dry-run prune:", dry);
  console.log(`\nRe-run with --apply to ensure "${TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME}" and delete obsolete rules.`);
}
