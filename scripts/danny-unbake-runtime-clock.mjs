/**
 * Live Danny: remove baked calendar dates from prompt, enable resolve_datetime,
 * keep Flux skip of call-start dynvar webhook, republish tools.
 *
 *   BASE_URL=https://transovo.ai node scripts/danny-unbake-runtime-clock.mjs
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const AGENT_ID = process.env.AGENT_ID || "cmsgalvos0b4j1o6j3b563w5z";

function stripBakedClock(system) {
  let s = String(system || "");
  // Remove prior baked "Runtime context" / concrete calendar lines.
  s = s.replace(
    /\n*Runtime context[^\n]*\n(?:- [^\n]+\n)*/g,
    "\n",
  );
  s = s.replace(
    /\n*- Current (date|day|local time):[^\n]*/gi,
    "",
  );
  s = s.replace(
    /\n*Today is [^\n]*\n?/gi,
    "\n",
  );
  s = s.replace(
    /\n*It is (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^\n]*\n?/gi,
    "\n",
  );
  s = s.replace(
    /\n*- Interpret today, tomorrow[^\n]*\n?/gi,
    "\n",
  );
  // Prior live patch told the model to prefer call-start dynvars — remove that.
  s = s.replace(
    /\n*When dynamic variables are available, prefer \{\{current_date\}\}[^\n]*\n?/gi,
    "\n",
  );
  s = s.replace(/\{\{current_date\}\}/g, "the resolve_datetime tool");
  s = s.replace(/\{\{current_day\}\}/g, "the resolve_datetime tool");
  s = s.replace(/\{\{current_time\}\}/g, "the resolve_datetime tool");

  // Prefer tool path when enabled on this agent; otherwise do not invent dates.
  const hasResolveTool = /\bresolve_datetime\b/.test(s);
  if (!/Date and time \(do not invent/.test(s) && !hasResolveTool) {
    const block = [
      "",
      "Date and time (do not invent a calendar):",
      "- Business timezone: {{business_timezone}}",
      "- Never invent today's date or guess the weekday from memory.",
      "- When resolve_datetime is available, call it for relative timing (today, tomorrow, this Friday, in three hours). You may keep talking while it runs.",
      "- If resolve_datetime is unavailable or fails, ask the caller for the calendar date (month and day) and confirm the full date, day of week, time, and timezone before checking availability.",
      '- Before booking, repeat the full date, day of week, time, and timezone. Never book based only on an ambiguous phrase such as "Friday at five."',
      "",
    ].join("\n");
    const goalsIdx = s.indexOf("\nGoals:");
    if (goalsIdx >= 0) {
      s = s.slice(0, goalsIdx) + "\n" + block + s.slice(goalsIdx + 1);
    } else {
      s = s.trimEnd() + "\n" + block;
    }
  }

  return s.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

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
  const setCookies =
    typeof login.headers.getSetCookie === "function"
      ? login.headers.getSetCookie()
      : [];
  const cookieHeader = setCookies
    .map((c) => String(c).split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookieHeader) throw new Error("smoke-login missing session cookies");

  const get = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    headers: { cookie: cookieHeader },
  });
  const gj = await get.json();
  if (!get.ok) throw new Error(`get agent ${get.status} ${JSON.stringify(gj)}`);

  const draft = { ...(gj?.data?.draftConfig || {}) };
  const prevSystem = draft.instructions?.system || "";
  const nextSystem = stripBakedClock(prevSystem);

  // Only enable resolve_datetime after production has the handler (ENABLE_RESOLVE_DATETIME=1).
  const enableResolve = process.env.ENABLE_RESOLVE_DATETIME === "1";
  const tools = new Set(
    Array.isArray(draft.enabledBuiltinTools) ? draft.enabledBuiltinTools : [],
  );
  if (enableResolve) {
    tools.add("resolve_datetime");
    if (/Tools —/.test(nextSystem) && !/- resolve_datetime:/.test(nextSystem)) {
      // nextSystem is const from strip — rebuild with tool line below via rewrite
    }
  }
  tools.add("calendar_availability");
  tools.add("book_appointment");

  let systemOut = nextSystem;
  if (enableResolve && /Tools —/.test(systemOut) && !/- resolve_datetime:/.test(systemOut)) {
    systemOut = systemOut.replace(
      /(Tools —[^\n]*\n)/,
      "$1- resolve_datetime: resolve relative dates/times to a concrete local datetime before checking availability.\n",
    );
  }

  const dyn = { ...(draft.dynamicVariables || {}) };
  delete dyn.current_date;
  delete dyn.current_day;
  delete dyn.current_time;
  delete dyn.utc_offset;
  delete dyn.current_iso_local;
  if (!dyn.business_timezone) {
    dyn.business_timezone = dyn.timezone || "America/New_York";
  }

  const diagnostics = {
    ...(draft.diagnostics || {}),
    skipDynamicVariablesWebhook: true,
  };
  const startPlan = {
    ...(draft.startSpeakingPlan || {}),
    waitSeconds: 0.05,
  };

  const nextDraft = {
    ...draft,
    instructions: {
      ...(draft.instructions || {}),
      system: systemOut,
    },
    enabledBuiltinTools: Array.from(tools),
    dynamicVariables: dyn,
    diagnostics,
    startSpeakingPlan: startPlan,
  };

  const put = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ draftConfig: nextDraft }),
  });
  const pj = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`patch draft ${put.status} ${JSON.stringify(pj)}`);

  const publish = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ action: "publish" }),
  });
  const pubj = await publish.json().catch(() => ({}));
  if (!publish.ok) {
    throw new Error(`publish ${publish.status} ${JSON.stringify(pubj)}`);
  }

  const verify = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    headers: { cookie: cookieHeader },
  });
  const vj = await verify.json();
  const sys =
    vj?.data?.draftConfig?.instructions?.system ||
    vj?.data?.publishedConfig?.instructions?.system ||
    "";
  const enabled = vj?.data?.draftConfig?.enabledBuiltinTools || [];

  const report = {
    ok: true,
    agentId: AGENT_ID,
    enableResolve,
    promptLen: sys.length,
    hasDateGuard: /do not invent a calendar|resolve_datetime/i.test(sys),
    hasBakedWednesday: /Wednesday,\s*2026-08-05|6:32\s*PM/i.test(sys),
    hasCurrentDateMustache: /\{\{current_date\}\}/.test(sys),
    toolsHasResolve: enabled.includes("resolve_datetime"),
    skipWebhook: Boolean(vj?.data?.draftConfig?.diagnostics?.skipDynamicVariablesWebhook),
    waitSeconds: vj?.data?.draftConfig?.startSpeakingPlan?.waitSeconds,
    publish: pubj?.data || pubj,
  };
  if (
    !report.hasDateGuard ||
    report.hasBakedWednesday ||
    report.hasCurrentDateMustache ||
    (enableResolve && !report.toolsHasResolve)
  ) {
    report.ok = false;
  }
  // Keep the report small — full publish payload is huge.
  const slim = {
    ...report,
    publish: {
      id: report.publish?.id,
      status: report.publish?.status || report.publish?.rawStatus,
      publishedVersionId: report.publish?.publishedVersionId,
      telnyxAssistantId: report.publish?.telnyxAssistantId,
      healthStatus: report.publish?.healthStatus,
    },
  };
  console.log(JSON.stringify(slim, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
