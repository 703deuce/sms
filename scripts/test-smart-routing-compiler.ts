import { compileDraftConfig } from "../src/lib/smart-routing/flow-compiler";
import { validateDraftConfig } from "../src/lib/smart-routing/flow-validator";
import { templateForType } from "../src/lib/smart-routing/templates";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const draft = templateForType("phone_menu").draftConfig;
const compiled = compileDraftConfig(draft);
assert(Boolean(compiled.entryNodeId), "entry node required");
assert(Boolean(compiled.nodes[compiled.entryNodeId]), "entry node in map");

const valid = validateDraftConfig(draft, { requireAudio: false });
assert(!valid.valid || valid.issues.every((i) => i.code === "missing_destination"), "expected only missing destination warnings for blank template");

const dup = { ...draft, menuOptions: [
  { digit: "1", label: "A", action: "transfer", phoneNumber: "+15550001" },
  { digit: "1", label: "B", action: "transfer", phoneNumber: "+15550002" },
] };
const dupResult = validateDraftConfig(dup);
assert(!dupResult.valid, "duplicate digits should fail");

console.log("smart-routing flow-compiler tests passed");
