import assert from "node:assert/strict";
import type { IntakeFieldDefinition } from "../lib/server/voice-v3/config/agent-config";
import {
  hasLiveKitActiveCollector,
  resolveIntakeCollectionKind,
} from "../lib/server/voice-v3/intake-objective/resolve-intake-collection-kind";

function field(partial: Partial<IntakeFieldDefinition> & Pick<IntakeFieldDefinition, "key" | "type">): IntakeFieldDefinition {
  return {
    label: partial.key,
    required: true,
    description: "test",
    ...partial,
  };
}

assert.equal(resolveIntakeCollectionKind(field({ key: "phone", type: "phone" })), "livekit_get_phone");
assert.equal(resolveIntakeCollectionKind(field({ key: "email", type: "email" })), "livekit_get_email");
assert.equal(resolveIntakeCollectionKind(field({ key: "full_name", type: "text" })), "livekit_get_name");
assert.equal(resolveIntakeCollectionKind(field({ key: "service_reason", type: "text" })), "livekit_function_tool");
assert.equal(hasLiveKitActiveCollector(field({ key: "phone", type: "phone" })), true);
assert.equal(hasLiveKitActiveCollector(field({ key: "notes", type: "text" })), false);

console.log("test-resolve-intake-collection-kind: PASS");
