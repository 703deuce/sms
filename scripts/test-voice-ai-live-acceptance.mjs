#!/usr/bin/env node
/**
 * Live Telnyx AI Voice acceptance (env-gated).
 *
 * Requires: TELNYX_API_KEY, DATABASE_URL, and optionally VOICE_LIVE_AGENT_ID / VOICE_LIVE_WORKSPACE_ID
 * Skip: if TELNYX_LIVE_ACCEPTANCE != "1"
 *
 * Stores evidence IDs under /tmp/voice-ai-live-evidence.json
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);

if (process.env.TELNYX_LIVE_ACCEPTANCE !== "1") {
  console.log("SKIP: set TELNYX_LIVE_ACCEPTANCE=1 to run live acceptance");
  process.exit(0);
}

const evidence = { startedAt: new Date().toISOString(), steps: [] };
function step(name, ok, detail = {}) {
  evidence.steps.push({ name, ok, ...detail, at: new Date().toISOString() });
  console.log(ok ? "✓" : "✗", name, detail.id || detail.error || "");
}

async function main() {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) {
    console.error("TELNYX_API_KEY required");
    process.exit(1);
  }
  const base = process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2";
  async function tx(method, p, body) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(JSON.stringify(json.errors || json));
      err.status = res.status;
      throw err;
    }
    return json.data || json;
  }

  // 1 create assistant
  let assistantId;
  try {
    const created = await tx("POST", "/ai/assistants", {
      name: `transovo-live-${Date.now()}`,
      model: "meta-llama/llama-3.3-70b-instruct",
      instructions: "You are a brief test assistant. Greet and offer help.",
      greeting: "Hello from Transovo live acceptance.",
    });
    assistantId = created.id;
    step("create_assistant", Boolean(assistantId), { id: assistantId });
  } catch (err) {
    step("create_assistant", false, { error: String(err.message || err) });
  }

  // 2 update
  if (assistantId) {
    try {
      await tx("POST", `/ai/assistants/${assistantId}`, {
        instructions: "Updated instructions for live acceptance.",
      });
      step("update_assistant", true, { id: assistantId });
    } catch (err) {
      step("update_assistant", false, { error: String(err.message || err) });
    }
  }

  // 3 clone
  let cloneId;
  if (assistantId) {
    try {
      const cloned = await tx("POST", `/ai/assistants/${assistantId}/clone`, {
        name: `transovo-clone-${Date.now()}`,
      });
      cloneId = cloned.id;
      step("clone_assistant", Boolean(cloneId), { id: cloneId });
    } catch (err) {
      step("clone_assistant", false, { error: String(err.message || err) });
    }
  }

  // 4 chat
  if (assistantId) {
    try {
      const chat = await tx("POST", `/ai/assistants/${assistantId}/chat`, {
        messages: [{ role: "user", content: "What are your hours?" }],
      });
      step("chat_assistant", true, { id: assistantId, preview: JSON.stringify(chat).slice(0, 120) });
    } catch (err) {
      step("chat_assistant", false, { error: String(err.message || err) });
    }
  }

  // 5 list versions
  if (assistantId) {
    try {
      const versions = await tx("GET", `/ai/assistants/${assistantId}/versions`);
      step("list_versions", true, {
        id: assistantId,
        count: Array.isArray(versions) ? versions.length : versions?.data?.length || 0,
      });
    } catch (err) {
      step("list_versions", false, { error: String(err.message || err) });
    }
  }

  // 6 tests list
  try {
    const tests = await tx("GET", "/ai/assistants/tests");
    step("list_tests", true, {
      count: Array.isArray(tests) ? tests.length : tests?.data?.length || 0,
    });
  } catch (err) {
    step("list_tests", false, { error: String(err.message || err) });
  }

  // 7 conversations list
  try {
    const convs = await tx("GET", "/ai/conversations");
    step("list_conversations", true, {
      count: Array.isArray(convs) ? convs.length : convs?.data?.length || 0,
    });
  } catch (err) {
    step("list_conversations", false, { error: String(err.message || err) });
  }

  // cleanup clone + assistant
  for (const id of [cloneId, assistantId].filter(Boolean)) {
    try {
      await tx("DELETE", `/ai/assistants/${id}`);
      step("delete_assistant", true, { id });
    } catch (err) {
      step("delete_assistant", false, { id, error: String(err.message || err) });
    }
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.passed = evidence.steps.filter((s) => s.ok).length;
  evidence.failed = evidence.steps.filter((s) => !s.ok).length;
  const out = path.join("/tmp", "voice-ai-live-evidence.json");
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log("\nEvidence written to", out);
  console.log(`Passed ${evidence.passed} / Failed ${evidence.failed}`);
  if (evidence.failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
