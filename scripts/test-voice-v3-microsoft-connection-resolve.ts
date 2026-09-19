#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { resolveMicrosoftConnectionForWizard } from "../src/lib/voice-v3/config/resolve-microsoft-connection";

function run(): void {
  const connections = [
    { id: "conn_a", name: "calendar-a@example.com" },
    { id: "conn_b", name: "calendar-b@example.com" },
  ];

  const picked = resolveMicrosoftConnectionForWizard(connections, "calendar-b@example.com");
  assert.equal(picked?.id, "conn_b");

  const fallback = resolveMicrosoftConnectionForWizard(connections, null);
  assert.equal(fallback?.id, "conn_a");

  const wrongEmail = resolveMicrosoftConnectionForWizard(connections, "missing@example.com");
  assert.equal(wrongEmail?.id, "conn_a");

  console.log("VOICE_V3_MICROSOFT_CONNECTION_RESOLVE: PASS");
}

run();
