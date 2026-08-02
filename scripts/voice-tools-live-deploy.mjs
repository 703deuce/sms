/**
 * Configure the live phone agent with:
 * - output gain −5 dB + fast endpointing
 * - full tool catalog enabled
 * - named transfer "Agent Handoff" → +15714776175
 * - CRM search / note / task tools
 * - build + deploy on +18663464256
 *
 * Usage: node scripts/voice-tools-live-deploy.mjs
 */
import { randomBytes } from "crypto";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const HANDOFF_E164 = (process.env.HANDOFF_E164 || "+15714776175").trim();

// Single terminator (hangup) + escalate_human cold transfer — avoid dual
// hangup/end_call and native warm transfer which drop live PSTN calls.
const FULL_TOOLS = [
  "hangup",
  "handoff",
  "sip_refer",
  "send_dtmf",
  "send_sms",
  "create_task",
  "take_structured_message",
  "mark_disposition",
  "save_caller_info",
  "update_contact_tags",
  "lookup_customer",
  "search_crm_contacts",
  "create_crm_note",
  "create_crm_task",
  "upsert_crm_contact",
  "escalate_human",
  "calendar_availability",
  "book_appointment",
];

const results = [];
function log(ok, name, note = "") {
  results.push({ ok, name, note });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${note ? `: ${note}` : ""}`);
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
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

  const loginRes = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: OWNER_EMAIL }),
  });
  storeCookies(jar, loginRes);
  const login = await loginRes.json();
  log(loginRes.ok && login.ok, "smoke-login", login.workspaceName || login.error || String(loginRes.status));
  if (!loginRes.ok) {
    console.log(JSON.stringify({ results, login }, null, 2));
    process.exit(1);
  }

  const sync = await api(jar, "/api/numbers/sync-telnyx", {
    method: "POST",
    body: { attachConnection: true, e164s: [PHONE_E164] },
  });
  log(sync.res.ok, "sync-telnyx", sync.res.ok ? `ok` : JSON.stringify(sync.json).slice(0, 200));

  const nums = await api(jar, "/api/numbers");
  const list = nums.json?.data || [];
  const phone =
    list.find((n) => (n.number || n.e164) === PHONE_E164) ||
    list.find((n) => String(n.number || n.e164).includes("8663464256")) ||
    list[0];
  if (!phone?.id) {
    log(false, "select phone", "none");
    process.exit(1);
  }
  log(true, "selected number", `${phone.number || phone.e164} (${phone.id})`);

  const agents = await api(jar, "/api/voice/agents");
  let agent =
    (agents.json?.data || []).find((a) =>
      /phone test|webrtc|front desk|receptionist|transovo/i.test(String(a.name || "")),
    ) ||
    (agents.json?.data || [])[0] ||
    null;

  if (!agent) {
    const stamp = randomBytes(3).toString("hex");
    const created = await api(jar, "/api/voice/agents", {
      method: "POST",
      body: {
        name: `Front Desk Live ${stamp}`,
        agentType: "receptionist",
        templateId: "receptionist",
        description: "Live inbound AI receptionist with full tools",
      },
    });
    agent = created.json?.data;
    log(!!agent?.id, "create agent", agent?.id || JSON.stringify(created.json).slice(0, 200));
  } else {
    log(true, "reuse agent", `${agent.name} ${agent.id}`);
  }
  if (!agent?.id) process.exit(1);

  // Specialist agent for true AI handoff (context-preserving assistant switch).
  let specialist =
    (agents.json?.data || []).find((a) =>
      /specialist|billing specialist|handoff specialist/i.test(String(a.name || "")),
    ) || null;
  if (!specialist) {
    const created = await api(jar, "/api/voice/agents", {
      method: "POST",
      body: {
        name: "Billing Specialist",
        agentType: "customer_support",
        templateId: "customer_support",
        description: "Specialist AI for agent handoff tests",
      },
    });
    specialist = created.json?.data;
    log(!!specialist?.id, "create specialist", specialist?.id || "fail");
  } else {
    log(true, "reuse specialist", `${specialist.name} ${specialist.id}`);
  }

  if (specialist?.id) {
    const specLoaded = await api(jar, `/api/voice/agents/${specialist.id}`);
    const specDraft = specLoaded.json?.data?.draftConfig || {};
    await api(jar, `/api/voice/agents/${specialist.id}`, {
      method: "PATCH",
      body: {
        purpose: "Specialist AI for handoff",
        draftConfig: {
          ...specDraft,
          voiceLanguage: {
            ...(specDraft.voiceLanguage || {}),
            outputGainDb: -5,
            endpointingMs: 300,
            silenceTimeoutMs: 2500,
            bargeIn: true,
          },
          enabledBuiltinTools: [
            "hangup",
            "transfer",
            "escalate_human",
            "take_structured_message",
            "create_task",
            "send_sms",
            "lookup_customer",
            "search_crm_contacts",
            "end_call",
          ],
          transfers: {
            ...(specDraft.transfers || {}),
            targets: [{ name: "Agent Handoff", to: HANDOFF_E164 }],
          },
        },
      },
    });
    await api(jar, `/api/voice/agents/${specialist.id}/tools`, {
      method: "PUT",
      body: {
        toolIds: [],
        enabledBuiltinTools: [
          "hangup",
          "transfer",
          "escalate_human",
          "take_structured_message",
          "create_task",
          "send_sms",
          "lookup_customer",
          "search_crm_contacts",
          "end_call",
        ],
      },
    });
    const specBuild = await api(jar, `/api/voice/agents/${specialist.id}`, {
      method: "PATCH",
      body: { action: "build_for_test" },
    });
    log(
      specBuild.res.ok,
      "build specialist",
      specBuild.json?.data?.agent?.telnyxAssistantId ||
        specBuild.json?.data?.telnyxAssistantId ||
        JSON.stringify(specBuild.json).slice(0, 180),
    );
    const specAfter = await api(jar, `/api/voice/agents/${specialist.id}`);
    specialist = specAfter.json?.data || specialist;
  }

  const loaded = await api(jar, `/api/voice/agents/${agent.id}`);
  const draft = loaded.json?.data?.draftConfig || {};
  const handoffAssistants = [];
  if (specialist?.telnyxAssistantId) {
    handoffAssistants.push({
      name: "Billing Specialist",
      id: specialist.telnyxAssistantId,
    });
  }

  const nextDraft = {
    ...draft,
    identity: { ...(draft.identity || {}), directions: ["inbound", "outbound"] },
    callHandling: {
      ...(draft.callHandling || {}),
      greeting:
        "Thank you for calling. I'm the virtual receptionist. I can answer questions, look up contacts, take a message, or connect you with someone. How can I help you today?",
      startupGreeting: {
        enabled: true,
        mode: "ai",
        text: "",
        delayMs: "auto",
        handOffWhenReady: true,
      },
    },
    instructions: {
      ...(draft.instructions || {}),
      role: "front-desk receptionist with tools",
      system: [
        "You are the front desk AI for the business.",
        "Be brief, warm, and accurate.",
        "When the caller asks for an agent handoff, a human, transfer, or to speak with someone, use the Transfer tool (or escalate_human) to the named target 'Agent Handoff'. Do not invent phone numbers.",
        "You may also use Agent Handoff to the Billing Specialist AI when the caller needs billing help.",
        "For CRM lookups use search_crm_contacts or lookup_customer. On production calls, use CRM data for recognition/routing — do not read another person's phone number aloud unless this is an internal/browser test.",
        "Never claim a transfer, SMS, booking, or CRM write succeeded until the tool returns success.",
        "If a tool is slow, say 'One moment while I look that up.'",
      ].join(" "),
      tone: "warm",
      style: "concise",
      fillerMessages: ["One moment while I look that up.", "Let me check that for you."],
    },
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      voiceId: draft.voiceLanguage?.voiceId || "ava-warm-us",
      primaryLanguage: "en-US",
      bargeIn: true,
      speed: 1,
      outputGainDb: -5,
      endpointingMs: 300,
      silenceTimeoutMs: 2500,
      noiseSuppression: true,
    },
    enabledBuiltinTools: FULL_TOOLS,
    transfers: {
      ...(draft.transfers || {}),
      targets: [
        { name: "Agent Handoff", to: HANDOFF_E164 },
        { name: "Front Desk", to: HANDOFF_E164 },
      ],
      handoffAssistants,
      warmTransferInstructions:
        "Briefly introduce the caller and summarize why they are calling before connecting to Agent Handoff.",
    },
  };

  const saved = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: {
      name: loaded.json?.data?.name || agent.name,
      agentType: "receptionist",
      purpose: "Live inbound AI with full tools, CRM, and Agent Handoff transfer",
      phoneNumberId: phone.id,
      draftConfig: nextDraft,
    },
  });
  log(saved.res.ok, "save agent config (−5 dB + tools)", saved.json?.error || saved.status);

  // Named destinations (source of truth for Telnyx transfer targets)
  for (const name of ["Agent Handoff", "Front Desk"]) {
    const dest = await api(jar, "/api/voice/ai", {
      method: "POST",
      body: {
        action: "upsert_destination",
        agentId: agent.id,
        name,
        kind: "external",
        destination: HANDOFF_E164,
        enabled: true,
        returnToAiOnFail: true,
      },
    });
    log(dest.res.ok, `upsert destination ${name}`, dest.json?.error || HANDOFF_E164);
  }

  if (specialist?.id) {
    await api(jar, "/api/voice/ai", {
      method: "POST",
      body: {
        action: "upsert_destination",
        agentId: specialist.id,
        name: "Agent Handoff",
        kind: "external",
        destination: HANDOFF_E164,
        enabled: true,
      },
    });
  }

  const tools = await api(jar, `/api/voice/agents/${agent.id}/tools`, {
    method: "PUT",
    body: { toolIds: [], enabledBuiltinTools: FULL_TOOLS },
  });
  log(
    tools.res.ok,
    "enable full tool catalog",
    tools.res.ok
      ? `count=${(tools.json?.data?.enabledBuiltinTools || []).length} synced=${tools.json?.data?.synced}`
      : JSON.stringify(tools.json).slice(0, 200),
  );

  // Visual flow: full receptionist (human-first + FAQ/router conversation)
  const flow = await api(jar, `/api/voice/agents/${agent.id}/flows`, {
    method: "PUT",
    body: { templateId: "full_receptionist", apply: true },
  });
  log(
    flow.res.ok,
    "apply visual flow template",
    flow.res.ok
      ? `routingMode=${flow.json?.applied?.routingMode} tools=${(flow.json?.applied?.enabledBuiltinTools || []).length}`
      : JSON.stringify(flow.json).slice(0, 220),
  );

  // Ensure a local test contact exists for CRM search demos.
  const testContact = await api(jar, "/api/contacts", {
    method: "POST",
    body: {
      firstName: "Jennifer",
      lastName: "Testcross",
      phone: "+15551234567",
      email: "jennifer.testcross@example.com",
    },
  });
  log(
    testContact.res.ok || /unique|already|exist/i.test(JSON.stringify(testContact.json)),
    "seed local test contact",
    testContact.json?.data?.id || JSON.stringify(testContact.json).slice(0, 120),
  );

  const built = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { action: "build_for_test" },
  });
  log(
    built.res.ok,
    "build_for_test",
    built.res.ok
      ? `assistant=${built.json?.data?.agent?.telnyxAssistantId || built.json?.data?.telnyxAssistantId || "?"}`
      : JSON.stringify(built.json).slice(0, 300),
  );

  const enable = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: { action: "enable_web_calls", agentId: agent.id },
  });
  log(enable.res.ok, "enable_web_calls", JSON.stringify(enable.json?.data || enable.json).slice(0, 160));

  const deployed = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { action: "deploy" },
  });
  log(
    deployed.res.ok,
    "deploy ACTIVE",
    deployed.res.ok
      ? `status=${deployed.json?.data?.agent?.status || deployed.json?.data?.rawStatus || "ok"}`
      : JSON.stringify(deployed.json).slice(0, 400),
  );

  // Repair inbound routing on the DID
  const repair = await api(jar, "/api/numbers/telnyx-inbound-repair", {
    method: "POST",
    body: { e164: PHONE_E164, agentId: agent.id },
  }).catch(() => ({ res: { ok: false }, json: {} }));
  if (repair.res) {
    log(
      repair.res.ok || repair.status === 404,
      "inbound repair",
      repair.res.ok ? "ok" : JSON.stringify(repair.json).slice(0, 160),
    );
  }

  const after = await api(jar, `/api/voice/agents/${agent.id}`);
  const final = after.json?.data;
  const dests = await api(jar, `/api/voice/ai?view=destinations&agentId=${agent.id}`);
  const toolState = await api(jar, `/api/voice/agents/${agent.id}/tools`);

  const active =
    String(final?.rawStatus || final?.status).toUpperCase() === "ACTIVE" &&
    !!final?.telnyxAssistantId;
  log(active, "agent live", `status=${final?.rawStatus || final?.status} assistant=${final?.telnyxAssistantId}`);

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== LIVE SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        base: BASE,
        callThisNumber: phone.number || phone.e164 || PHONE_E164,
        agentHandoffNumber: HANDOFF_E164,
        agentId: agent.id,
        agentName: final?.name,
        status: final?.rawStatus || final?.status,
        telnyxAssistantId: final?.telnyxAssistantId,
        outputGainDb: final?.draftConfig?.voiceLanguage?.outputGainDb,
        endpointingMs: final?.draftConfig?.voiceLanguage?.endpointingMs,
        enabledTools: toolState.json?.enabledBuiltinTools || [],
        destinations: (dests.json?.data || []).map((d) => ({
          name: d.name,
          destination: d.destination,
          enabled: d.enabled,
        })),
        specialistId: specialist?.id,
        specialistAssistantId: specialist?.telnyxAssistantId,
        howToTest: [
          `Call ${phone.number || PHONE_E164}`,
          "Say: please do an agent handoff — should dial +15714776175",
          "Say: look up Jennifer Testcross — should use search_crm_contacts",
        ],
        failed: failed.map((f) => ({ name: f.name, note: f.note })),
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
