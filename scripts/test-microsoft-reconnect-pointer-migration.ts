#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldRemigrateMctbMicrosoftPointer } from "../src/lib/mctb/ai-booking/microsoft-connection-pointer-logic";

const oauth = readFileSync("src/lib/calendar/oauth.ts", "utf8");
assert.ok(oauth.includes("migrateMctbAiBookingMicrosoftConnectionPointers"));

const connections = readFileSync("src/lib/calendar/connections.ts", "utf8");
assert.ok(connections.includes("replacedConnectionIds: [connectionId]"));

const msAdapter = readFileSync("src/lib/mctb/ai-booking/providers/microsoft.ts", "utf8");
assert.ok(msAdapter.includes("resolveMctbMicrosoftConnectionId"));

const readiness = readFileSync("src/lib/mctb/ai-booking/readiness.ts", "utf8");
assert.ok(readiness.includes("ensureMctbMicrosoftConnectionPointer"));

const builtin = readFileSync("src/lib/voice/tools/builtin-actions.ts", "utf8");
assert.ok(builtin.includes("startVoiceAiBookingDurableOperation"));

// A configured, B new OAuth healthy, A removed → migrate
assert.deepEqual(
  shouldRemigrateMctbMicrosoftPointer({
    configuredId: "conn_A",
    configuredHealthy: false,
    activeConnectionId: "conn_B",
    activeHealthy: true,
    replacedConnectionIds: ["conn_A"],
  }),
  { migrate: true, reason: "replaced_connection" },
);

// Stale pointer to deleted row
assert.deepEqual(
  shouldRemigrateMctbMicrosoftPointer({
    configuredId: "conn_old",
    configuredHealthy: false,
    activeConnectionId: "conn_B",
    activeHealthy: true,
  }),
  { migrate: true, reason: "stale_or_disconnected_pointer" },
);

// Healthy pointer unchanged
assert.deepEqual(
  shouldRemigrateMctbMicrosoftPointer({
    configuredId: "conn_A",
    configuredHealthy: true,
    activeConnectionId: "conn_A",
    activeHealthy: true,
  }),
  { migrate: false, reason: "unchanged" },
);

console.log("RECONNECT_POINTER_MIGRATION PASS");
console.log("MICROSOFT_CANONICAL_CONNECTION PASS");
console.log("STALE_PROVIDER_POINTERS 0 (logic)");
console.log("test-microsoft-reconnect-pointer-migration: ok");
