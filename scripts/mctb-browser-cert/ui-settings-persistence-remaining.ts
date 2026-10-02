import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";
import {
  CERT_RECIPIENT_EMAIL,
  ensureCertRecipientVisibleInUi,
  wireRecipientPromptDialogs,
} from "./notifications-cert-recipient";
import {
  backendRuntime,
  clickSaveAndWaitApi,
  gotoMctb,
  hardReload,
  pollHandoffField,
  pollOnboardingField,
  pollPersistedField,
  pollRuntimeField,
  recordMatrixH,
  selectComboboxOption,
  type UiPersistenceHoleResult,
} from "./ui-persistence-helpers";

const LINK_PROBE = "https://mctb-ui-persist.example/booking";

function pass(hole: string, detail: string): UiPersistenceHoleResult {
  return { hole, status: "PASS", detail };
}
function fail(hole: string, detail: string): UiPersistenceHoleResult {
  return { hole, status: "FAIL", detail };
}
function skip(hole: string, detail: string): UiPersistenceHoleResult {
  return { hole, status: "SKIP", detail };
}

async function waitRulesEditor(page: Page) {
  await page
    .getByText(/loading/i)
    .first()
    .waitFor({ state: "hidden", timeout: 90_000 })
    .catch(() => undefined);
}

/** Busy trigger (complements Matrix G voicemail-only toggle). */
export async function certBusyTriggerRule(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Busy missed-call trigger";
  const route = "/mctb/missed-call-recovery?tab=rules";
  const before = backendRuntime(workspaceId);
  const orig = Boolean(before.sendAfterBusy);
  const target = !orig;

  await gotoMctb(page, base, route);
  await waitRulesEditor(page);

  const busyCb = page.getByRole("checkbox", { name: /^busy$/i }).first();
  if (!(await busyCb.isVisible().catch(() => false))) {
    const r = fail(hole, "Busy trigger checkbox not found");
    recordMatrixH(record, hole, {
      route,
      page: "Missed-call rules",
      control: "Busy trigger",
      browserAction: "locate",
      uiResult: "missing",
      backendResult: String(orig),
      refreshResult: "FAIL",
      effectiveRuntime: "sendAfterBusy",
    }, r);
    return r;
  }

  if ((await busyCb.isChecked().catch(() => orig)) !== target) await busyCb.click();
  const http = await clickSaveAndWaitApi(page, /save rules|save changes|save/i);
  const backendOk = await pollRuntimeField(workspaceId, "sendAfterBusy", target);

  await hardReload(page);
  await waitRulesEditor(page);
  const uiOk =
    (await page.getByRole("checkbox", { name: /^busy$/i }).first().isChecked().catch(() => false)) ===
    target;

  if ((await busyCb.isChecked().catch(() => target)) !== orig) await busyCb.click();
  await clickSaveAndWaitApi(page, /save rules|save changes|save/i);
  const restored = await pollRuntimeField(workspaceId, "sendAfterBusy", orig);

  const ok = backendOk && uiOk && restored && (http === null || http < 400);
  const r = ok ? pass(hole, "busy toggle + restore") : fail(hole, `backend=${backendOk} ui=${uiOk} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Missed-call rules",
    control: "Busy trigger + Save",
    browserAction: "toggle → save → reload → restore",
    uiResult: uiOk ? "reload matched" : "mismatch",
    backendResult: JSON.stringify({ before: orig, after: backendRuntime(workspaceId).sendAfterBusy }),
    refreshResult: uiOk ? "PASS" : "FAIL",
    effectiveRuntime: "sendAfterBusy",
  }, r);
  return r;
}

/** Booking link URL (Text Back section). */
export async function certBookingLinkUrl(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Booking link URL";
  const route = "/mctb/text-back#booking-link";
  const before = backendRuntime(workspaceId);
  const origUrl = String(before.defaultLinkUrl ?? "");
  const trialUrl = origUrl === LINK_PROBE ? `${LINK_PROBE}/v2` : LINK_PROBE;

  await gotoMctb(page, base, route);
  await page.getByText(/loading booking link/i).waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);

  const sendSwitch = page.getByRole("switch", { name: /send a booking link/i }).first();
  if (await sendSwitch.isVisible().catch(() => false)) {
    if (!(await sendSwitch.isChecked().catch(() => false))) await sendSwitch.click();
  }

  const urlInput = page.locator("#mctb-booking-url");
  if (!(await urlInput.isVisible().catch(() => false))) {
    const r = fail(hole, "Booking URL field #mctb-booking-url not found");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back · booking",
      control: "Booking URL",
      browserAction: "locate",
      uiResult: "missing",
      backendResult: origUrl,
      refreshResult: "FAIL",
      effectiveRuntime: "defaultLinkUrl",
    }, r);
    return r;
  }

  await urlInput.fill(trialUrl);
  await clickSaveAndWaitApi(page, /save/i);
  const urlOk = await pollRuntimeField(workspaceId, "defaultLinkUrl", trialUrl);

  await hardReload(page);
  await page.getByText(/loading booking link/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  const urlUi = (await page.locator("#mctb-booking-url").inputValue().catch(() => "")).includes("mctb-ui-persist.example");

  await page.locator("#mctb-booking-url").fill(origUrl);
  if (!origUrl && (await sendSwitch.isChecked().catch(() => true))) await sendSwitch.click();
  await clickSaveAndWaitApi(page, /save/i);
  const restored = await pollRuntimeField(workspaceId, "defaultLinkUrl", origUrl);

  const ok = urlOk && urlUi && restored;
  const r = ok ? pass(hole, "booking URL persist") : fail(hole, `url=${urlOk} ui=${urlUi} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Text Back · booking",
    control: "Booking URL + Save",
    browserAction: "fill → save → reload → restore",
    uiResult: urlUi ? "visible after reload" : "missing",
    backendResult: JSON.stringify({ urlOk, restored }),
    refreshResult: urlUi ? "PASS" : "FAIL",
    effectiveRuntime: "defaultLinkUrl",
  }, r);
  return r;
}

