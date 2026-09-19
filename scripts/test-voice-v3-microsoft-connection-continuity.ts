#!/usr/bin/env npx tsx
/**
 * Static trace proof: FIND and BOOK use runtime.config.calendar.connectionId (no re-pick).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function run(): void {
  const findDispatch = readFileSync(
    resolve("src/lib/voice-v3/calendar/find-dispatch.ts"),
    "utf8",
  );
  const bookDispatch = readFileSync(
    resolve("src/lib/voice-v3/calendar/book-dispatch.ts"),
    "utf8",
  );
  const fromPublished = readFileSync(
    resolve("src/lib/voice-v3/config/from-published-agent.ts"),
    "utf8",
  );

  assert.ok(fromPublished.includes("resolveMicrosoftConnectionForWizard"));
  assert.ok(findDispatch.includes("runtime.config.calendar!.connectionId"));
  assert.ok(findDispatch.includes("connectionId: connection.id"));
  assert.ok(bookDispatch.includes("runtime.config.calendar!.connectionId"));
  assert.ok(bookDispatch.includes("connectionId: connection.id"));
  assert.ok(
    !findDispatch.includes("findMany") || findDispatch.includes("where: { id: runtime.config.calendar!.connectionId"),
    "FIND should load connection by config id, not first workspace connection",
  );

  console.log("VOICE_V3_MICROSOFT_CONNECTION_CONTINUITY_TRACE: PASS");
}

run();
