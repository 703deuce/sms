/**
 * Live acceptance: create voice agent → configure → Build & test → chat.
 * Uses smoke-signup bootstrap + authenticated API (same product path as UI).
 */
import { chromium } from "playwright";
import { randomBytes } from "crypto";

const BASE = process.env.BASE_URL || "https://transovo.ai";
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
    json = { raw: text.slice(0, 400) };
  }
  return { res, json, status: res.status };
}

async function main() {
  const jar = new Map();
  const stamp = randomBytes(4).toString("hex");

  // 1) Bootstrap authenticated workspace
  const signupRes = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      email: `voice-talk-${stamp}@transovo.test`,
      password: `TalkTest_${stamp}!`,
      name: "Voice Talk Tester",
      businessName: `Talk Co ${stamp}`,
      cloneCalendly: false,
    }),
  });
  storeCookies(jar, signupRes);
  const signup = await signupRes.json();
  log(signupRes.ok && signup.ok, "smoke-signup", signup.email || signup.error || String(signupRes.status));
  if (!signupRes.ok) {
    console.log(JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  // 2) Create agent
  const created = await api(jar, "/api/voice/agents", {
    method: "POST",
    body: {
      name: `Front Desk ${stamp}`,
      agentType: "receptionist",
      description: "Live talk acceptance agent",
    },
  });
  const agentId = created.json?.data?.id;
  log(created.status === 201 && !!agentId, "create agent", agentId || created.json?.error || String(created.status));
  if (!agentId) {
    console.log(JSON.stringify({ results, created: created.json }, null, 2));
    process.exit(1);
  }

  // 3) Load + configure instructions / voice / greeting
  const loaded = await api(jar, `/api/voice/agents/${agentId}`);
  const draft = loaded.json?.data?.draftConfig || {};
  const nextDraft = {
    ...draft,
    identity: {
      ...(draft.identity || {}),
      directions: ["inbound"],
    },
    callHandling: {
      ...(draft.callHandling || {}),
      greeting: "Hi, thanks for calling Talk Co. How can I help you today?",
    },
    instructions: {
      ...(draft.instructions || {}),
      role: "friendly front-desk receptionist",
      system:
        "You are the front desk for Talk Co. Be brief, warm, and helpful. Answer questions about hours (9am-5pm Mon-Fri) and take a message if needed. Never invent appointments.",
      tone: "warm",
      style: "concise",
    },
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      voiceId: "Telnyx.NaturalHD.andromeda",
      primaryLanguage: "en-US",
      bargeIn: true,
      endpointingMs: 500,
      speed: 1,
    },
  };

  const saved = await api(jar, `/api/voice/agents/${agentId}`, {
    method: "PATCH",
    body: {
      name: `Front Desk ${stamp}`,
      purpose: "Answer common inbound questions and take messages",
      draftConfig: nextDraft,
    },
  });
  log(saved.res.ok, "save draft config", saved.json?.error || saved.status);
  if (saved.res.ok === false) {
    console.log("save draft detail", JSON.stringify(saved.json).slice(0, 400));
  }

  // 4) Build & test (Telnyx sync → TESTING)
  const built = await api(jar, `/api/voice/agents/${agentId}`, {
    method: "PATCH",
    body: { action: "build_for_test" },
  });
  const builtAgent = built.json?.data?.agent || built.json?.data;
  const telnyxAssistantId =
    builtAgent?.telnyxAssistantId || built.json?.data?.telnyxAssistantId;
  const status = builtAgent?.status || builtAgent?.rawStatus;
  log(
    built.res.ok,
    "build_for_test",
    built.res.ok
      ? `status=${status} assistant=${telnyxAssistantId || "none"}`
      : built.json?.error || JSON.stringify(built.json).slice(0, 300),
  );

  // Refresh agent for assistant id
  const afterBuild = await api(jar, `/api/voice/agents/${agentId}`);
  const assistantId = afterBuild.json?.data?.telnyxAssistantId;
  const rawStatus = afterBuild.json?.data?.rawStatus || afterBuild.json?.data?.status;
  log(!!assistantId, "telnyx assistant id present", assistantId || `status=${rawStatus}`);
  log(
    String(rawStatus).toUpperCase() === "TESTING" || String(rawStatus).toUpperCase() === "ACTIVE",
    "agent status testing/active",
    String(rawStatus),
  );

  // 5) Chat preview (talk to agent)
  const chat = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: {
      action: "chat_preview",
      agentId,
      message: "Hi — what are your business hours?",
    },
  });
  const replyRaw = chat.json?.data;
  const reply =
    typeof replyRaw === "string"
      ? replyRaw
      : replyRaw?.reply ||
        replyRaw?.message ||
        replyRaw?.choices?.[0]?.message?.content ||
        replyRaw?.messages?.slice?.(-1)?.[0]?.content ||
        (typeof replyRaw?.data === "string" ? replyRaw.data : null) ||
        JSON.stringify(replyRaw ?? chat.json).slice(0, 400);
  const chatOk =
    chat.res.ok &&
    typeof reply === "string" &&
    reply.length > 5 &&
    !/error|failed|missing/i.test(reply.slice(0, 40));
  log(chatOk, "chat_preview reply", String(reply).slice(0, 220));

  // Follow-up turn (conversation continuity)
  const convId =
    replyRaw?.conversation_id || replyRaw?.id || replyRaw?.data?.conversation_id;
  const chat2 = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: {
      action: "chat_preview",
      agentId,
      message: "Can you take a message for Alex?",
      conversationId: convId || undefined,
    },
  });
  const reply2Raw = chat2.json?.data;
  const reply2 =
    typeof reply2Raw === "string"
      ? reply2Raw
      : reply2Raw?.reply ||
        reply2Raw?.message ||
        reply2Raw?.choices?.[0]?.message?.content ||
        JSON.stringify(reply2Raw ?? chat2.json).slice(0, 300);
  log(chat2.res.ok && String(reply2).length > 5, "chat follow-up", String(reply2).slice(0, 220));

  // 6) UI path: open builder, confirm Build & test + Test conversation visible, send via UI
  let uiOk = false;
  let uiNote = "";
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    // Inject session cookies into browser
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
    await page.goto(`${BASE}/voice/agents/${agentId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    const hasBuild = /Build\s*&\s*test/i.test(body);
    const hasTestPanel = /Test conversation/i.test(body);
    const hasFlow = /Flow/i.test(body);
    log(hasBuild, "UI shows Build & test");
    log(hasTestPanel, "UI shows Test conversation");
    log(hasFlow, "UI shows Flow checklist");

    if (hasTestPanel) {
      const box = page.locator('textarea[placeholder*="Type a message" i]').first();
      if (await box.count()) {
        await box.fill("Hello from the UI — are you there?");
        await page.locator('button:has-text("Send")').first().click();
        await page.waitForTimeout(8000);
        const after = await page.locator("body").innerText();
        // Panel instructions always contain "Build the agent first…" — look for an ASSISTANT turn.
        const hasAssistantTurn = /ASSISTANT\s*\n\s*\S+/i.test(after);
        const assistantSnippet =
          after.match(/ASSISTANT\s*\n([\s\S]{1,240})/i)?.[1]?.trim() || "";
        uiOk = hasAssistantTurn && assistantSnippet.length > 3;
        uiNote = assistantSnippet || after.slice(0, 240);
        log(uiOk, "UI chat send", uiNote.slice(0, 240));
      } else {
        log(false, "UI chat send", "textarea missing");
      }
    }

    // Screenshot artifact
    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/voice-agent-talk.png",
      fullPage: true,
    }).catch(async () => {
      await page.screenshot({ path: "/tmp/voice-agent-talk.png", fullPage: true }).catch(() => undefined);
    });

    await browser.close();
  } catch (err) {
    log(false, "UI flow", err instanceof Error ? err.message : String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        base: BASE,
        agentId,
        assistantId,
        status: rawStatus,
        chatReply: String(reply).slice(0, 300),
        uiOk,
        failed: failed.map((f) => f.name),
        pass: failed.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