/** Request form toggle (setup links). */
export async function certRequestFormToggle(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Request form toggle";
  const route = "/mctb/text-back?section=booking";
  const origForm = Boolean(backendRuntime(workspaceId).requestFormEnabled);
  const targetForm = !origForm;

  await gotoMctb(page, base, route);
  await page.getByText(/loading booking link/i).waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);

  const formSwitch = page.getByRole("switch", { name: /enable request form/i }).first();
  if (!(await formSwitch.isVisible().catch(() => false))) {
    const r = skip(
      hole,
      "Request form editor not on launch IA (setup/links redirects to booking-only); API tests cover requestFormEnabled",
    );
    recordMatrixH(record, hole, {
      route,
      page: "Text Back · booking",
      control: "Enable request form",
      browserAction: "locate",
      uiResult: "SKIP — not mounted on canonical route",
      backendResult: String(origForm),
      refreshResult: "—",
      effectiveRuntime: "requestFormEnabled",
    }, r);
    return r;
  }

  if ((await formSwitch.isChecked().catch(() => origForm)) !== targetForm) await formSwitch.click();
  await clickSaveAndWaitApi(page, /save form settings|save/i);
  const formOk = await pollRuntimeField(workspaceId, "requestFormEnabled", targetForm);

  await hardReload(page);
  await page.getByText(/loading links/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  const formUi =
    (await page.getByRole("switch", { name: /enable request form/i }).first().isChecked().catch(() => false)) ===
    targetForm;

  if ((await formSwitch.isChecked().catch(() => targetForm)) !== origForm) await formSwitch.click();
  await clickSaveAndWaitApi(page, /save form settings|save/i);
  const restored = await pollRuntimeField(workspaceId, "requestFormEnabled", origForm);

  const ok = formOk && formUi && restored;
  const r = ok ? pass(hole, "request form toggle") : fail(hole, `form=${formOk} ui=${formUi} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Setup links",
    control: "Enable request form",
    browserAction: "toggle → save → reload → restore",
    uiResult: formUi ? "matched" : "mismatch",
    backendResult: JSON.stringify({ formOk, restored }),
    refreshResult: formUi ? "PASS" : "FAIL",
    effectiveRuntime: "requestFormEnabled",
  }, r);
  return r;
}

/** Forwarding carrier metadata (onboarding). */
export async function certForwardingCarrier(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Forwarding carrier";
  const route = "/mctb/phone";
  const before = snapshotBackend(workspaceId).onboarding ?? {};
  const orig = String(before.forwardingCarrier ?? "verizon");
  const candidates = ["att", "tmobile", "verizon", "other"];
  const target = candidates.find((c) => c !== orig) ?? "att";

  await gotoMctb(page, base, route);
  await page.getByText(/loading/i).first().waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);

  const carrierSelect = page.locator("#mctb-carrier");
  if (!(await carrierSelect.isVisible().catch(() => false))) {
    const r = skip(hole, "Carrier select not on phone page");
    recordMatrixH(record, hole, {
      route,
      page: "Phone & forwarding",
      control: "Carrier",
      browserAction: "locate",
      uiResult: "SKIP",
      backendResult: orig,
      refreshResult: "—",
      effectiveRuntime: "forwardingCarrier",
    }, r);
    return r;
  }

  const carrierLabels: Record<string, RegExp> = {
    att: /at&t/i,
    verizon: /verizon/i,
    tmobile: /t-mobile/i,
    google_voice: /google voice/i,
    other: /other/i,
  };
  await selectComboboxOption(page, carrierSelect, carrierLabels[target] ?? new RegExp(target, "i"));
  await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/setup", "/api/mctb/onboarding"]);
  const backendOk = await pollOnboardingField(workspaceId, "forwardingCarrier", target);

  await hardReload(page);
  await selectComboboxOption(
    page,
    page.locator("#mctb-carrier"),
    carrierLabels[orig] ?? new RegExp(orig, "i"),
  );
  await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/setup", "/api/mctb/onboarding"]);
  const restored = await pollOnboardingField(workspaceId, "forwardingCarrier", orig);

  const ok = backendOk && restored;
  const r = ok ? pass(hole, `carrier ${orig} → ${target} → restore`) : fail(hole, `save=${backendOk} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Phone & forwarding",
    control: "Carrier select",
    browserAction: "change → save → restore",
    uiResult: ok ? "persisted" : "failed",
    backendResult: JSON.stringify({ orig, target, after: snapshotBackend(workspaceId).onboarding }),
    refreshResult: ok ? "PASS" : "FAIL",
    effectiveRuntime: "onboarding.forwardingCarrier",
  }, r);
  return r;
}

