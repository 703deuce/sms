#!/usr/bin/env node
/**
 * Targeted receptionist wiring checks (new-app).
 * Requires DATABASE_URL for persistence tests.
 */
import assert from "node:assert/strict";

const base = process.env.RECEPTIONIST_TEST_BASE_URL?.trim() || "http://127.0.0.1:3001";

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  return { res, json };
}

async function main() {
  const checks = [];

  const health = await getJson("/api/internal/voice-runtime");
  checks.push(["internal voice-runtime GET", health.res.ok && health.json.ok === true]);

  if (!process.env.DATABASE_URL?.trim()) {
    console.log("test-receptionist-complete: SKIP persistence (DATABASE_URL unset)");
    console.log(checks.map(([n, ok]) => `${ok ? "PASS" : "FAIL"} ${n}`).join("\n"));
    process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
  }

  const state = await getJson("/api/receptionist");
  checks.push(["GET /api/receptionist", state.res.ok && state.json.data?.agentId]);
  const rev = state.json.data?.draftRevision;
  assert.ok(rev);

  const patch = await fetch(`${base}/api/receptionist/draft`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      editor: { ...state.json.data.draft, instructions: "Automated test patch" },
      expectedRevision: rev,
    }),
  });
  const patchJson = await patch.json();
  checks.push(["PATCH draft", patch.ok && patchJson.data?.draft?.instructions?.includes("Automated")]);

  const calls = await getJson("/api/receptionist/calls?limit=5");
  checks.push(["GET calls", calls.res.ok && Array.isArray(calls.json.data)]);

  const readiness = await getJson("/api/receptionist/readiness");
  checks.push(["GET readiness", readiness.res.ok && readiness.json.data?.checks]);

  console.log(checks.map(([n, ok]) => `${ok ? "PASS" : "FAIL"} ${n}`).join("\n"));
  if (!checks.every(([, ok]) => ok)) process.exit(1);
  console.log("test-receptionist-complete: ALL PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
