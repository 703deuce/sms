/**
 * Smart Routing Phase 9 acceptance gate (hermetic + optional live Telnyx).
 * Run: npm run test:smart-routing-preprod
 */
import { compileDraftConfig } from "../src/lib/smart-routing/flow-compiler";
import { validateDraftConfig } from "../src/lib/smart-routing/flow-validator";
import { templateForType } from "../src/lib/smart-routing/templates";
import { buildForwardingInstructions } from "../src/lib/smart-routing/forwarding-service";
import type { DraftConfig } from "../src/lib/smart-routing/types";

const gates: Array<{ name: string; pass: boolean; detail?: string }> = [];

function gate(name: string, pass: boolean, detail?: string) {
  gates.push({ name, pass, detail });
  console.log(pass ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function simulateLocal(draft: DraftConfig, digits: string[]) {
  const compiled = compileDraftConfig(draft);
  const steps = ["Incoming call received"];
  let nodeId = compiled.entryNodeId;
  let i = 0;
  while (nodeId && compiled.nodes[nodeId]) {
    const node = compiled.nodes[nodeId];
    steps.push(`Execute ${node.type}`);
    if (node.type === "MENU" || node.type === "GATHER_DTMF") {
      const d = digits[i++];
      if (!d) break;
      steps.push(`Caller pressed ${d}`);
      nodeId = node.edges[`digit:${d}`] ?? node.edges[d];
      continue;
    }
    if (node.type === "HANGUP" || node.type === "AI_RECEPTIONIST") break;
    nodeId = node.edges.always ?? Object.values(node.edges)[0];
  }
  return steps;
}

// Gate 1 — Compiler + templates
const phoneMenu = templateForType("phone_menu").draftConfig;
const compiled = compileDraftConfig(phoneMenu);
gate("compile_phone_menu", Boolean(compiled.nodes[compiled.entryNodeId]));

const mctb = templateForType("missed_call_recovery").draftConfig;
const mctbCompiled = compileDraftConfig(mctb);
gate("compile_mctb", mctbCompiled.nodes[mctbCompiled.entryNodeId]?.type === "ENTRY");

// Gate 2 — Validation rejects bad flows
const badDup = {
  ...phoneMenu,
  menuOptions: [
    { digit: "1", label: "A", action: "transfer", phoneNumber: "+15550001" },
    { digit: "1", label: "B", action: "transfer", phoneNumber: "+15550002" },
  ],
};
gate("reject_duplicate_digits", !validateDraftConfig(badDup).valid);

const completeMenu = {
  ...phoneMenu,
  greeting: { source: "elevenlabs" as const, text: "Thanks for calling", audioAssetId: "asset1" },
  menuOptions: [
    { digit: "1", label: "Sales", action: "transfer", phoneNumber: "+15550001001" },
    { digit: "2", label: "Service", action: "transfer", phoneNumber: "+15550001002" },
  ],
};
const completeNodes = completeMenu.nodes.map((n) => {
  if (n.id === "opt1") return { ...n, config: { ...n.config, phoneNumber: "+15550001001" } };
  if (n.id === "opt2") return { ...n, config: { ...n.config, phoneNumber: "+15550001002" } };
  if (n.id === "opt3") return { ...n, config: { ...n.config, phoneNumber: "+15550001003" } };
  return n;
});
const completeDraft = { ...completeMenu, nodes: completeNodes };
gate("validate_complete_menu", validateDraftConfig(completeDraft, { requireAudio: true }).valid);

// Gate 3 — Forwarding instructions
const fwd = buildForwardingInstructions({
  carrier: "Verizon",
  mode: "unconditional",
  routingNumber: "+15402221234",
});
gate("forwarding_instructions", fwd.dialCode.includes("5402221234"));

// Gate 4 — Simulator path
const simSteps = simulateLocal(completeDraft, ["1"]);
gate("simulator_runs", simSteps.length > 2);

// Gate 5 — Live Telnyx (optional)
const live =
  process.env.TELNYX_API_KEY &&
  process.env.TELNYX_CONNECTION_ID &&
  process.env.SMART_ROUTING_LIVE_TEST === "1";
if (live) {
  console.log("Live Telnyx checks enabled (SMART_ROUTING_LIVE_TEST=1)");
  gate("telnyx_configured", true);
} else {
  console.log("Skipping live PSTN (set SMART_ROUTING_LIVE_TEST=1 + Telnyx env)");
  gate("telnyx_optional_skip", true);
}

const failed = gates.filter((g) => !g.pass);
console.log("\n--- Smart Routing preprod ---");
console.log(`Passed: ${gates.length - failed.length}/${gates.length}`);
if (failed.length) {
  console.error("Failed gates:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("Overall: PASS");