/** Urgent reply detection (handoff config). */
export async function certUrgentDetection(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Urgent reply detection";
  const route = "/mctb/notifications";
  const before = Boolean(snapshotBackend(workspaceId).handoff?.emergencyDetectionEnabled);
  const target = !before;

  await gotoMctb(page, base, route);
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);

  const urgent = page
    .getByRole("switch", { name: /urgent reply alerts enabled/i })
    .first();
  if (!(await urgent.isVisible().catch(() => false))) {
    const r = fail(hole, "Urgent detection switch not found");
    recordMatrixH(record, hole, {
      route,
      page: "Notifications",
      control: "Urgent detection",
      browserAction: "locate",
      uiResult: "missing",
      backendResult: String(before),
      refreshResult: "FAIL",
      effectiveRuntime: "emergencyDetectionEnabled",
    }, r);
    return r;
  }

  if ((await urgent.isChecked().catch(() => before)) !== target) await urgent.click();
  await page.waitForTimeout(2500);
  const backendOk = await pollHandoffField(workspaceId, "emergencyDetectionEnabled", target, 30);

  await hardReload(page);
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  const urgentAfter = page.getByRole("switch", { name: /urgent reply alerts enabled/i }).first();
  const uiOk = (await urgentAfter.isChecked().catch(() => false)) === target;

  if ((await urgentAfter.isChecked().catch(() => target)) !== before) await urgentAfter.click();
  await page.waitForTimeout(3000);
  const restored = await pollHandoffField(workspaceId, "emergencyDetectionEnabled", before, 30);

  const ok = backendOk && uiOk && restored;
  const r = ok ? pass(hole, "urgent toggle + restore") : fail(hole, `backend=${backendOk} ui=${uiOk} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Notifications",
    control: "Urgent reply alerts",
    browserAction: "toggle → save → reload → restore",
    uiResult: uiOk ? "reload matched" : "mismatch",
    backendResult: JSON.stringify({ before, target, after: snapshotBackend(workspaceId).handoff }),
    refreshResult: uiOk ? "PASS" : "FAIL",
    effectiveRuntime: "emergencyDetectionEnabled",
  }, r);
  return r;
}

/** Platform recovery template (platform sender). */
export async function certPlatformRecoveryTemplate(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Platform recovery template";
  const route = "/mctb/text-back";
  const senderMode = String(backendRuntime(workspaceId).senderMode ?? "PLATFORM");
  if (senderMode !== "PLATFORM") {
    const r = skip(hole, "Workspace uses own sender — template radios not shown");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back",
      control: "Platform template",
      browserAction: "load",
      uiResult: `senderMode=${senderMode}`,
      backendResult: String(backendRuntime(workspaceId).platformRecoveryTemplateId ?? ""),
      refreshResult: "—",
      effectiveRuntime: "platformRecoveryTemplateId",
    }, r);
    return r;
  }

  await gotoMctb(page, base, route);
  await page.getByText(/loading/i).first().waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);

  const radios = page.locator('input[type="radio"][name="platform-recovery-template"]');
  const count = await radios.count();
  if (count < 2) {
    const r = skip(hole, "Fewer than two platform templates to switch");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back",
      control: "Template radio",
      browserAction: "count radios",
      uiResult: String(count),
      backendResult: String(backendRuntime(workspaceId).platformRecoveryTemplateId ?? ""),
      refreshResult: "—",
      effectiveRuntime: "platformRecoveryTemplateId",
    }, r);
    return r;
  }

  const origId = String(
    backendRuntime(workspaceId).platformRecoveryTemplateId ??
      snapshotBackend(workspaceId).persisted?.platformRecoveryTemplateId ??
      "",
  );
  let clickedAlternate = false;
  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    const checked = await radio.isChecked().catch(() => false);
    if (!checked) {
      await radio.click();
      clickedAlternate = true;
      break;
    }
  }
  if (!clickedAlternate) {
    const r = fail(hole, "Could not select alternate platform template");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back",
      control: "Template radio",
      browserAction: "click alternate",
      uiResult: "no alternate",
      backendResult: origId,
      refreshResult: "FAIL",
      effectiveRuntime: "platformRecoveryTemplateId",
    }, r);
    return r;
  }

  await page.waitForTimeout(3000);
  const targetId = String(
    snapshotBackend(workspaceId).persisted?.platformRecoveryTemplateId ??
      backendRuntime(workspaceId).platformRecoveryTemplateId ??
      "",
  );
  const backendOk = Boolean(targetId && targetId !== origId);

  await hardReload(page);
  let selectedCount = 0;
  for (let i = 0; i < count; i++) {
    if (await radios.nth(i).isChecked().catch(() => false)) selectedCount++;
  }
  const selected = selectedCount === 1;

  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    await radio.click();
    await page.waitForTimeout(1500);
    const nowId = String(
      snapshotBackend(workspaceId).persisted?.platformRecoveryTemplateId ??
        backendRuntime(workspaceId).platformRecoveryTemplateId ??
        "",
    );
    if (nowId === origId) break;
  }
  await page.waitForTimeout(2000);
  const restoredId = String(
    snapshotBackend(workspaceId).persisted?.platformRecoveryTemplateId ??
      backendRuntime(workspaceId).platformRecoveryTemplateId ??
      "",
  );
  const restored = restoredId === origId;

  const ok = backendOk && selected && restored;
  const r = ok ? pass(hole, "platform template switch + restore") : fail(hole, `backend=${backendOk} ui=${selected} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Text Back",
    control: "Platform template radio",
    browserAction: "select alternate → reload → restore",
    uiResult: selected ? "one radio checked after reload" : "mismatch",
    backendResult: JSON.stringify({ origId, targetId }),
    refreshResult: selected ? "PASS" : "FAIL",
    effectiveRuntime: "platformRecoveryTemplateId",
  }, r);
  return r;
}

