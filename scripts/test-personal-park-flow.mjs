/**
 * Live smoke: Personal park → vault → reactivate → forwarding.
 * Run: npx tsx scripts/test-personal-park-flow.mjs
 */
import { chromium } from "playwright";

const BASE = (
  process.env.PERSONAL_SCREENSHOT_BASE ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const FORWARD_DEST = process.env.PERSONAL_FORWARD_TO || "+12025550199";

const steps = [];

function log(name, ok, detail) {
  steps.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${name}: ${detail}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login + personal workspace
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const loginRes = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  log("smoke-login", loginRes.ok(), loginRes.ok() ? EMAIL : JSON.stringify(loginBody));
  const businessWorkspaceId = loginBody.workspaceId;

  // Ensure personal workspace exists and capture its id
  const personalRes = await page.request.post(`${BASE}/api/workspace`, {
    headers: { "content-type": "application/json" },
    data: { action: "create_personal" },
  });
  const personalBody = await personalRes.json().catch(() => ({}));
  const personalWorkspaceId = personalBody.data?.id;
  log(
    "personal-workspace",
    personalRes.ok() && personalWorkspaceId,
    personalRes.ok() ? personalWorkspaceId : JSON.stringify(personalBody),
  );

  // Switch back to business to access business numbers for staging
  if (businessWorkspaceId) {
    await page.request.post(`${BASE}/api/workspace`, {
      headers: { "content-type": "application/json" },
      data: { workspaceId: businessWorkspaceId },
    });
  }

  let numberId;
  let numberE164;
  let movedForTest = false;

  const bizWs = await page.request.get(`${BASE}/api/workspace`);
  const bizJson = await bizWs.json().catch(() => ({}));
  const businessNumbers = bizJson.data?.phoneNumbers || [];

  if (businessNumbers.length > 0 && personalWorkspaceId) {
    const donor = businessNumbers[0];
    const moveRes = await page.request.post(
      `${BASE}/api/numbers/${donor.id}/move-workspace`,
      {
        headers: { "content-type": "application/json" },
        data: { targetWorkspaceId: personalWorkspaceId },
      },
    );
    const moveJson = await moveRes.json().catch(() => ({}));
    movedForTest = moveRes.ok();
    log(
      "stage-number-to-personal",
      moveRes.ok(),
      moveRes.ok()
        ? `${moveJson.data?.e164 || donor.number} → Personal`
        : JSON.stringify(moveJson),
    );
    numberId = moveRes.ok() ? donor.id : undefined;
    numberE164 = moveJson.data?.e164 || donor.number;
  }

  // Switch to personal workspace for the test
  await page.request.post(`${BASE}/api/workspace`, {
    headers: { "content-type": "application/json" },
    data: { workspaceId: personalWorkspaceId },
  });

  // Load numbers in personal workspace
  const wsRes = await page.request.get(`${BASE}/api/workspace`);
  const wsJson = await wsRes.json().catch(() => ({}));
  const phoneNumbers = wsJson.data?.phoneNumbers || [];
  log("load-workspace-numbers", wsRes.ok(), `count=${phoneNumbers.length}`);

  if (!numberId) {
    numberId = phoneNumbers[0]?.id;
    numberE164 = phoneNumbers[0]?.number;
  }

  if (!numberId) {
    const numRes = await page.request.get(`${BASE}/api/numbers`);
    const numJson = await numRes.json().catch(() => ({}));
    const rows = numJson.data || [];
    numberId = rows[0]?.id;
    numberE164 = rows[0]?.number;
    log("fallback-numbers-api", numRes.ok() && rows.length > 0, `count=${rows.length}`);
  }

  if (!numberId) {
    log("abort", false, "No phone numbers available for personal workspace test");
    await browser.close();
    printSummary();
    process.exit(1);
  }

  log("test-number", true, `${numberE164} (${numberId})`);

  // Ensure not already parked — reactivate first if needed
  const preRes = await page.request.post(`${BASE}/api/personal/numbers/${numberId}`, {
    headers: { "content-type": "application/json" },
    data: { action: "reactivate" },
  });
  log("pre-reactivate", preRes.ok(), preRes.ok() ? "ready" : await preRes.text());

  // PARK
  const parkRes = await page.request.post(`${BASE}/api/personal/numbers/${numberId}`, {
    headers: { "content-type": "application/json" },
    data: { action: "park" },
  });
  const parkJson = await parkRes.json().catch(() => ({}));
  const parkedOk =
    parkRes.ok() &&
    (parkJson.data?.settingsJson?.parked === true ||
      parkJson.data?.settingsJson?.personalParked === true);
  log(
    "park-number",
    parkRes.ok() && parkedOk,
    parkRes.ok()
      ? `serviceState=${parkJson.data?.settingsJson?.personalServiceState || "PARKED"}`
      : JSON.stringify(parkJson),
  );

  // Verify vault page shows parked (HTML contains number)
  const vaultPage = await page.goto(`${BASE}/personal/vault`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const vaultHtml = await page.content();
  const digits = (numberE164 || "").replace(/\D/g, "");
  const vaultShowsNumber =
    digits.length >= 10 && vaultHtml.includes(digits.slice(-10));
  log(
    "vault-page",
    vaultPage?.ok() && vaultShowsNumber,
    vaultShowsNumber ? "number visible on vault page" : "number not found in vault HTML",
  );

  // REACTIVATE
  const reactRes = await page.request.post(`${BASE}/api/personal/numbers/${numberId}`, {
    headers: { "content-type": "application/json" },
    data: { action: "reactivate" },
  });
  const reactJson = await reactRes.json().catch(() => ({}));
  const reactOk =
    reactRes.ok() &&
    reactJson.data?.settingsJson?.parked !== true &&
    reactJson.data?.settingsJson?.personalParked !== true;
  log("reactivate-number", reactOk, reactRes.ok() ? "unparked" : JSON.stringify(reactJson));

  // FORWARDING save
  const fwdRuleRes = await page.request.post(`${BASE}/api/phone/forwarding`, {
    headers: { "content-type": "application/json" },
    data: {
      phoneNumberId: numberId,
      targetType: "external",
      targetValue: FORWARD_DEST,
      mode: "always",
      active: true,
      ringSeconds: 25,
    },
  });
  const fwdRuleJson = await fwdRuleRes.json().catch(() => ({}));
  log(
    "forwarding-rule",
    fwdRuleRes.ok(),
    fwdRuleRes.ok() ? `target=${FORWARD_DEST}` : JSON.stringify(fwdRuleJson),
  );

  const patchRes = await page.request.patch(`${BASE}/api/numbers/${numberId}`, {
    headers: { "content-type": "application/json" },
    data: { voiceForwardTo: FORWARD_DEST },
  });
  const patchJson = await patchRes.json().catch(() => ({}));
  log(
    "number-forward-patch",
    patchRes.ok() && patchJson.data?.voiceForwardTo === FORWARD_DEST,
    patchRes.ok() ? patchJson.data?.voiceForwardTo || "set" : JSON.stringify(patchJson),
  );

  // Verify forwarding page
  const fwdPage = await page.goto(`${BASE}/personal/forwarding?numberId=${numberId}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const fwdHtml = await page.content();
  const destDigits = FORWARD_DEST.replace(/\D/g, "");
  const fwdShowsDest =
    fwdHtml.includes(destDigits.slice(-7)) || fwdHtml.includes(formatDisplay(FORWARD_DEST));
  log(
    "forwarding-page",
    fwdPage?.ok() && fwdShowsDest,
    fwdShowsDest ? "destination visible" : "destination not in page HTML",
  );

  // Cleanup — disable forwarding
  await page.request.patch(`${BASE}/api/numbers/${numberId}`, {
    headers: { "content-type": "application/json" },
    data: { voiceForwardTo: null },
  });

  // Move test number back to business workspace if we staged it
  if (movedForTest && businessWorkspaceId) {
    await page.request.post(`${BASE}/api/workspace`, {
      headers: { "content-type": "application/json" },
      data: { action: "create_personal" },
    });
    const restoreRes = await page.request.post(
      `${BASE}/api/numbers/${numberId}/move-workspace`,
      {
        headers: { "content-type": "application/json" },
        data: { targetWorkspaceId: businessWorkspaceId },
      },
    );
    log("restore-number-to-business", restoreRes.ok(), restoreRes.ok() ? "restored" : await restoreRes.text());
    await page.request.post(`${BASE}/api/workspace`, {
      headers: { "content-type": "application/json" },
      data: { workspaceId: businessWorkspaceId },
    });
  }

  await browser.close();
  printSummary();
  const failed = steps.some((s) => !s.ok);
  process.exit(failed ? 1 : 0);
}

function formatDisplay(e164) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function printSummary() {
  const passed = steps.filter((s) => s.ok).length;
  console.log("\n--- Personal park flow summary ---");
  console.log(`${passed}/${steps.length} steps passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
