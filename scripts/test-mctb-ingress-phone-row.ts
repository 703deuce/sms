import assert from "node:assert/strict";

const WS = "ws_1";
const OWNED_571 = "cmsgtjms84g6l2h0o255w1e3v";
const LINKED_DEMO_571 = "cmte8laci4o021u5q46723128";
const E164_571 = "+15714073615";

function scoreRoutingMode(mode: string): number {
  if (mode === "mctb_texml") return 200;
  if (mode === "call_control_event_only") return -500;
  return 0;
}

function pickBest(
  rows: Array<{ id: string; workspaceId: string; routingMode: string; mctbActive: boolean }>,
) {
  return rows
    .map((row) => ({
      ...row,
      score: scoreRoutingMode(row.routingMode) + (row.mctbActive ? 150 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
}

const ownedActive = {
  id: OWNED_571,
  workspaceId: WS,
  routingMode: "mctb_texml",
  mctbActive: true,
};
const demoStale = {
  id: LINKED_DEMO_571,
  workspaceId: "cmte8la005k0y5g221a68141v",
  routingMode: "call_control_event_only",
  mctbActive: false,
};

const best = pickBest([demoStale, ownedActive]);
assert.equal(best?.id, OWNED_571, "owned mctb_texml row should win over stale demo duplicate");

const demoOnly = pickBest([demoStale]);
assert.equal(demoOnly?.score ?? 0, -500, "stale demo-only row should score negative");

console.log("test-mctb-ingress-phone-row: ok");