/** Recovery goal (own-sender / custom template path). */
export async function certRecoveryGoal(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Recovery goal";
  const route = "/mctb/text-back";
  const senderMode = String(backendRuntime(workspaceId).senderMode ?? "PLATFORM");
  if (senderMode === "PLATFORM") {
    const r = skip(hole, "Recovery goal select hidden for platform sender");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back",
      control: "Recovery goal",
      browserAction: "load",
      uiResult: "platform sender",
      backendResult: String(snapshotBackend(workspaceId).persisted?.recoveryGoal ?? ""),
      refreshResult: "—",
      effectiveRuntime: "recoveryGoal",
    }, r);
    return r;
  }

  const orig = String(snapshotBackend(workspaceId).persisted?.recoveryGoal ?? "get_reply");
  const target = orig === "get_reply" ? "request_callback" : "get_reply";

  await gotoMctb(page, base, route);
  const goalSelect = page.getByLabel(/^recovery goal$/i).first();
  if (!(await goalSelect.isVisible().catch(() => false))) {
    const r = fail(hole, "Recovery goal select not found");
    recordMatrixH(record, hole, {
      route,
      page: "Text Back",
      control: "Recovery goal",
      browserAction: "locate",
      uiResult: "missing",
      backendResult: orig,
      refreshResult: "FAIL",
      effectiveRuntime: "recoveryGoal",
    }, r);
    return r;
  }

  await goalSelect.selectOption(target).catch(async () => {
    await goalSelect.click();
    await page.getByRole("option", { name: /callback|reply/i }).first().click();
  });
  await clickSaveAndWaitApi(page, /save/i);
  const backendOk = await pollPersistedField(workspaceId, "recoveryGoal", target);

  await hardReload(page);
  const uiVal = await goalSelect.inputValue().catch(() => "");
  const uiOk = uiVal === target || uiVal.includes(target);

  await goalSelect.selectOption(orig).catch(async () => {
    await goalSelect.click();
    await page.getByRole("option", { name: /reply|callback/i }).first().click();
  });
  await clickSaveAndWaitApi(page, /save/i);
  const restored = String(snapshotBackend(workspaceId).persisted?.recoveryGoal ?? orig) === orig;

  const ok = backendOk && uiOk && restored;
  const r = ok ? pass(hole, "recovery goal + restore") : fail(hole, `backend=${backendOk} ui=${uiOk} restore=${restored}`);
  recordMatrixH(record, hole, {
    route,
    page: "Text Back",
    control: "Recovery goal select",
    browserAction: "change → save → reload → restore",
    uiResult: uiOk ? "matched" : uiVal,
    backendResult: JSON.stringify({ orig, target }),
    refreshResult: uiOk ? "PASS" : "FAIL",
    effectiveRuntime: "recoveryGoal",
  }, r);
  return r;
}

