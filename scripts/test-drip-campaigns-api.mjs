/**
 * Smoke test drip campaigns APIs.
 * Run: node scripts/test-drip-campaigns-api.mjs
 */
const BASE = (process.env.CONTACTS_TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || "alex@harborhome.co";
const WORKSPACE_ID = process.env.SMOKE_WORKSPACE_ID || "ws_1";

const jar = new Map();

function parseSetCookie(headers) {
  for (const raw of headers.getSetCookie?.() || []) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  const cookies = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookies) headers.set("Cookie", cookies);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  parseSetCookie(res.headers);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) failures.push({ name, detail });
  console.log(cond ? "PASS" : "FAIL", name, detail);
}

async function main() {
  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ email: EMAIL, workspaceId: WORKSPACE_ID }),
  });
  check("smoke-login", login.ok, `status ${login.status}`);
  if (!login.ok) process.exit(1);

  const listRes = await api("/api/drip-campaigns");
  check("GET drip-campaigns", listRes.ok && Array.isArray(listRes.json?.data), `count=${listRes.json?.data?.length}`);

  const numbers = await api("/api/numbers");
  const phoneNumberId = numbers.json?.data?.[0]?.id;
  check("GET numbers for drip", numbers.ok && phoneNumberId, phoneNumberId || "missing");

  const lists = await api("/api/contacts/lists");
  const list = lists.json?.data?.[0];
  check("GET lists for drip", lists.ok && list?.id, list?.name || "missing");

  const name = `API Drip Test ${Date.now()}`;
  const created = await api("/api/drip-campaigns", {
    method: "POST",
    body: JSON.stringify({
      name,
      triggerType: "list_join",
      triggerConfig: { listId: list?.id, listName: list?.name },
      phoneNumberId,
      status: "paused",
      steps: [{ id: "step_1", delayAmount: 0, delayUnit: "immediate", message: "Hello from drip test" }],
    }),
  });
  const campaignId = created.json?.data?.id;
  check("POST drip-campaign", created.ok && campaignId, created.json?.error || campaignId);

  const got = await api(`/api/drip-campaigns/${campaignId}`);
  check(
    "GET drip-campaign by id",
    got.ok && got.json?.data?.triggerConfig?.listId === list?.id,
    got.json?.data?.name,
  );

  const detail = await api(`/api/drip-campaigns/${campaignId}/detail`);
  check(
    "GET drip-campaign detail",
    detail.ok && detail.json?.data?.campaign?.id === campaignId,
    `enrollments=${detail.json?.data?.stats?.totalEnrollments ?? "?"}`,
  );

  const toggled = await api(`/api/drip-campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "toggle_status" }),
  });
  check("PATCH toggle_status", toggled.ok && toggled.json?.data?.status === "active", toggled.json?.data?.status);

  const paused = await api(`/api/drip-campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "paused" }),
  });
  check("PATCH status paused", paused.ok && paused.json?.data?.status === "paused", paused.json?.data?.status);

  const emptyPatch = await api(`/api/drip-campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  check(
    "PATCH empty body no-op",
    emptyPatch.ok && emptyPatch.json?.data?.id === campaignId,
    emptyPatch.json?.error || "ok",
  );

  const dup = await api(`/api/drip-campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "duplicate" }),
  });
  const dupId = dup.json?.data?.id;
  check("PATCH duplicate", dup.status === 201 && dupId && dupId !== campaignId, dup.json?.data?.name);

  const badPhone = await api("/api/drip-campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: "Bad phone drip",
      triggerType: "contact_added",
      phoneNumberId: "pn_invalid",
      steps: [{ id: "s1", delayAmount: 0, delayUnit: "immediate", message: "x" }],
    }),
  });
  check("POST rejects invalid phone", badPhone.status === 400, badPhone.json?.error);

  const badTrigger = await api("/api/drip-campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: "Bad list drip",
      triggerType: "list_join",
      triggerConfig: { listId: "list_invalid" },
      phoneNumberId,
      steps: [{ id: "s1", delayAmount: 0, delayUnit: "immediate", message: "x" }],
    }),
  });
  check("POST rejects invalid list", badTrigger.status === 400, badTrigger.json?.error);

  for (const id of [campaignId, dupId].filter(Boolean)) {
    const del = await api(`/api/drip-campaigns/${id}`, { method: "DELETE" });
    check(`DELETE ${id}`, del.ok, del.json?.error || "ok");
  }

  if (failures.length) {
    console.error("\nFailures:", failures);
    process.exit(1);
  }
  console.log("\nAll drip campaign API checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
