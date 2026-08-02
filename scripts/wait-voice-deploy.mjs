const BASE = "https://transovo.ai";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

function store(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [p] = c.split(";");
    const i = p.indexOf("=");
    if (i > 0) jar.set(p.slice(0, i), p.slice(i + 1));
  }
}
function cookie(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function probe() {
  const jar = new Map();
  const s = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ cloneCalendly: false }),
  });
  store(jar, s);
  const c = await fetch(`${BASE}/api/voice/agents`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookie(jar) },
    body: JSON.stringify({ name: "Deploy Probe", agentType: "custom" }),
  });
  const cj = await c.json();
  const id = cj.data?.id;
  const b = await fetch(`${BASE}/api/voice/agents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookie(jar) },
    body: JSON.stringify({ action: "build_for_test" }),
  });
  const bj = await b.json();
  return {
    status: b.status,
    telnyx: bj.data?.telnyxAssistantId || bj.telnyxAssistantId || null,
    health: bj.data?.healthStatus || bj.healthStatus,
    msg: bj.data?.healthMessage || bj.healthMessage || "",
    hasTopLevel: "telnyxAssistantId" in bj,
  };
}

for (let i = 1; i <= 24; i++) {
  const r = await probe();
  console.log(`[${i}]`, JSON.stringify(r));
  if (r.telnyx || r.hasTopLevel || /Telnyx sync failed:|returned no id/.test(r.msg)) {
    console.log(r.telnyx ? "READY_WITH_ASSISTANT" : "READY_NEW_CODE");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
console.log("TIMEOUT");
process.exit(1);