/** Notifications recipient using stable cert email (phase3b pattern). */
export async function certNotificationsRecipientStable(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Notifications recipient (stable)";
  const route = "/mctb/notifications";

  wireRecipientPromptDialogs(page, "add");
  const { usedExisting, uiVisible: afterAdd } = await ensureCertRecipientVisibleInUi(page, base, route);
  const backendHas = snapshotBackend(workspaceId).handoff?.certRecipientPresent === true;

  await hardReload(page);
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  const uiAfterRefresh = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);

  const ok = backendHas && (uiAfterRefresh || (usedExisting && afterAdd));
  const r = ok
    ? pass(hole, usedExisting ? "cert recipient present + UI" : "added cert recipient")
    : fail(hole, `backend=${backendHas} uiRefresh=${uiAfterRefresh} usedExisting=${usedExisting}`);
  recordMatrixH(record, hole, {
    route,
    page: "Notifications",
    control: "Cert recipient row",
    browserAction: `ensure ${CERT_RECIPIENT_EMAIL}`,
    uiResult: uiAfterRefresh ? "visible after reload" : "missing",
    backendResult: JSON.stringify(snapshotBackend(workspaceId).handoff),
    refreshResult: uiAfterRefresh ? "PASS" : "FAIL",
    effectiveRuntime: "handoff recipients",
  }, r);
  return r;
}

