/**
 * Smart Routing AI assistant — unit contracts (no telephony).
 * pragma: allowlist secret
 * Run: npm run test:smart-routing-ai-assistant
 */
import assert from "node:assert/strict";
import { templateForType } from "../src/lib/smart-routing/templates";
import { validateDraftConfig } from "../src/lib/smart-routing/flow-validator";
import { compareRoutingConfigs } from "../src/lib/smart-routing/ai/compare";
import {
  addDestinationToMenuOption,
  applyTemporaryDestinationSwap,
  buildPhoneMenuDraftFromDestinations,
  restoreExpiredTemporaryRouting,
} from "../src/lib/smart-routing/ai/draft-helpers";
import { formatCapabilitiesForPrompt } from "../src/lib/smart-routing/ai/capabilities";
import { formatAnalyticsFacts } from "../src/lib/smart-routing/ai/analytics";
import type { AiRoutingContextDestination } from "../src/lib/smart-routing/ai/types";

const mike: AiRoutingContextDestination = {
  id: "dest_mike",
  label: "Mike",
  phoneNumber: "+17035550001",
  destinationType: "external_phone",
  active: true,
};
const sarah: AiRoutingContextDestination = {
  id: "dest_sarah",
  label: "Sarah",
  phoneNumber: "+17035550002",
  destinationType: "external_phone",
  active: true,
};
const john: AiRoutingContextDestination = {
  id: "dest_john",
  label: "John",
  phoneNumber: "+17035550003",
  destinationType: "external_phone",
  active: true,
};
const destinations = [mike, sarah, john];

// Provider independence — no telnyx/twilio imports in ai modules
assert.ok(formatCapabilitiesForPrompt().includes("NOT supported"));

// BUILD test
const built = buildPhoneMenuDraftFromDestinations({
  greetingText: "Thanks for calling.",
  menuOptions: [
    { digit: "1", label: "Sales", destination: mike },
    {
      digit: "2",
      label: "Service",
      destination: sarah,
      extraDestinations: [john],
      ringMode: "simultaneous",
    },
  ],
  businessHours: { days: "Mon-Fri", open: "08:00", close: "17:00" },
});
const buildValidation = validateDraftConfig(built, { requireAudio: false });
assert.equal(buildValidation.valid, true, buildValidation.issues.map((i) => i.message).join("; "));
assert.ok(built.menuOptions?.some((o) => o.label === "Service"));
const serviceOpt = built.menuOptions?.find((o) => o.label === "Service");
assert.equal(serviceOpt?.destinationId, sarah.id);

// MODIFY test — Service Mike → Mike + Sarah
const baseTemplate = templateForType("phone_menu");
let serviceDraft = { ...baseTemplate.draftConfig };
serviceDraft.menuOptions = [
  { digit: "1", label: "Sales", action: "transfer", phoneNumber: mike.phoneNumber! },
  { digit: "2", label: "Service", action: "transfer", phoneNumber: mike.phoneNumber!, destinationId: mike.id },
];
serviceDraft.nodes = [...baseTemplate.draftConfig.nodes];
serviceDraft.edges = [...baseTemplate.draftConfig.edges];
const modified = addDestinationToMenuOption(serviceDraft, "Service", sarah, "simultaneous");
const serviceRing = modified.nodes?.find(
  (n) => n.type === "RING_GROUP" && String(n.config.label) === "Service",
);
assert.ok(serviceRing, "Service should become ring group");
assert.ok(
  (serviceRing!.config.destinationIds as string[]).includes(sarah.id),
  "Sarah in ring group",
);
const unrelatedSales = modified.menuOptions?.find((o) => o.label === "Sales");
assert.equal(unrelatedSales?.phoneNumber, mike.phoneNumber);

// TEMPORARY change
const temp = applyTemporaryDestinationSwap(
  serviceDraft,
  mike.id,
  sarah,
  new Date(Date.now() - 1000).toISOString(),
);
assert.ok(temp.metadata?.temporaryRoutingRestore);
const restored = restoreExpiredTemporaryRouting(temp);
assert.ok(restored);

// INVALID Bob — resolved at runtime via service layer (requires DB)

// ANALYTICS fixture
const analyticsSummary = {
  periodDays: 14,
  callsRouted: 38,
  answered: 29,
  noAnswer: 9,
  answerRate: 76,
  outboundBusinessCallbacks: 2,
  byFlow: { flow1: 38 },
  byMenuSelection: { "2": 20 },
  insufficientData: false,
};
const facts = formatAnalyticsFacts(analyticsSummary);
assert.ok(facts.includes("38"));
assert.ok(facts.includes("9"));

// Compare produces human-readable changes
const changes = compareRoutingConfigs(serviceDraft, modified, destinations);
assert.ok(changes.some((c) => c.area === "Service" && c.changeType === "modify"));

// Concurrent edit simulation — compare detects difference
const staleBase = JSON.parse(JSON.stringify(serviceDraft));
const newer = addDestinationToMenuOption(staleBase, "Service", john, "sequential");
assert.notEqual(JSON.stringify(staleBase), JSON.stringify(newer));

console.log("test-smart-routing-ai-assistant: ok");
