/**
 * Browser + API acceptance for Danny booking / resolve_datetime / calendar.
 *
 *   BASE_URL=https://transovo.ai node scripts/danny-browser-booking-acceptance.mjs
 *
 * Steps:
 * 1) Smoke login + browser agent/tools UI
 * 2) Wait until production serves resolve_datetime in the tool catalog
 * 3) Enable resolve_datetime, drop Service Visit address, republish
 * 4) Invoke resolve_datetime + calendar_availability via Telnyx tools webhook path
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const AGENT_ID = process.env.AGENT_ID || "cmsgalvos0b4j1o6j3b563w5z";
const FLOW_ID = process.env.FLOW_ID || "cmsgam0u264372y724h443y1y";
const SERVICE_VISIT_ID = process.env.SERVICE_VISIT_ID || "cmsg5s2jb6u4x3i104858484b";
const OUT = "/opt/cursor/artifacts/danny-booking-acceptance";
const DEPLOY_WAIT_MS = Number(process.env.DEPLOY_WAIT_MS || 8 * 60 * 1000);
const POLL_MS = 15000;

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  agentId: AGENT_ID,
  startedAt: new Date().toISOString(),
  ok: false,
  errors: [],
  steps: [],
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || JSON.stringify(detail).slice(0, 200));
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => null);
}

function cookieHeaderFromResponse(res) {
  const jars =
    typeof res.headers?.()?.getSetCookie === "function"
      ? res.headers().getSetCookie()
      : [];
  // Playwright APIResponse
  const fromPw = res.headersArray?.()?.filter((h) => h.name.toLowerCase() === "set-cookie") || [];
  if (jars.length) return jars.map((c) => String(c).split(";")[0]).join("; ");
  if (fromPw.length) {
    return fromPw.map((h) => String(h.value).split(";")[0]).join("; ");
  }
  return "";
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    const login = await page.request.post(`${BASE}/api/auth/smoke-login`, {
      headers: {
        "content-type": "application/json",
        "x-smoke-bootstrap": BOOTSTRAP,
      },
      data: { email: EMAIL },
    });
    if (!login.ok()) throw new Error(`smoke-login ${login.status()}`);
    log("smoke-login");

    // --- Browser: agents list + Danny page ---
    await page.goto(`${BASE}/voice/agents`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await shot(page, "01-agents-list");
    const listText = await page.locator("body").innerText();
    report.agentsList = {
      showsDanny: /Danny/i.test(listText),
      showsActive: /Active|Live/i.test(listText),
    };
    if (!report.agentsList.showsDanny) report.errors.push("Danny missing on agents list");
    log("agents-list", report.agentsList);

    await page.goto(`${BASE}/voice/agents/${AGENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2500);
    await shot(page, "02-agent-page");
    const agentText = await page.locator("body").innerText();
    report.agentPage = {
      danny: /Danny/i.test(agentText),
      lakeside: /Lakeside/i.test(agentText),
      active: /Active|Live|Published/i.test(agentText),
      calendarish: /calendar|book|appointment|availability/i.test(agentText),
    };
    if (!report.agentPage.danny) report.errors.push("Agent page missing Danny");
    if (!report.agentPage.active) report.errors.push("Agent page not Active/Live");
    log("agent-page", report.agentPage);

    // Tools section if present
    for (const label of ["Tools", "Capabilities", "Scheduling"]) {
      const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
      }
    }
    await shot(page, "03-tools-section");

    // --- API: agent config sanity ---
    const ag = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
    const aj = await ag.json();
    if (!ag.ok()) throw new Error(`get agent ${ag.status()}`);
    const draft = aj?.data?.draftConfig || {};
    const prompt = draft.instructions?.system || "";
    const workspaceId = aj?.data?.workspaceId || aj?.workspaceId;
    report.agentApi = {
      status: aj?.data?.status || aj?.data?.rawStatus,
      telnyxAssistantId: aj?.data?.telnyxAssistantId,
      workspaceId,
      skipWebhook: Boolean(draft.diagnostics?.skipDynamicVariablesWebhook),
      waitSeconds: draft.startSpeakingPlan?.waitSeconds,
      hasDateGuard: /do not invent a calendar|resolve_datetime/i.test(prompt),
      hasBakedClock: /2026-08-05|6:32\s*PM/i.test(prompt),
      hasCurrentDateMustache: /\{\{current_date\}\}/.test(prompt),
      enabledTools: draft.enabledBuiltinTools || [],
    };
    if (report.agentApi.hasBakedClock) report.errors.push("prompt still has baked clock");
    if (report.agentApi.hasCurrentDateMustache) {
      report.errors.push("prompt still has {{current_date}}");
    }
    if (!report.agentApi.hasDateGuard) report.errors.push("prompt missing date guard");
    log("agent-api", {
      status: report.agentApi.status,
      skipWebhook: report.agentApi.skipWebhook,
      waitSeconds: report.agentApi.waitSeconds,
      toolCount: report.agentApi.enabledTools.length,
    });

    // Workspace cookie from smoke-login (transovo_workspace)
    let wsId = workspaceId || "ws_1";
    try {
      const cookies = await context.cookies(BASE);
      const wsc = cookies.find((c) => c.name === "transovo_workspace");
      if (wsc?.value) wsId = decodeURIComponent(wsc.value);
    } catch {
      // keep fallback
    }
    report.workspaceId = wsId;

    // --- Wait for deploy: catalog must include resolve_datetime ---
    const toolsUrl = `${BASE}/api/voice/agents/${AGENT_ID}/tools`;
    const deadline = Date.now() + DEPLOY_WAIT_MS;
    let catalogHasResolve = false;
    while (Date.now() < deadline) {
      const tr = await page.request.get(toolsUrl);
      const tj = await tr.json().catch(() => ({}));
      const catalogGroups = tj?.catalog || tj?.data?.catalog || [];
      const flat = Array.isArray(catalogGroups)
        ? catalogGroups.flatMap((c) => c.tools || (c.key ? [c] : []))
        : [];
      const keys = flat.map((t) => t.key || t.toolType || t.name);
      const enabled = tj?.enabledBuiltinTools || tj?.data?.enabledBuiltinTools || [];
      const blob = JSON.stringify(tj);
      catalogHasResolve =
        keys.includes("resolve_datetime") ||
        enabled.includes("resolve_datetime") ||
        blob.includes("resolve_datetime");
      report.toolsCatalogProbe = {
        status: tr.status(),
        catalogHasResolve,
        sampleKeys: keys.filter((k) => /calendar|resolve|book/.test(k || "")),
      };
      if (catalogHasResolve) break;
      log("waiting-deploy", {
        message: `resolve_datetime not in catalog yet; retry in ${POLL_MS / 1000}s`,
      });
      await page.waitForTimeout(POLL_MS);
    }
    if (!catalogHasResolve) {
      report.errors.push(
        `Production still missing resolve_datetime after ${DEPLOY_WAIT_MS}ms — deploy may be pending`,
      );
    } else {
      log("deploy-ready", { message: "resolve_datetime present in tools API" });
    }

    // --- Enable tool + unbake path + address fix when deploy ready ---
    if (catalogHasResolve) {
      // Enable resolve_datetime via tools PATCH
      const currentEnabled = new Set(report.agentApi.enabledTools);
      currentEnabled.add("resolve_datetime");
      currentEnabled.add("calendar_availability");
      currentEnabled.add("book_appointment");
      const toolsPatch = await page.request.put(toolsUrl, {
        data: { enabledBuiltinTools: Array.from(currentEnabled) },
      });
      const tpj = await toolsPatch.json().catch(() => ({}));
      report.enableTools = { status: toolsPatch.status(), ok: toolsPatch.ok() };
      if (!toolsPatch.ok()) {
        report.errors.push(`enable tools failed ${toolsPatch.status()} ${JSON.stringify(tpj).slice(0, 200)}`);
      } else {
        log("enabled-resolve_datetime");
      }

      // Refresh draft prompt instructions for tool line + date block
      const ag2 = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
      const aj2 = await ag2.json();
      const draft2 = { ...(aj2?.data?.draftConfig || {}) };
      let system = String(draft2.instructions?.system || "");
      if (!/- resolve_datetime:/.test(system) && /Tools —/.test(system)) {
        system = system.replace(
          /(Tools —[^\n]*\n)/,
          "$1- resolve_datetime: resolve relative dates/times to a concrete local datetime before checking availability.\n",
        );
      }
      if (!/Date and time \(do not invent/.test(system)) {
        system =
          system.replace(
            /\nGoals:/,
            `\nDate and time (do not invent a calendar):\n- Business timezone: {{business_timezone}}\n- When the caller uses relative timing, call resolve_datetime. Do not invent today's date.\n- You may keep talking while it runs; use the result before offering slots.\n- Before booking, repeat the full date, day of week, time, and timezone.\nGoals:`,
          ) || system;
      }
      system = system
        .replace(/\n*When dynamic variables are available, prefer \{\{current_date\}\}[^\n]*\n?/gi, "\n")
        .replace(/\{\{current_date\}\}/g, "resolve_datetime")
        .replace(/\{\{current_day\}\}/g, "resolve_datetime")
        .replace(/\{\{current_time\}\}/g, "resolve_datetime");

      draft2.instructions = { ...(draft2.instructions || {}), system };
      draft2.diagnostics = {
        ...(draft2.diagnostics || {}),
        skipDynamicVariablesWebhook: true,
      };
      draft2.startSpeakingPlan = {
        ...(draft2.startSpeakingPlan || {}),
        waitSeconds: 0.05,
      };
      const dyn = { ...(draft2.dynamicVariables || {}) };
      delete dyn.current_date;
      delete dyn.current_day;
      delete dyn.current_time;
      delete dyn.utc_offset;
      draft2.dynamicVariables = dyn;
      draft2.enabledBuiltinTools = Array.from(currentEnabled);

      const patchAgent = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
        data: { draftConfig: draft2 },
      });
      report.patchAgent = { status: patchAgent.status(), ok: patchAgent.ok() };
      if (!patchAgent.ok()) {
        report.errors.push(`patch agent ${patchAgent.status()}`);
      }

      const publish = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
        data: { action: "publish" },
      });
      const pubj = await publish.json().catch(() => ({}));
      report.publish = {
        status: publish.status(),
        ok: publish.ok(),
        telnyxAssistantId: pubj?.data?.telnyxAssistantId,
        healthStatus: pubj?.data?.healthStatus,
      };
      if (!publish.ok()) report.errors.push(`publish failed ${publish.status()}`);
      else log("published", report.publish);

      // Drop address from Service Visit
      const svcGet = await page.request.get(`${BASE}/api/voice/services`);
      const svcJ = await svcGet.json().catch(() => ({}));
      const rows = svcJ?.data || [];
      const visit = rows.find((s) => s.id === SERVICE_VISIT_ID) ||
        rows.find((s) => /service visit/i.test(s.name || ""));
      if (visit) {
        const nextConfig = {
          ...((visit.config && typeof visit.config === "object") ? visit.config : {}),
          requiredFields: ["full_name", "phone", "email", "service"],
        };
        // Include name/duration so older deploys that ignore `config` still succeed
      // the request; after #80 lands, requiredFields updates too.
      const svcPatch = await page.request.patch(
          `${BASE}/api/voice/services/${visit.id}`,
          {
            data: {
              name: visit.name || "Service Visit",
              durationMinutes: visit.durationMinutes || 60,
              config: nextConfig,
            },
          },
        );
        const spj = await svcPatch.json().catch(() => ({}));
        report.serviceVisit = {
          id: visit.id,
          status: svcPatch.status(),
          ok: svcPatch.ok(),
          requiredFields: spj?.data?.config?.requiredFields,
          error: spj?.error,
        };
        if (!svcPatch.ok()) {
          report.errors.push(
            `Service Visit address patch failed: ${spj?.error || svcPatch.status()}`,
          );
        } else if ((report.serviceVisit.requiredFields || []).includes("address")) {
          report.errors.push("Service Visit still requires address after patch");
        } else {
          log("service-visit-no-address", report.serviceVisit);
        }
      } else {
        report.errors.push("Service Visit not found");
      }

      // --- Invoke tools via Telnyx webhook path (same as mid-call) ---
      if (!wsId) {
        // Pull workspace from agent row if API embeds it elsewhere
        const ag3 = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
        const aj3 = await ag3.json();
        wsId = aj3?.data?.workspaceId;
      }
      // Last resort: parse from any workspace cookie usage via services list already scoped
      if (!wsId) {
        // Discover via debug endpoint if present
        const dbg = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}/tools`);
        const dj = await dbg.json().catch(() => ({}));
        wsId = dj?.data?.workspaceId;
      }

      // Prefer workspace from smoke session cookie by hitting a known endpoint
      if (!wsId) {
        const sessions = await page.request.get(`${BASE}/api/session`).catch(() => null);
        const sj = sessions && sessions.ok() ? await sessions.json() : {};
        wsId = sj?.workspaceId || sj?.data?.workspaceId;
      }

      report.workspaceId = wsId;
      if (!wsId) {
        report.errors.push("Could not resolve workspaceId for tool webhook calls");
      } else {
        async function callTool(toolType, body) {
          const res = await page.request.post(`${BASE}/api/telnyx/voice/tools`, {
            headers: {
              "content-type": "application/json",
              "x-transovo-workspace-id": wsId,
              "x-transovo-agent-id": AGENT_ID,
              "x-transovo-tool-type": toolType,
            },
            data: body,
          });
          const json = await res.json().catch(() => ({}));
          return { status: res.status(), json };
        }

        const resolved = await callTool("resolve_datetime", {
          spoken: "tomorrow at 2pm",
        });
        report.resolveDatetime = {
          status: resolved.status,
          ok: resolved.json?.ok === true,
          resolvedLocal: resolved.json?.resolvedLocal,
          speak: resolved.json?.speak,
          error: resolved.json?.error,
          confidence: resolved.json?.confidence,
        };
        if (!report.resolveDatetime.ok) {
          report.errors.push(
            `resolve_datetime failed: ${report.resolveDatetime.error || JSON.stringify(resolved.json).slice(0, 180)}`,
          );
        } else {
          log("resolve_datetime", {
            message: report.resolveDatetime.resolvedLocal || report.resolveDatetime.speak,
          });
        }

        const avail = await callTool("calendar_availability", {
          serviceName: "Initial Consultation",
          daysAhead: 2,
        });
        const slots = avail.json?.slots || avail.json?.data?.slots || [];
        report.calendarAvailability = {
          status: avail.status,
          provider: avail.json?.provider,
          slotCount: Array.isArray(slots) ? slots.length : 0,
          sample: Array.isArray(slots) ? slots.slice(0, 3) : [],
          error: avail.json?.error || avail.json?.speak,
          window: avail.json?.window,
        };
        if (report.calendarAvailability.slotCount < 1) {
          report.errors.push(
            `calendar_availability returned no slots: ${report.calendarAvailability.error || "empty"}`,
          );
        } else {
          log("calendar_availability", {
            message: `${report.calendarAvailability.slotCount} slots via ${report.calendarAvailability.provider}`,
          });
        }
      }
    }

    // Flow diagnostics
    await page.goto(`${BASE}/automations/${FLOW_ID}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    await shot(page, "04-flow");
    const diag = await page.request.get(
      `${BASE}/api/automations/${FLOW_ID}/diagnostics`,
    );
    const dj = await diag.json().catch(() => ({}));
    report.diagnostics = {
      deploymentStatus: dj?.data?.deploymentStatus,
      assistantLaunch: dj?.data?.layers?.assistantLaunch,
      telnyxAssistantId: dj?.data?.telnyxAssistantId,
    };
    if (report.diagnostics.deploymentStatus && report.diagnostics.deploymentStatus !== "live") {
      report.errors.push(`flow not live: ${report.diagnostics.deploymentStatus}`);
    }
    log("flow-diagnostics", report.diagnostics);

    // Final agent page screenshot after publish
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    await shot(page, "05-agent-final");

    report.ok = report.errors.length === 0;
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.ok = false;
    await shot(page, "fatal").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        errors: report.errors,
        agentsList: report.agentsList,
        agentPage: report.agentPage,
        agentApi: {
          skipWebhook: report.agentApi?.skipWebhook,
          waitSeconds: report.agentApi?.waitSeconds,
          hasDateGuard: report.agentApi?.hasDateGuard,
          toolsHasResolve: report.agentApi?.enabledTools?.includes("resolve_datetime"),
        },
        enableTools: report.enableTools,
        publish: report.publish,
        serviceVisit: report.serviceVisit,
        resolveDatetime: report.resolveDatetime,
        calendarAvailability: report.calendarAvailability,
        diagnostics: report.diagnostics,
        artifacts: OUT,
      },
      null,
      2,
    ),
  );
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
