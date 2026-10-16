/**
 * Production API walkthrough: load wizard state, save each step, capture responses.
 * Pair with receptionist-trace-prod-db-verify.ts for published-vs-draft proof.
 */
import { request } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const ARTIFACT = "/opt/cursor/artifacts";
const OUT = path.join(ARTIFACT, "receptionist-prod-api-walkthrough.json");

const STEPS = [
  "goals",
  "phone",
  "information",
  "appointments",
  "call-handling",
  "voice",
  "test",
  "activate",
];

function traceId() {
  return `rec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

async function authContext() {
  const api = await request.newContext({ baseURL: BASE, timeout: 120_000 });
  const bypass = await api.get("/api/auth/dev-bypass?next=/voice/receptionist", {
    maxRedirects: 0,
  });
  if (![200, 302, 307, 308].includes(bypass.status())) {
    throw new Error(`dev-bypass failed: ${bypass.status()}`);
  }
  const storageState = await api.storageState();
  await api.dispose();
  return await request.newContext({ baseURL: BASE, storageState, timeout: 120_000 });
}

async function main() {
  mkdirSync(ARTIFACT, { recursive: true });
  const ctx = await authContext();

  const listRes = await ctx.get("/api/solutions/appointment-receptionist");
  const listJson = await listRes.json();
  const agentId = listJson?.data?.agentId;
  if (!agentId) throw new Error("No agentId from GET setup");

  let state = listJson.data.state;
  const results = [];

  for (const step of STEPS) {
    const tid = traceId();
    if (step === "appointments") {
      state = { ...state, bookingStrategy: "SEND_LINK" };
    }
    const res = await ctx.post("/api/solutions/appointment-receptionist", {
      headers: {
        "content-type": "application/json",
        "x-receptionist-trace-id": tid,
      },
      data: {
        action: "save_draft",
        wizardStepId: step,
        receptionistTraceId: tid,
        state,
      },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (body?.data?.state) state = body.data.state;
    results.push({
      step,
      traceId: tid,
      status: res.status(),
      receptionistTraceId: body?.data?.receptionistTraceId,
      published: body?.data?.published,
      liveSyncPending: body?.data?.liveSyncPending,
      bookingStrategy: body?.data?.state?.bookingStrategy,
      error: body?.error,
    });
  }

  writeFileSync(
    OUT,
    JSON.stringify({ base: BASE, agentId, results, finalBookingStrategy: state?.bookingStrategy }, null, 2),
  );
  console.log("Wrote", OUT);
  console.log(JSON.stringify(results, null, 2));
  await ctx.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
