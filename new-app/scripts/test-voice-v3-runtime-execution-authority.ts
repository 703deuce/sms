#!/usr/bin/env npx tsx
/**
 * Ensures new-app LiveKit tool execution uses the authority connector (not ad-hoc copies).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEW_APP = path.join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(path.join(NEW_APP, rel), "utf8");
}

const toolsTs = read("lib/server/receptionist/runtime/tools.ts");
assert.match(
  toolsTs,
  /voice-v3-runtime-connector/,
  "receptionist/runtime/tools.ts must delegate through voice-v3-runtime-connector",
);
assert.doesNotMatch(
  toolsTs,
  /executeNativeVoiceV3Tool/,
  "tools.ts must not call executeNativeVoiceV3Tool directly",
);

const routeTs = read("app/api/internal/voice-runtime/route.ts");
assert.match(
  routeTs,
  /executeVoiceV3ToolForNewApp/,
  "internal voice-runtime route must use executeVoiceV3ToolForNewApp",
);

const hostTs = read("lib/server/voice-v3-runtime-connector/execution-host.ts");
assert.match(
  hostTs,
  /src\/lib\/voice-v3/,
  "execution-host must document src/lib/voice-v3 authority",
);

const forbiddenDirectExecute = [
  "app/api/internal/voice-runtime/route.ts",
  "lib/server/receptionist/runtime/tools.ts",
];
for (const rel of forbiddenDirectExecute) {
  const src = read(rel);
  assert.doesNotMatch(
    src,
    /@\/lib\/server\/voice-v3\/execute-tool/,
    `${rel} must not import execute-tool directly`,
  );
}

console.log("PASS voice_v3_runtime_execution_authority");