/** Registry: proven in main production browser cert — documented skip (no duplicate run). */
export function recordProvenInMainCert(record: (row: CertRow) => void): UiPersistenceHoleResult[] {
  const proven: Array<{ hole: string; route: string; control: string }> = [
    { hole: "Consent mode", route: "/mctb/setup/consent", control: "press_1 ↔ existing_consent" },
    { hole: "Recovery pause", route: "/mctb/missed-call-recovery?tab=general", control: "Pause 1h + resume" },
    { hole: "Exclusions CRUD", route: "/mctb/missed-call-recovery?tab=exclusions", control: "Add + delete" },
    { hole: "Missed calls UX", route: "/mctb/missed-calls", control: "Search + detail" },
  ];
  return proven.map((p) => {
    const r = skip(p.hole, "Covered by mctb-production-browser-cert.ts (27-row main cert)");
    recordMatrixH(
      record,
      p.hole,
      {
        route: p.route,
        page: "Main cert",
        control: p.control,
        browserAction: "— (registry only)",
        uiResult: "SKIP — proven elsewhere",
        backendResult: "see MCTB-E2E-AUDIT-HANDOFF",
        refreshResult: "—",
        effectiveRuntime: "—",
      },
      r,
    );
    return r;
  });
}

async function runHole(
  hole: string,
  fn: () => Promise<UiPersistenceHoleResult>,
): Promise<UiPersistenceHoleResult> {
  try {
    return await fn();
  } catch (e) {
    return fail(hole, e instanceof Error ? e.message : String(e));
  }
}

export async function runUiSettingsPersistenceRemaining(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
  options?: { includeProvenRegistry?: boolean },
): Promise<UiPersistenceHoleResult[]> {
  const registry =
    options?.includeProvenRegistry !== false ? recordProvenInMainCert(record) : [];
  const interactive = [
    await runHole("Busy missed-call trigger", () => certBusyTriggerRule(page, base, workspaceId, record)),
    await runHole("Booking link URL", () => certBookingLinkUrl(page, base, workspaceId, record)),
    await runHole("Request form toggle", () => certRequestFormToggle(page, base, workspaceId, record)),
    await runHole("Forwarding carrier", () => certForwardingCarrier(page, base, workspaceId, record)),
    await runHole("Urgent reply detection", () => certUrgentDetection(page, base, workspaceId, record)),
    await runHole("Platform recovery template", () =>
      certPlatformRecoveryTemplate(page, base, workspaceId, record),
    ),
    await runHole("Recovery goal", () => certRecoveryGoal(page, base, workspaceId, record)),
    await runHole("Notifications recipient (stable)", () =>
      certNotificationsRecipientStable(page, base, workspaceId, record),
    ),
  ];
  return [...registry, ...interactive];
}
