/**
 * Enable find/reschedule + republish Danny so progressive fillers land on Telnyx.
 *
 *   BASE_URL=https://transovo.ai node scripts/danny-apply-book-fillers.mjs
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const AGENT_ID = process.env.AGENT_ID || "cmsgalvos0b4j1o6j3b563w5z";

async function main() {
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!login.ok) throw new Error(`smoke-login ${login.status}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => String(c).split(";")[0])
    .join("; ");

  const ag = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    headers: { cookie },
  });
  const aj = await ag.json();
  if (!ag.ok) throw new Error(`get agent ${ag.status}`);
  const draft = { ...(aj?.data?.draftConfig || {}) };

  const tools = new Set(
    Array.isArray(draft.enabledBuiltinTools) ? draft.enabledBuiltinTools : [],
  );
  for (const t of [
    "resolve_datetime",
    "calendar_availability",
    "book_appointment",
    "find_appointments",
    "reschedule_appointment",
    "cancel_appointment",
  ]) {
    tools.add(t);
  }

  let system = String(draft.instructions?.system || "");
  if (!/- find_appointments:/.test(system) && /Tools —/.test(system)) {
    system = system.replace(
      /(Tools —[^\n]*\n(?:- [^\n]+\n)*)/,
      "$1- find_appointments: when the caller asks about an existing booking, look it up by phone before reschedule/cancel.\n- reschedule_appointment: move an existing booking using appointmentId from find_appointments and a new startsAt from calendar_availability.\n",
    );
  }
  if (!/alreadyBooked=true/.test(system)) {
    system = system.replace(
      /(- Never claim an appointment is booked until the booking tool succeeds\.\n)/,
      "$1- If book_appointment times out, you may retry the same startsAt once. If it returns alreadyBooked=true or ok=true, tell the caller they are confirmed — do not say it failed.\n",
    );
  }

  draft.instructions = { ...(draft.instructions || {}), system };
  draft.enabledBuiltinTools = Array.from(tools);
  draft.diagnostics = {
    ...(draft.diagnostics || {}),
    skipDynamicVariablesWebhook: true,
  };
  draft.startSpeakingPlan = {
    ...(draft.startSpeakingPlan || {}),
    waitSeconds: 0.05,
  };

  const patch = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ draftConfig: draft }),
  });
  if (!patch.ok) {
    throw new Error(`patch ${patch.status} ${await patch.text()}`);
  }

  // Also PUT tools explicitly so Telnyx sync path sees builtins.
  const toolsPut = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}/tools`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ enabledBuiltinTools: Array.from(tools) }),
  });
  if (!toolsPut.ok) {
    throw new Error(`tools put ${toolsPut.status} ${await toolsPut.text()}`);
  }

  const publish = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "publish" }),
  });
  const pubj = await publish.json().catch(() => ({}));
  if (!publish.ok) {
    throw new Error(`publish ${publish.status} ${JSON.stringify(pubj).slice(0, 400)}`);
  }

  // Verify remote tool fillers via fetch_live_assistant if available
  const live = await fetch(`${BASE}/api/voice/ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      action: "fetch_live_assistant",
      agentId: AGENT_ID,
    }),
  });
  const lj = await live.json().catch(() => ({}));
  const remoteTools =
    lj?.data?.tools ||
    lj?.data?.assistant?.tools ||
    lj?.data?.live?.tools ||
    [];
  const book = Array.isArray(remoteTools)
    ? remoteTools.find((t) => {
        const name = t?.webhook?.name || t?.name || t?.tool?.name;
        return name === "book_appointment";
      })
    : null;
  const fillers = book?.webhook?.filler_messages || book?.filler_messages || [];

  // Smoke find_appointments for Anthony
  const find = await fetch(`${BASE}/api/telnyx/voice/tools`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-transovo-workspace-id": "ws_1",
      "x-transovo-agent-id": AGENT_ID,
      "x-transovo-tool-type": "find_appointments",
    },
    body: JSON.stringify({ phone: "+15714776175" }),
  });
  const fj = await find.json().catch(() => ({}));

  // Idempotency smoke: re-book an already-held slot
  const appts = fj.appointments || [];
  let idempotency = null;
  if (appts[0]?.startsAt) {
    const bookRes = await fetch(`${BASE}/api/telnyx/voice/tools`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-transovo-workspace-id": "ws_1",
        "x-transovo-agent-id": AGENT_ID,
        "x-transovo-tool-type": "book_appointment",
      },
      body: JSON.stringify({
        serviceName: appts[0].serviceName || "Initial Consultation",
        startsAt: appts[0].startsAt,
        customerName: "Anthony Johnson",
        customerPhone: "+15714776175",
        customerEmail: "anthony.johnson@yahoo.com",
      }),
    });
    const bj = await bookRes.json().catch(() => ({}));
    idempotency = {
      status: bookRes.status,
      ok: bj.ok,
      alreadyBooked: bj.alreadyBooked,
      appointmentId: bj.appointmentId,
      error: bj.error,
      message: bj.message,
    };
  }

  const enabled = pubj?.data?.draftConfig?.enabledBuiltinTools || [];
  const report = {
    ok: true,
    publish: {
      status: publish.status,
      health: pubj?.data?.healthStatus,
      telnyxAssistantId: pubj?.data?.telnyxAssistantId,
      publishedVersionId: pubj?.data?.publishedVersionId,
    },
    toolsEnabled: {
      find: enabled.includes("find_appointments"),
      reschedule: enabled.includes("reschedule_appointment"),
      resolve: enabled.includes("resolve_datetime"),
      book: enabled.includes("book_appointment"),
    },
    remoteBookFillers: {
      count: Array.isArray(fillers) ? fillers.length : 0,
      types: Array.isArray(fillers) ? fillers.map((f) => f.type) : [],
      timings: Array.isArray(fillers)
        ? fillers.map((f) => f.timing_ms).filter((n) => n != null)
        : [],
      liveActionStatus: live.status,
    },
    findAppointments: {
      status: find.status,
      ok: fj.ok,
      found: fj.found,
      count: (fj.appointments || []).length,
      speak: fj.speak,
      appointments: (fj.appointments || []).slice(0, 5),
    },
    idempotency,
  };
  if (
    !report.toolsEnabled.find ||
    !report.toolsEnabled.reschedule ||
    !report.findAppointments.ok
  ) {
    report.ok = false;
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
