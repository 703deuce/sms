/**
 * Live: smoke signup → create agent → build → test-session → verify Telnyx web calls
 * → attempt TelnyxRTC anonymous_login in Playwright (fake mic).
 */
import { chromium } from "playwright";
import { randomBytes } from "crypto";
import { mkdirSync } from "fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const results = [];

function log(ok, name, note = "") {
  results.push({ ok, name, note });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${note ? `: ${note}` : ""}`);
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar, res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function api(jar, path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { res, json, status: res.status };
}

async function main() {
  const jar = new Map();
  const stamp = randomBytes(4).toString("hex");

  const signupRes = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      email: `webrtc-${stamp}@transovo.test`,
      password: `WebRtc_${stamp}!`,
      name: "WebRTC Tester",
      businessName: `WebRTC Co ${stamp}`,
      cloneCalendly: false,
    }),
  });
  storeCookies(jar, signupRes);
  const signup = await signupRes.json();
  log(signupRes.ok && signup.ok, "smoke-signup", signup.email || signup.error || String(signupRes.status));
  if (!signupRes.ok) {
    console.log(JSON.stringify({ results, signup }, null, 2));
    process.exit(1);
  }

  const created = await api(jar, "/api/voice/agents", {
    method: "POST",
    body: {
      name: `WebRTC Desk ${stamp}`,
      agentType: "receptionist",
      description: "WebRTC live connect test",
    },
  });
  const agentId = created.json?.data?.id;
  log(created.status === 201 && !!agentId, "create agent", agentId || JSON.stringify(created.json).slice(0, 200));
  if (!agentId) process.exit(1);

  const loaded = await api(jar, `/api/voice/agents/${agentId}`);
  const draft = loaded.json?.data?.draftConfig || {};
  const nextDraft = {
    ...draft,
    callHandling: {
      ...(draft.callHandling || {}),
      greeting: "Hi, thanks for calling. How can I help?",
    },
    instructions: {
      ...(draft.instructions || {}),
      role: "receptionist",
      system: "You are a friendly receptionist. Keep answers short.",
    },
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      voiceId: "ava-warm-us",
      primaryLanguage: "en-US",
      bargeIn: true,
      speed: 1,
    },
  };
  const saved = await api(jar, `/api/voice/agents/${agentId}`, {
    method: "PATCH",
    body: { draftConfig: nextDraft, purpose: "WebRTC test" },
  });
  log(saved.res.ok, "save draft", saved.json?.error || saved.status);

  const built = await api(jar, `/api/voice/agents/${agentId}`, {
    method: "PATCH",
    body: { action: "build_for_test" },
  });
  log(
    built.res.ok,
    "build_for_test",
    built.res.ok
      ? JSON.stringify(built.json?.data?.agent || built.json?.data || {}).slice(0, 200)
      : savedError(built.json),
  );

  const after = await api(jar, `/api/voice/agents/${agentId}`);
  const assistantId = after.json?.data?.telnyxAssistantId;
  log(!!assistantId, "assistant id", assistantId || after.json?.data?.healthMessage || "missing");

  const enable = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: { action: "enable_web_calls", agentId },
  });
  log(enable.res.ok, "enable_web_calls", JSON.stringify(enable.json?.data || enable.json).slice(0, 300));

  const session = await api(jar, `/api/voice/agents/${agentId}/test-session`, {
    method: "POST",
    body: {
      sync: true,
      testVariables: {
        telnyx_conversation_channel: "web_call",
        test_caller_name: "Live Script",
      },
    },
  });
  log(
    session.res.ok && !!session.json?.data?.webrtc?.target_id,
    "test-session",
    session.res.ok
      ? `target=${session.json.data.webrtc.target_id} synced=${session.json.data.synced}`
      : savedError(session.json),
  );

  const targetId = session.json?.data?.webrtc?.target_id || assistantId;
  const targetParams = session.json?.data?.webrtc?.target_params;

  // Browser WebRTC anonymous login attempt
  let webrtcNote = "";
  let webrtcOk = false;
  try {
    mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-required",
      ],
    });
    const context = await browser.newContext({
      permissions: ["microphone"],
    });
    const cookies = [];
    for (const [name, value] of jar.entries()) {
      cookies.push({
        name,
        value: decodeURIComponent(value),
        domain: new URL(BASE).hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      });
    }
    await context.addCookies(cookies);

    const page = await context.newPage();
    page.on("console", (msg) => {
      const t = msg.text();
      if (/webrtc|telnyx|auth|error|ready|fail/i.test(t)) {
        console.log("BROWSER:", t.slice(0, 300));
      }
    });

    // First hit the real builder UI and click Test Voice Agent
    await page.goto(`${BASE}/voice/agents/${agentId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const bodyText = await page.locator("body").innerText();
    log(/Test Voice Agent/i.test(bodyText), "UI shows Test Voice Agent");
    log(!/Test conversation/i.test(bodyText) || /Text debug/i.test(bodyText), "text chat demoted/hidden");

    const btn = page.getByRole("button", { name: /Test Voice Agent/i }).first();
    if (await btn.count()) {
      await btn.click();
      // Wait for connecting / live / error
      await page.waitForTimeout(12000);
      const afterClick = await page.locator("body").innerText();
      const rose = await page.locator(".text-rose-600").allTextContents().catch(() => []);
      webrtcNote = [...rose, afterClick.match(/(Connecting|Listening|Failed|authentication|Microphone|could not connect)[^\n]*/i)?.[0] || ""]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 400);
      webrtcOk =
        /Listening|Connected|Live|Agent speaking/i.test(afterClick) &&
        !/authentication failed|Failed|could not connect/i.test(afterClick);
      log(webrtcOk, "UI Test Voice Agent click", webrtcNote || afterClick.slice(0, 240));
      await page.screenshot({
        path: "/opt/cursor/artifacts/screenshots/voice-webrtc-ui.png",
        fullPage: true,
      }).catch(() => undefined);
    } else {
      log(false, "UI Test Voice Agent click", "button missing");
    }

    // Direct SDK probe with and without target_params
    const probe = await page.evaluate(
      async ({ targetId, targetParams, withParams }) => {
        const out = { withParams, events: [] };
        try {
          const mod = await import("https://esm.sh/@telnyx/webrtc@2.27.8");
          const TelnyxRTC = mod.TelnyxRTC || mod.default?.TelnyxRTC || mod.default;
          const anon = {
            target_id: targetId,
            target_type: "ai_assistant",
          };
          if (withParams && targetParams) anon.target_params = targetParams;
          const client = new TelnyxRTC({ anonymous_login: anon });
          await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("timeout 20s")), 20000);
            client.on("telnyx.ready", () => {
              out.events.push("ready");
              clearTimeout(t);
              resolve();
            });
            client.on("telnyx.error", (err) => {
              out.events.push({ error: err });
              clearTimeout(t);
              reject(err);
            });
            client.connect();
          });
          out.ok = true;
          try {
            client.disconnect();
          } catch {}
        } catch (err) {
          out.ok = false;
          out.error =
            err && typeof err === "object"
              ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
              : String(err);
        }
        return out;
      },
      { targetId, targetParams, withParams: true },
    );
    log(!!probe.ok, "SDK anonymous_login WITH target_params", JSON.stringify(probe).slice(0, 500));

    const probe2 = await page.evaluate(
      async ({ targetId }) => {
        const out = { events: [] };
        try {
          const mod = await import("https://esm.sh/@telnyx/webrtc@2.27.8");
          const TelnyxRTC = mod.TelnyxRTC || mod.default?.TelnyxRTC || mod.default;
          const client = new TelnyxRTC({
            anonymous_login: {
              target_id: targetId,
              target_type: "ai_assistant",
            },
          });
          await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("timeout 20s")), 20000);
            client.on("telnyx.ready", () => {
              out.events.push("ready");
              clearTimeout(t);
              resolve();
            });
            client.on("telnyx.error", (err) => {
              out.events.push({ error: err });
              clearTimeout(t);
              reject(err);
            });
            client.connect();
          });
          out.ok = true;
          try {
            client.disconnect();
          } catch {}
        } catch (err) {
          out.ok = false;
          out.error =
            err && typeof err === "object"
              ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
              : String(err);
        }
        return out;
      },
      { targetId },
    );
    log(!!probe2.ok, "SDK anonymous_login WITHOUT target_params", JSON.stringify(probe2).slice(0, 500));

    await browser.close();
  } catch (err) {
    log(false, "browser webrtc probe", err instanceof Error ? err.message : String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        base: BASE,
        agentId,
        assistantId,
        targetId,
        failed: failed.map((f) => ({ name: f.name, note: f.note })),
        pass: failed.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length ? 1 : 0);
}

function savedError(json) {
  if (!json) return "no body";
  if (typeof json.error === "string") return json.error;
  try {
    return JSON.stringify(json).slice(0, 400);
  } catch {
    return "error";
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
