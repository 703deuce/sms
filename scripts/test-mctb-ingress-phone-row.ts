import assert from "node:assert/strict";

const WS = "ws_1";
const OWNED_571 = "cmsgtjms84g6l2h0o255w1e3v";
const LINKED_DEMO_571 = "cmte8laci4o021u5q46723128";

function isArchivedIngressRow(settingsJson: Record<string, unknown>): boolean {
  if (settingsJson.archivedPlatformDemoRow === true) return true;
  const role = String(settingsJson.mctbRole || "").toLowerCase();
  if (role === "archived" || role === "platform_demo") return true;
  const telephony = settingsJson.telephony as Record<string, unknown> | undefined;
  return String(telephony?.routingMode || "").toLowerCase() === "archived";
}

assert.equal(
  isArchivedIngressRow({
    archivedPlatformDemoRow: true,
    mctbRole: "archived",
    telephony: { routingMode: "archived" },
  }),
  true,
);

function scoreRoutingMode(mode: string, archived: boolean): number {
  if (archived) return -1000;
  if (mode === "mctb_texml") return 200;
  if (mode === "call_control_event_only") return -500;
  return 0;
}

function pickBest(
  rows: Array<{ id: string; workspaceId: string; routingMode: string; mctbActive: boolean; archived?: boolean }>,
) {
  return rows
    .map((row) => ({
      ...row,
      score: scoreRoutingMode(row.routingMode, Boolean(row.archived)) + (row.mctbActive ? 150 : 0) + 60,
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
  routingMode: "archived",
  mctbActive: true,
  archived: true,
};

const best = pickBest([demoStale, ownedActive]);
assert.equal(best?.id, OWNED_571, "owned mctb_texml row should win over stale archived duplicate");

const demoOnly = pickBest([demoStale]);
assert.ok((demoOnly?.score ?? 0) < 0, "archived-only row should score negative");

console.log("test-mctb-ingress-phone-row: ok");
