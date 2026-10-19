#!/usr/bin/env node
/**
 * Point Telnyx Call Control at new-app Phone webhook and attach active DIDs.
 * Usage (production container or local with env):
 *   node scripts/configure-new-app-telnyx-phone-webhook.mjs
 *   node scripts/configure-new-app-telnyx-phone-webhook.mjs --dry-run
 */
const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.TELNYX_API_KEY?.trim();
const base = (process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2").replace(
  /\/$/,
  "",
);
const appBase =
  process.env.APP_URL?.trim() ||
  process.env.COOLIFY_FQDN?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://transovo.ai";
const webhookUrl = `${appBase.replace(/\/$/, "")}/api/telnyx/phone`;
const envConnectionId = process.env.TELNYX_CONNECTION_ID?.trim() || "";
const appName = process.env.TELNYX_PHONE_CALL_CONTROL_APP_NAME?.trim() || "Transovo New App Phone";

if (!apiKey) {
  console.error("TELNYX_API_KEY is required");
  process.exit(1);
}

async function telnyx(path, options = {}) {
  const url = new URL(`${base}${path.startsWith("/") ? "" : "/"}${path}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Telnyx ${options.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function fetchConnectionOrApp(id) {
  try {
    const cc = await telnyx(`/call_control_applications/${encodeURIComponent(id)}`);
    if (cc?.data?.id) return { ...cc.data, _kind: "call_control" };
  } catch {
    /* */
  }
  try {
    const c = await telnyx(`/connections/${encodeURIComponent(id)}`);
    if (c?.data?.id) return { ...c.data, _kind: "connection" };
  } catch {
    /* */
  }
  try {
    const cred = await telnyx(`/telephony_credentials/${encodeURIComponent(id)}`);
    if (cred?.data?.id) return { ...cred.data, _kind: "credential" };
  } catch {
    /* */
  }
  return null;
}

async function listCallControlApps() {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const res = await telnyx("/call_control_applications", {
      query: { "page[number]": page, "page[size]": 50 },
    });
    const rows = res.data || [];
    out.push(...rows);
    if (rows.length < 50) break;
  }
  return out;
}

async function ensureCallControlApp() {
  const want = webhookUrl.replace(/\/$/, "");
  let targetId = envConnectionId;
  let existing = targetId ? await fetchConnectionOrApp(targetId) : null;

  if (existing?._kind === "call_control") {
    const current = String(existing.webhook_event_url || "").replace(/\/$/, "");
    console.log(JSON.stringify({ step: "found_env_call_control", id: targetId, currentWebhook: current }));
    if (!dryRun && (current !== want || existing.active === false || String(existing.webhook_api_version) !== "2")) {
      const patched = await telnyx(`/call_control_applications/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        body: {
          application_name: existing.application_name || appName,
          webhook_event_url: want,
          webhook_api_version: "2",
          active: true,
          first_command_timeout: true,
          first_command_timeout_secs: 30,
        },
      });
      console.log(JSON.stringify({ step: "patched_env_call_control", webhook_event_url: want }));
      return String(patched.data?.id || targetId);
    }
    return targetId;
  }

  const apps = await listCallControlApps();
  let app =
    apps.find((a) => String(a.webhook_event_url || "").replace(/\/$/, "") === want) ||
    apps.find((a) => String(a.application_name || "") === appName) ||
    null;

  if (!app) {
    console.log(JSON.stringify({ step: "create_call_control_app", webhook_event_url: want }));
    if (dryRun) return "dry-run-new-app-id";
    const created = await telnyx("/call_control_applications", {
      method: "POST",
      body: {
        application_name: appName,
        webhook_event_url: want,
        webhook_api_version: "2",
        active: true,
        first_command_timeout: true,
        first_command_timeout_secs: 30,
      },
    });
    return String(created.data?.id || "");
  }

  targetId = String(app.id);
  const current = String(app.webhook_event_url || "").replace(/\/$/, "");
  console.log(JSON.stringify({ step: "found_existing_app", id: targetId, currentWebhook: current }));
  if (!dryRun && (current !== want || app.active === false || String(app.webhook_api_version) !== "2")) {
    await telnyx(`/call_control_applications/${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      body: {
        application_name: app.application_name || appName,
        webhook_event_url: want,
        webhook_api_version: "2",
        active: true,
        first_command_timeout: true,
        first_command_timeout_secs: 30,
      },
    });
    console.log(JSON.stringify({ step: "patched_existing_app", webhook_event_url: want }));
  }
  return targetId;
}

async function attachNumbersToConnection(callControlId) {
  const listed = await telnyx("/phone_numbers", {
    query: { "page[size]": 100 },
  });
  const numbers = listed.data || [];
  const attached = [];
  for (const pn of numbers) {
    const e164 = String(pn.phone_number || "");
    const conn = String(pn.connection_id || "");
    const id = String(pn.id || "");
    if (!id || !e164) continue;
    if (conn === callControlId) {
      attached.push({ e164, action: "already_ok" });
      continue;
    }
    console.log(JSON.stringify({ step: "attach_number", e164, fromConnection: conn || null, toConnection: callControlId }));
    if (!dryRun) {
      await telnyx(`/phone_numbers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { connection_id: callControlId },
      });
    }
    attached.push({ e164, action: dryRun ? "would_attach" : "attached" });
  }
  return attached;
}

async function main() {
  console.log(JSON.stringify({ step: "start", webhookUrl, dryRun, envConnectionId: envConnectionId || null }));
  if (envConnectionId) {
    const kind = await fetchConnectionOrApp(envConnectionId);
    console.log(JSON.stringify({ step: "env_connection_kind", kind: kind?._kind || "unknown" }));
  }
  const callControlId = await ensureCallControlApp();
  if (!callControlId) {
    console.error("Failed to resolve Call Control application id");
    process.exit(1);
  }
  const numbers = await attachNumbersToConnection(callControlId);
  console.log(JSON.stringify({ step: "done", callControlId, webhookUrl, numbers }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
