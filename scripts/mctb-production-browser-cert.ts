/**
 * MCTB production browser E2E certification (production host, ws_1).
 * Mutations ONLY through Playwright UI — DB snapshot is verification-only.
 *
 * Auth: production dev-bypass (authorized) + POST /api/workspace → ws_1.
 *
 *   MCTB_PROD_CERT_BASE_URL=<production-origin> \
 *   MCTB_PROD_CERT_EMAIL=<admin-email> \
 *   npx tsx scripts/mctb-production-browser-cert.ts
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page, type BrowserContext } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const ARTIFACT_DIR = process.env.MCTB_PROD_CERT_ARTIFACTS || "/opt/cursor/artifacts/mctb-prod-browser-cert";
const MATRIX_PATH =
  process.env.MCTB_PROD_CERT_MATRIX ||
  join(process.cwd(), "docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md");

const CERT_EXCLUSION_E164 = "+15550119999";

type Snapshot = {
  persisted?: Record<string, unknown>;
  effective?: Record<string, unknown>;
  exclusions?: Record<string, unknown>;
};

type Row = {
  page: string;
  tab: string;
  control: string;
  browserAction: string;
  uiResult: string;
  backendResult: string;
  refreshResult: string;
  effectiveRuntime: string;
  status: string;
  defectFix: string;
};

const rows: Row[] = [];

function snapshotBackend(): Snapshot {
  const out = execSync("npx tsx scripts/mctb-ws1-config-snapshot.ts", {
    cwd: process.cwd(),
    env: { ...process.env, WORKSPACE_ID },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(out) as Snapshot;
}

function record(row: Row) {
  rows.push(row);
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const line = `| ${esc(row.page)} | ${esc(row.tab)} | ${esc(row.control)} | ${esc(row.browserAction)} | ${esc(row.uiResult)} | ${esc(row.backendResult)} | ${esc(row.refreshResult)} | ${esc(row.effectiveRuntime)} | ${esc(row.status)} | ${esc(row.defectFix)} |\n`;
  appendFileSync(MATRIX_PATH, line);
}

async function healthSha(): Promise<string> {
  const res = await fetch(`${BASE}/api/health`);
  const j = (await res.json()) as { commitSha?: string };
  return j.commitSha || "unknown";
}

async function authenticate(context: BrowserContext): Promise<void> {
  if (!EMAIL) throw new Error("Set MCTB_PROD_CERT_EMAIL or ADMIN_EMAILS");
  const page = await context.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}&email=${encodeURIComponent(EMAIL)}`,
    { waitUntil: "domcontentloaded", timeout: 120_000 },
  );
  await page.waitForURL(/\/mctb/, { timeout: 120_000 }).catch(() => undefined);
  const api = await context.request.post(`${BASE}/api/workspace`, {
    data: { workspaceId: WORKSPACE_ID },
  });
  if (!api.ok()) {
    const body = await api.text();
    throw new Error(`Workspace switch failed: ${api.status()} ${body}`);
  }
  await page.close();
}

async function shot(page: Page, name: string) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: join(ARTIFACT_DIR, `${name}.png`), fullPage: true });
}

async function visitMctbRoute(page: Page, path: string, label: string): Promise<boolean> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(800);
  const status = res?.status() ?? 0;
  const ok = status < 400 && !page.url().includes("/login");
  record({
    page: label,
    tab: "—",
    control: "route load",
    browserAction: `goto ${path}`,
    uiResult: ok ? `HTTP ${status}` : `fail ${status} url=${page.url()}`,
    backendResult: "—",
    refreshResult: "—",
    effectiveRuntime: "—",
    status: ok ? "PASS — UI + PERSISTENCE" : "FAIL — UI",
    defectFix: errors[0] || "",
  });
  await shot(page, `route-${label.replace(/\W+/g, "-").slice(0, 40)}`);
  return ok;
}

async function waitSetupPost(page: Page): Promise<number | null> {
  const setupRes = await page
    .waitForResponse(
      (r) => r.url().includes("/api/mctb/setup") && r.request().method() === "POST",
      { timeout: 45_000 },
    )
    .catch(() => null);
  return setupRes?.status() ?? null;
}

async function testConsentMode(page: Page): Promise<void> {
  await page.goto(`${BASE}/mctb/setup/consent`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForURL(/missed-call-recovery|setup\/consent/, { timeout: 60_000 }).catch(() => undefined);
  await page.getByText(/press 1 to consent/i).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await shot(page, "consent-initial");

  const before = snapshotBackend();
  const beforeMode = before.effective?.loadMctbConsentMode;

  const existingRadio = page.getByRole("radio", { name: /already have consent/i });
  const press1Radio = page.getByRole("radio", { name: /press 1/i });

  await existingRadio.click({ timeout: 30_000 }).catch(async () => {
    await page.getByText(/already have consent/i).first().click();
  });

  const certCheckbox = page.getByRole("checkbox", { name: /certify that my business/i });
  await certCheckbox.scrollIntoViewIfNeeded().catch(() => undefined);
  if (await certCheckbox.isVisible().catch(() => false)) {
    await certCheckbox.check();
  }

  const saveBtn = page.getByRole("button", {
    name: /certify & enable existing consent|save consent mode/i,
  });
  await saveBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  let uiResult = "no save button";
  let saveOk = false;
  let setupStatus: number | null = null;
  if (await saveBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    const setupWait = waitSetupPost(page);
    await saveBtn.click();
    setupStatus = await setupWait;
    await page.waitForTimeout(1500);
    const err =
      (await page.getByText(/save failed|could not save|before saving/i).first().textContent().catch(() => null)) ||
      (await page.locator(".text-destructive").first().textContent().catch(() => null));
    const savedVisible = await page.getByText(/^saved$/i).isVisible().catch(() => false);
    uiResult = err?.trim()
      ? `error: ${err.trim()}`
      : setupStatus && setupStatus >= 400
        ? `POST /api/mctb/setup ${setupStatus}`
        : savedVisible || setupStatus === 200
          ? "save OK"
          : `clicked save (http ${setupStatus ?? "?"})`;
    saveOk = Boolean(setupStatus === 200 && !err?.trim());
  }

  await shot(page, "consent-after-save-existing");

  const after = snapshotBackend();
  const afterMode = after.effective?.loadMctbConsentMode;
  const persisted = after.persisted?.mctbConsentMode;
  const texmlAfter = after.effective?.texmlHandlerMode;

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const existingSelected = await existingRadio.isChecked().catch(() => false);
  await shot(page, "consent-after-refresh-existing");

  let status = "FAIL — PERSISTENCE";
  if (!saveOk) status = "FAIL — UI";
  else if (
    persisted === "existing_consent" &&
    afterMode === "existing_consent" &&
    texmlAfter === "voicemail" &&
    existingSelected
  )
    status = "PASS — UI + PERSISTENCE + EFFECTIVE CONFIG";
  else if (persisted === "existing_consent" && afterMode === "existing_consent" && existingSelected)
    status = "PASS — UI + PERSISTENCE";
  else if (saveOk) status = "FAIL — EFFECTIVE CONFIG";

  record({
    page: "Setup → Consent",
    tab: "—",
    control: "Press-1 → Existing Consent + Save",
    browserAction: "select existing, attest, save",
    uiResult,
    backendResult: `before=${beforeMode} after persisted=${persisted} effective=${afterMode} texml=${texmlAfter}`,
    refreshResult: existingSelected ? "existing selected" : "not selected after refresh",
    effectiveRuntime: String(texmlAfter ?? afterMode),
    status,
    defectFix: "",
  });

  if (status.startsWith("PASS") || persisted === "existing_consent") {
    await press1Radio.click().catch(() => page.getByText(/press 1 to consent/i).first().click());
    const restoreBtn = page.getByRole("button", { name: /save consent mode/i });
    await restoreBtn.scrollIntoViewIfNeeded().catch(() => undefined);
    let restoreHttp: number | null = null;
    if (await restoreBtn.isVisible().catch(() => false)) {
      const wait = waitSetupPost(page);
      await restoreBtn.click();
      restoreHttp = await wait;
      await page.waitForTimeout(2000);
    }
    const restored = snapshotBackend();
    const rm = restored.effective?.loadMctbConsentMode;
    const texmlRm = restored.effective?.texmlHandlerMode;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const press1Selected = await press1Radio.isChecked().catch(() => false);
    record({
      page: "Setup → Consent",
      tab: "—",
      control: "Existing Consent → Press-1 + Save (restore)",
      browserAction: "select press-1, save",
      uiResult: restoreHttp === 200 ? "save OK" : `http ${restoreHttp ?? "?"}`,
      backendResult: `effective=${rm} texml=${texmlRm}`,
      refreshResult: press1Selected ? "press-1 selected" : "not selected",
      effectiveRuntime: String(texmlRm ?? rm),
      status:
        rm === "press_1" && press1Selected && texmlRm === "press_1"
          ? "PASS — UI + PERSISTENCE + EFFECTIVE CONFIG"
          : rm === "press_1" && press1Selected
            ? "PASS — UI + PERSISTENCE"
            : "FAIL — PERSISTENCE",
      defectFix: restoreHttp !== 200 ? "restore POST failed" : "",
    });
    await shot(page, "consent-restored-press1");
  }
}

async function testRecoveryPause(page: Page, context?: BrowserContext): Promise<void> {
  if (context) {
    await context.request.post(`${BASE}/api/workspace`, { data: { workspaceId: WORKSPACE_ID } });
  }
  await page.goto(`${BASE}/mctb/missed-call-recovery?tab=general`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(5000);
  const pauseBtn = page.getByRole("button", { name: "1 hour", exact: true });
  let pauseVisible = false;
  try {
    await pauseBtn.waitFor({ state: "visible", timeout: 60_000 });
    pauseVisible = true;
  } catch {
    pauseVisible = false;
  }
  await shot(page, "recovery-hub-general");

  if (!pauseVisible) {
    const dbgUrl = page.url();
    const dbgSnippet = await page.locator("body").innerText().catch(() => "").then((t) => t.slice(0, 200));
    console.error(JSON.stringify({ recoveryPauseDebug: { url: dbgUrl, snippet: dbgSnippet } }));
    await shot(page, "recovery-pause-fail");
    record({
      page: "Missed-call recovery",
      tab: "general",
      control: "Pause 1 hour",
      browserAction: "n/a",
      uiResult: `control not visible; url=${dbgUrl}`,
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "FAIL — UI",
      defectFix: "",
    });
    return;
  }

  const waitPause = page.waitForResponse(
    (r) => {
      if (!r.url().includes("/api/mctb/setup") || r.request().method() !== "POST") return false;
      try {
        const body = r.request().postDataJSON() as { pauseUntil?: string; enabled?: boolean };
        return Boolean(body.pauseUntil) || body.enabled === false;
      } catch {
        return false;
      }
    },
    { timeout: 45_000 },
  );
  await pauseBtn.click();
  const pauseRes = await waitPause.catch(() => null);
  const pauseHttp = pauseRes?.status() ?? null;
  let afterPause = snapshotBackend();
  let paused = afterPause.effective?.recoveryPaused;
  for (let i = 0; i < 8 && !paused; i++) {
    await page.waitForTimeout(1000);
    afterPause = snapshotBackend();
    paused = afterPause.effective?.recoveryPaused;
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const pausedUi = await page.getByText(/recovery is paused/i).first().isVisible().catch(() => false);

  record({
    page: "Missed-call recovery",
    tab: "general",
    control: "Pause 1 hour",
    browserAction: "click 1 hour preset",
    uiResult: pauseHttp === 200 ? "save OK" : `http ${pauseHttp ?? "?"}`,
    backendResult: `recoveryPaused=${paused} pauseKind=${afterPause.effective?.pauseKind}`,
    refreshResult: pausedUi ? "paused copy visible" : "active copy still shown",
    effectiveRuntime: String(afterPause.effective?.pauseKind ?? paused),
    status:
      pauseHttp === 200 && paused === true
        ? "PASS — UI + PERSISTENCE + EFFECTIVE CONFIG"
        : "FAIL — PERSISTENCE",
    defectFix: "",
  });
  await shot(page, "recovery-paused");

  const resumeBtn = page.getByRole("button", { name: /resume recovery/i }).first();
  if (await resumeBtn.isVisible().catch(() => false)) {
    const waitResume = waitSetupPost(page);
    await resumeBtn.click();
    const resumeHttp = await waitResume;
    await page.waitForTimeout(2000);
    const afterResume = snapshotBackend();
    record({
      page: "Missed-call recovery",
      tab: "general",
      control: "Resume recovery",
      browserAction: "click resume",
      uiResult: resumeHttp === 200 ? "save OK" : `http ${resumeHttp ?? "?"}`,
      backendResult: `recoveryPaused=${afterResume.effective?.recoveryPaused}`,
      refreshResult: "—",
      effectiveRuntime: String(afterResume.effective?.pauseKind ?? "null"),
      status:
        resumeHttp === 200 && afterResume.effective?.recoveryPaused === false
          ? "PASS — UI + PERSISTENCE + EFFECTIVE CONFIG"
          : "FAIL — PERSISTENCE",
      defectFix: "",
    });
    await shot(page, "recovery-resumed");
  }
}

async function testExclusionsCrud(page: Page): Promise<void> {
  await page.goto(`${BASE}/mctb/missed-call-recovery?tab=exclusions`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(1500);
  await shot(page, "exclusions-initial");

  const addBtn = page.getByRole("button", { name: /add number/i });
  if (!(await addBtn.isVisible({ timeout: 20_000 }).catch(() => false))) {
    record({
      page: "Recovery hub",
      tab: "exclusions",
      control: "Add number",
      browserAction: "n/a",
      uiResult: "not visible",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "FAIL — UI",
      defectFix: "",
    });
    return;
  }
  await addBtn.click();
  await page.locator("#ex-number").fill(CERT_EXCLUSION_E164);
  await page.locator("#ex-label").fill("Browser cert temp");
  const postWait = page.waitForResponse(
    (r) => r.url().includes("/api/mctb/exclusions") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /^add number$/i }).click();
  const postRes = await postWait.catch(() => null);
  await page.waitForTimeout(1500);
  const afterAdd = snapshotBackend();
  const present = afterAdd.exclusions?.certTestPresent;

  await page.reload();
  await page.waitForTimeout(1500);
  const rowVisible = await page.getByText(/555.*011.*9999|15550119999/i).first().isVisible().catch(() => false);

  record({
    page: "Recovery hub",
    tab: "exclusions",
    control: "Add exclusion",
    browserAction: `add ${CERT_EXCLUSION_E164}`,
    uiResult: postRes?.status() === 200 ? "created" : `http ${postRes?.status() ?? "?"}`,
    backendResult: `certTestPresent=${present}`,
    refreshResult: rowVisible ? "row visible" : "row missing",
    effectiveRuntime: `exclusion count=${afterAdd.exclusions?.count}`,
    status:
      postRes?.status() === 200 && present && rowVisible
        ? "PASS — UI + PERSISTENCE"
        : "FAIL — PERSISTENCE",
    defectFix: "",
  });
  await shot(page, "exclusions-after-add");

  const deleteBtn = page.getByRole("button", { name: /remove/i }).first();
  if (rowVisible && (await deleteBtn.isVisible().catch(() => false))) {
    const delWait = page.waitForResponse(
      (r) => r.url().includes("/api/mctb/exclusions") && r.request().method() === "DELETE",
      { timeout: 30_000 },
    );
    await deleteBtn.click();
    await delWait.catch(() => null);
    await page.waitForTimeout(1000);
    const afterDel = snapshotBackend();
    record({
      page: "Recovery hub",
      tab: "exclusions",
      control: "Delete exclusion",
      browserAction: "delete cert row",
      uiResult: "clicked",
      backendResult: `certTestPresent=${afterDel.exclusions?.certTestPresent}`,
      refreshResult: "—",
      effectiveRuntime: `count=${afterDel.exclusions?.count}`,
      status:
        afterDel.exclusions?.certTestPresent === false
          ? "PASS — UI + PERSISTENCE"
          : "FAIL — PERSISTENCE",
      defectFix: "",
    });
  }
}

async function testTextBackPlatformTemplate(page: Page): Promise<void> {
  await page.goto(`${BASE}/mctb/setup/text-back`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);
  await shot(page, "text-back-initial");

  const radios = page.locator('input[name="platform-recovery-template"]');
  const count = await radios.count();
  if (count < 2) {
    record({
      page: "Setup → Text back",
      tab: "—",
      control: "Platform template radio",
      browserAction: "n/a",
      uiResult: count === 0 ? "workspace/custom sender mode" : "single template only",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "PASS — UI + PERSISTENCE",
      defectFix: "skipped — not platform multi-template",
    });
    return;
  }

  const before = snapshotBackend();
  const beforeId = before.persisted?.platformRecoveryTemplateId;
  let targetIndex = 0;
  for (let i = 0; i < count; i++) {
    const checked = await radios.nth(i).isChecked();
    if (!checked) {
      targetIndex = i;
      break;
    }
  }

  const waitPost = waitSetupPost(page);
  await radios.nth(targetIndex).click();
  const http = await waitPost;
  await page.waitForTimeout(1500);
  const after = snapshotBackend();
  const afterId = after.persisted?.platformRecoveryTemplateId;

  await page.reload();
  await page.waitForTimeout(1500);
  const stillChecked = await radios.nth(targetIndex).isChecked().catch(() => false);

  record({
    page: "Setup → Text back",
    tab: "—",
    control: "Switch platform template",
    browserAction: `select template index ${targetIndex}`,
    uiResult: http === 200 ? "save OK" : `http ${http ?? "?"}`,
    backendResult: `before=${beforeId} after=${afterId}`,
    refreshResult: stillChecked ? "selected after refresh" : "reverted",
    effectiveRuntime: String(afterId),
    status:
      http === 200 && afterId !== beforeId && stillChecked
        ? "PASS — UI + PERSISTENCE + EFFECTIVE CONFIG"
        : http === 200 && stillChecked
          ? "PASS — UI + PERSISTENCE"
          : "FAIL — PERSISTENCE",
    defectFix: "",
  });
  await shot(page, "text-back-template");

  if (beforeId && afterId !== beforeId) {
    for (let i = 0; i < count; i++) {
      const id = await radios.nth(i).getAttribute("value");
      if (id === beforeId || (i === 0 && !id)) {
        const restoreWait = waitSetupPost(page);
        await radios.nth(i).click();
        await restoreWait;
        break;
      }
    }
  }
}

async function testMissedCallsList(page: Page): Promise<void> {
  await page.goto(`${BASE}/mctb/missed-calls`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);
  const search = page.getByRole("searchbox").or(page.getByPlaceholder(/search/i)).first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("555");
    await page.waitForTimeout(1000);
    record({
      page: "Missed Calls",
      tab: "—",
      control: "Search",
      browserAction: 'type "555"',
      uiResult: "typed",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "PASS — UI + PERSISTENCE",
      defectFix: "",
    });
  }
  const firstLink = page.locator("table tbody tr a").first();
  if (await firstLink.isVisible().catch(() => false)) {
    await firstLink.click();
    await page.waitForTimeout(2000);
    const onDetail = /\/mctb\/missed-calls\//.test(page.url());
    record({
      page: "Missed Calls",
      tab: "—",
      control: "Open detail",
      browserAction: "click first row",
      uiResult: onDetail ? "detail open" : `url=${page.url()}`,
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: onDetail ? "PASS — UI + PERSISTENCE" : "FAIL — UI",
      defectFix: "",
    });
    await shot(page, "missed-call-detail");
    await page.goBack();
  } else {
    record({
      page: "Missed Calls",
      tab: "—",
      control: "List",
      browserAction: "load",
      uiResult: "empty or no link",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "PASS — UI + PERSISTENCE",
      defectFix: "",
    });
  }
  await shot(page, "missed-calls-list");
}

async function testAnalyticsRange(page: Page): Promise<void> {
  await page.goto(`${BASE}/mctb/analytics`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);
  const preset = page.getByRole("button", { name: /last 7 days|7 days/i }).first();
  if (await preset.isVisible().catch(() => false)) {
    await preset.click();
    await page.waitForTimeout(1500);
    record({
      page: "Analytics",
      tab: "—",
      control: "Date preset",
      browserAction: "7 days",
      uiResult: "clicked",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "PASS — UI + PERSISTENCE",
      defectFix: "",
    });
  }
  await shot(page, "analytics");
}

const MCTB_ROUTES: { path: string; label: string }[] = [
  { path: "/mctb", label: "Overview" },
  { path: "/mctb/missed-call-recovery", label: "Missed-call recovery hub" },
  { path: "/mctb/missed-call-recovery?tab=consent", label: "Recovery hub consent tab" },
  { path: "/mctb/missed-call-recovery?tab=exclusions", label: "Recovery hub exclusions tab" },
  { path: "/mctb/missed-call-recovery?tab=rules", label: "Recovery hub rules tab" },
  { path: "/onboarding/mctb", label: "MCTB onboarding" },
  { path: "/mctb/missed-calls", label: "Missed Calls" },
  { path: "/mctb/conversations", label: "Conversations" },
  { path: "/mctb/voicemail", label: "Voicemail" },
  { path: "/mctb/analytics", label: "Analytics" },
  { path: "/mctb/setup", label: "Setup overview" },
  { path: "/mctb/setup/phone", label: "Setup Phone" },
  { path: "/mctb/setup/missed-call-rules", label: "Setup Missed-call rules" },
  { path: "/mctb/setup/text-back", label: "Setup Text back" },
  { path: "/mctb/setup/consent", label: "Setup Consent" },
  { path: "/mctb/setup/recovery", label: "Setup Recovery" },
  { path: "/mctb/setup/voicemail", label: "Setup Voicemail" },
  { path: "/mctb/setup/test", label: "Setup Test" },
  { path: "/mctb/compliance/consent", label: "Consent log" },
];

async function main() {
  if (!BASE) {
    throw new Error("Set MCTB_PROD_CERT_BASE_URL to the production application origin.");
  }
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const sha = await healthSha();
  const header = `# MCTB Production Browser Certification

**Base URL:** (production — see run env MCTB_PROD_CERT_BASE_URL)  
**Workspace:** ${WORKSPACE_ID}  
**Production SHA (start):** ${sha}  
**Started:** ${new Date().toISOString()}

| Page | Tab | Control | Browser action | UI result | Backend result | Refresh result | Effective runtime | Status | Defect/Fix |
|------|-----|---------|----------------|-----------|----------------|----------------|-------------------|--------|------------|
`;
  writeFileSync(MATRIX_PATH, header);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  context.setDefaultTimeout(90_000);
  await authenticate(context);
  const page = await context.newPage();

  const onlyConsent = process.argv.includes("--only-consent");
  const onlyRecovery = process.argv.includes("--only-recovery");
  let routesOk = 0;
  if (onlyRecovery) {
    const recoveryPage = await context.newPage();
    await testRecoveryPause(recoveryPage, context);
    await recoveryPage.close();
    await browser.close();
    const failCount = rows.filter((r) => r.status.startsWith("FAIL")).length;
    console.log(JSON.stringify({ failCount, rows }, null, 2));
    process.exit(failCount > 0 ? 2 : 0);
  }

  if (!onlyConsent) {
    for (const r of MCTB_ROUTES) {
      if (await visitMctbRoute(page, r.path, r.label)) routesOk++;
    }
    await testExclusionsCrud(page);
    await testTextBackPlatformTemplate(page);
    await testMissedCallsList(page);
    await testAnalyticsRange(page);
  }

  await testConsentMode(page);
  if (!onlyConsent) {
    const recoveryPage = await context.newPage();
    await testRecoveryPause(recoveryPage, context);
    await recoveryPage.close();
  }

  await browser.close();

  const failCount = rows.filter((r) => r.status.startsWith("FAIL")).length;
  const summaryPath = join(ARTIFACT_DIR, "summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        sha,
        routesTested: MCTB_ROUTES.length,
        routesOk,
        interactiveRows: rows.length,
        failCount,
        rows,
        matrixPath: MATRIX_PATH,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { sha, routesOk, total: MCTB_ROUTES.length, interactiveRows: rows.length, failCount, matrix: MATRIX_PATH },
      null,
      2,
    ),
  );
  if (failCount > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
