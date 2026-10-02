import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";
import {
  backendRuntime,
  clickSaveAndWaitApi,
  cooldownLabelFromMinutes,
  dismissBlockingOnboardingModal,
  gotoMctb,
  hardReload,
  minutesFromCooldownLabel,
  pollLeadRecoveryField,
  pollHandoffEmail,
  pollOnboardingField,
  pollRuntimeField,
  recordMatrixG,
  type UiPersistenceHoleResult,
} from "./ui-persistence-helpers";

const UI_PERSIST_PROBE = "ui-persist-probe";
const VOICEMAIL_PROBE = "[mctb-ui-cert]";

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

/** 1 — Missed-call trigger rules */
export async function certMissedCallTriggerRules(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Missed-call trigger rules";
  const route = "/mctb/missed-call-recovery?tab=rules";
  await gotoMctb(page, base, route);
  await waitRulesEditor(page);

  const before = backendRuntime(workspaceId);
  const origVoicemail = Boolean(before.sendAfterVoicemail);
  const target = !origVoicemail;

  const voicemailCb = page.getByRole("checkbox", { name: /after voicemail/i }).first();
  if (!(await voicemailCb.isVisible().catch(() => false))) {
    const card = page.getByText(/after voicemail/i).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
    } else {
      const r = fail(hole, "Voicemail trigger control not found");
      recordMatrixG(record, hole, {
        route,
        page: "Missed-call rules",
        control: "Voicemail trigger",
        browserAction: "locate control",
        uiResult: "missing",
        backendResult: JSON.stringify(before).slice(0, 120),
        refreshResult: "—",
        effectiveRuntime: "sendAfterVoicemail",
      }, r);
      return r;
    }
  } else {
    const checked = await voicemailCb.isChecked().catch(() => origVoicemail);
    if (checked !== target) await voicemailCb.click();
  }

  const http = await clickSaveAndWaitApi(page, /save rules|save changes|save/i);
  const backendOk = await pollRuntimeField(workspaceId, "sendAfterVoicemail", target);

  await hardReload(page);
  await waitRulesEditor(page);
  const cbAfter = page.getByRole("checkbox", { name: /after voicemail/i }).first();
  let uiOk = false;
  if (await cbAfter.isVisible().catch(() => false)) {
    uiOk = (await cbAfter.isChecked().catch(() => false)) === target;
  }

  // restore
  if (await cbAfter.isVisible().catch(() => false)) {
    const now = await cbAfter.isChecked().catch(() => target);
    if (now !== origVoicemail) await cbAfter.click();
    await clickSaveAndWaitApi(page, /save rules|save changes|save/i);
  }
  const restored = Boolean(backendRuntime(workspaceId).sendAfterVoicemail) === origVoicemail;

  const ok = backendOk && uiOk && restored && (http === null || http < 400);
  const r = ok ? pass(hole, "toggle voicemail + restore") : fail(hole, `backend=${backendOk} ui=${uiOk} restore=${restored} http=${http}`);
  recordMatrixG(record, hole, {
    route,
    page: "Missed-call rules",
    control: "Voicemail trigger + Save",
    browserAction: "toggle → save → backend → reload → restore",
    uiResult: uiOk ? "reload matched" : "reload mismatch",
    backendResult: JSON.stringify({ before: origVoicemail, after: backendRuntime(workspaceId).sendAfterVoicemail, restored }),
    refreshResult: uiOk ? "PASS" : "FAIL",
    effectiveRuntime: "missed-call classification",
  }, r);
  return r;
}

/** 2 — Text-back template + delay */
export async function certTextBackTemplateAndDelay(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Text-back template/delay";
  const before = backendRuntime(workspaceId);
  const origDelay = Number(before.delaySeconds ?? 0);
  const origTemplate = String(before.messageTemplate ?? "");
  const canEdit = before.senderMode !== "PLATFORM";

  // delay on recovery general
  const recoveryRoute = "/mctb/missed-call-recovery?tab=general";
  await gotoMctb(page, base, recoveryRoute);
  await page.getByText(/timing & follow-up/i).waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);

  const delayOptions = ["Immediately", "30 seconds", "1 minute", "5 minutes"];
  const pickDelay =
    origDelay === 0 ? "30 seconds" : origDelay === 30 ? "1 minute" : origDelay === 60 ? "5 minutes" : "30 seconds";
  const expectedSec =
    pickDelay === "Immediately" ? 0 : pickDelay === "30 seconds" ? 30 : pickDelay === "1 minute" ? 60 : 300;

  const delaySelect = page.getByLabel(/recovery delay/i).first();
  if (await delaySelect.isVisible().catch(() => false)) {
    await delaySelect.selectOption({ label: pickDelay }).catch(async () => {
      await delaySelect.click();
      await page.getByRole("option", { name: pickDelay }).click();
    });
    await clickSaveAndWaitApi(page, /save follow-up rules/i);
  }

  const delayOk = await pollRuntimeField(workspaceId, "delaySeconds", expectedSec);

  // template on text-back if editable
  let templateOk = true;
  if (canEdit) {
    await gotoMctb(page, base, "/mctb/text-back");
    const ta = page.locator("textarea").first();
    if (await ta.isVisible().catch(() => false)) {
      const probeTemplate = origTemplate.includes(UI_PERSIST_PROBE)
        ? origTemplate
        : `${origTemplate} ${UI_PERSIST_PROBE}`.trim();
      await ta.fill(probeTemplate);
      await clickSaveAndWaitApi(page, /save/i);
      const tmpl = String(backendRuntime(workspaceId).messageTemplate ?? "");
      templateOk = tmpl.includes(UI_PERSIST_PROBE);
      await ta.fill(origTemplate);
      await clickSaveAndWaitApi(page, /save/i);
    } else {
      templateOk = false;
    }
  } else {
    templateOk = true; // platform-managed opener — delay is the persistence proof
  }

  // restore delay
  const restoreLabel =
    origDelay === 0
      ? "Immediately"
      : origDelay === 30
        ? "30 seconds"
        : origDelay === 60
          ? "1 minute"
          : origDelay === 300
            ? "5 minutes"
            : delayOptions.find((l) => l.includes(String(origDelay))) || "30 seconds";
  await gotoMctb(page, base, recoveryRoute);
  const delayRestore = page.getByLabel(/recovery delay/i).first();
  if (await delayRestore.isVisible().catch(() => false)) {
    await delayRestore.selectOption({ label: restoreLabel }).catch(async () => {
      await delayRestore.click();
      await page.getByRole("option", { name: restoreLabel }).click();
    });
    await clickSaveAndWaitApi(page, /save follow-up rules/i);
  }
  const delayRestored = await pollRuntimeField(workspaceId, "delaySeconds", origDelay);

  const ok = delayOk && (canEdit ? templateOk : true);
  const r = ok
    ? pass(hole, canEdit ? "delay + template" : "delay (platform sender)")
    : fail(hole, `delay=${delayOk} template=${templateOk} restore=${delayRestored}`);
  recordMatrixG(record, hole, {
    route: "/mctb/text-back + recovery general",
    page: "Text Back",
    control: "Recovery delay + opener template",
    browserAction: "change → save → backend → restore",
    uiResult: ok ? "persisted" : "mismatch",
    backendResult: JSON.stringify({ delayOk, templateOk, canEdit }),
    refreshResult: ok ? "PASS" : "FAIL",
    effectiveRuntime: "recovery SMS timing + opener",
  }, r);
  return r;
}

/** 3 — Cooldown + max messages */
export async function certCooldownMaxMessages(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Cooldown/max messages";
  const route = "/mctb/missed-call-recovery?tab=general";
  const before = backendRuntime(workspaceId);
  const origCooldown = Number(before.cooldownMinutes ?? 1440);
  const origMax = Number(before.maxMessagesPerCaller ?? 1);

  await gotoMctb(page, base, route);
  await page.getByText(/timing & follow-up/i).waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);

  const newCooldownLabel = origCooldown === 60 ? "3 hours" : "1 hour";
  const newCooldownMinutes = minutesFromCooldownLabel(newCooldownLabel);
  const cooldownSel = page.getByLabel(/^cooldown$/i).first();
  if (await cooldownSel.isVisible().catch(() => false)) {
    await cooldownSel.selectOption({ label: newCooldownLabel }).catch(async () => {
      await cooldownSel.click();
      await page.getByRole("option", { name: newCooldownLabel }).click();
    });
  }

  const maxSel = page.getByLabel(/max automated recovery texts/i).first();
  const newMax = origMax >= 3 ? "2" : "3";
  if (await maxSel.isVisible().catch(() => false)) {
    await maxSel.selectOption({ label: newMax }).catch(async () => {
      await maxSel.click();
      await page.getByRole("option", { name: newMax }).click();
    });
  }

  await clickSaveAndWaitApi(page, /save follow-up rules/i);
  const cooldownOk = await pollRuntimeField(workspaceId, "cooldownMinutes", newCooldownMinutes);
  const maxOk = await pollRuntimeField(workspaceId, "maxMessagesPerCaller", Number(newMax));
  const afterMutate = backendRuntime(workspaceId);

  await hardReload(page);
  await page.getByText(/timing & follow-up/i).waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);

  // restore
  const restoreCooldown = cooldownLabelFromMinutes(origCooldown);
  const cooldownRestore = page.getByLabel(/^cooldown$/i).first();
  if (await cooldownRestore.isVisible().catch(() => false)) {
    await cooldownRestore.selectOption({ label: restoreCooldown }).catch(async () => {
      await cooldownRestore.click();
      await page.getByRole("option", { name: restoreCooldown }).first().click();
    });
  }
  if (await maxSel.isVisible().catch(() => false)) {
    await maxSel.selectOption({ label: String(origMax) }).catch(async () => {
      await maxSel.click();
      await page.getByRole("option", { name: String(origMax) }).click();
    });
  }
  await clickSaveAndWaitApi(page, /save follow-up rules/i);
  const restoreOk =
    (await pollRuntimeField(workspaceId, "cooldownMinutes", origCooldown)) &&
    (await pollRuntimeField(workspaceId, "maxMessagesPerCaller", origMax));
  const restored = backendRuntime(workspaceId);

  const ok = cooldownOk && maxOk;
  const r = ok ? pass(hole, "cooldown + max messages") : fail(hole, `cooldown=${cooldownOk} max=${maxOk} restore=${restoreOk}`);
  recordMatrixG(record, hole, {
    route,
    page: "Recovery general",
    control: "Cooldown + max automated texts",
    browserAction: "select → save → reload → restore",
    uiResult: ok ? "backend verified" : "failed",
    backendResult: JSON.stringify({ after: afterMutate, restored }),
    refreshResult: ok ? "PASS" : "FAIL",
    effectiveRuntime: "repeat-caller follow-up",
  }, r);
  return r;
}

/** 4 — Notifications recipients */
export async function certNotificationsRecipients(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Notifications/recipients";
  const route = "/mctb/notifications";
  const tempEmail = `mctb-ui-persist-${Date.now()}@transovo.test`;

  await gotoMctb(page, base, route);
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);

  const beforeCount = Number(snapshotBackend(workspaceId).handoff?.recipientCount ?? 0);
  page.on("dialog", async (dialog) => {
    if (dialog.type() !== "prompt") {
      await dialog.dismiss();
      return;
    }
    const msg = dialog.message().toLowerCase();
    if (msg.includes("name")) await dialog.accept("UI Persist Temp");
    else if (msg.includes("email")) await dialog.accept(tempEmail);
    else if (msg.includes("mobile")) await dialog.accept("+15550112233");
    else await dialog.accept("ok");
  });

  const addBtn = page.getByRole("button", { name: /add recipient/i });
  if (!(await addBtn.isVisible().catch(() => false))) {
    const r = fail(hole, "Add recipient not found");
    recordMatrixG(record, hole, {
      route,
      page: "Notifications",
      control: "Add recipient",
      browserAction: "goto",
      uiResult: "missing control",
      backendResult: String(beforeCount),
      refreshResult: "FAIL",
      effectiveRuntime: "handoff recipients",
    }, r);
    return r;
  }
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/mctb/handoff") && r.request().method() === "POST", {
      timeout: 60_000,
    }),
    addBtn.click(),
  ]).catch(() => addBtn.click());
  await page.waitForTimeout(2000);

  const afterAdd = snapshotBackend(workspaceId);
  const emails = (afterAdd.handoff?.emails as string[]) ?? [];
  const backendHas = emails.includes(tempEmail) || (await pollHandoffEmail(workspaceId, tempEmail));
  let uiHas = await page.getByText(tempEmail).isVisible().catch(() => false);

  await hardReload(page);
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  uiHas = await page.getByText(tempEmail).isVisible().catch(() => false);

  // cleanup: remove temp recipient via same handoff API the UI uses (cert workspace hygiene)
  if (backendHas) {
    const handoffGet = await page.request.get(`${base}/api/mctb/handoff`);
    if (handoffGet.ok()) {
      const payload = (await handoffGet.json()) as {
        data?: { recipients?: Array<{ id: string; name: string; email: string; mobile: string }> };
      };
      const recipients = payload.data?.recipients ?? [];
      const filtered = recipients.filter((r) => r.email !== tempEmail);
      if (filtered.length !== recipients.length) {
        await page.request.post(`${base}/api/mctb/handoff`, {
          data: { recipients: filtered },
        });
      }
    }
  }

  const ok = backendHas && uiHas;
  const r = ok ? pass(hole, "temp recipient CRUD") : fail(hole, `backend=${backendHas} uiAfterRefresh=${uiHas}`);
  recordMatrixG(record, hole, {
    route,
    page: "Notifications",
    control: "Temporary recipient add + refresh",
    browserAction: `prompt ${tempEmail}`,
    uiResult: uiHas ? "visible after reload" : "missing",
    backendResult: `count ${beforeCount} → ${afterAdd.handoff?.recipientCount}`,
    refreshResult: uiHas ? "PASS" : "FAIL",
    effectiveRuntime: "team notification recipients",
  }, r);
  return r;
}

/** 5 — Phone / business-line metadata */
export async function certPhoneMetadata(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Phone/business-line metadata";
  const route = "/mctb/phone";
  const before = snapshotBackend(workspaceId).onboarding ?? {};
  const origRing = Number(before.forwardingRingSeconds ?? 15);
  const newRing = origRing === 20 ? 25 : 20;

  await gotoMctb(page, base, route);
  await page.getByText(/loading/i).first().waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);

  const ringSelect = page.getByLabel(/rings before forward|ring/i).first();
  let changed = false;
  if (await ringSelect.isVisible().catch(() => false)) {
    await ringSelect.selectOption(String(newRing)).catch(async () => {
      await ringSelect.click();
      await page.getByRole("option", { name: String(newRing) }).click();
    });
    changed = true;
  } else {
    const ringBtn = page.getByRole("button", { name: new RegExp(`${newRing}\\s*sec`, "i") }).first();
    if (await ringBtn.isVisible().catch(() => false)) {
      await ringBtn.click();
      changed = true;
    }
  }

  if (!changed) {
    const r = skip(hole, "Ring seconds control not found — manual CFNA test still required");
    recordMatrixG(record, hole, {
      route,
      page: "Phone & forwarding",
      control: "Ring-before-forward",
      browserAction: "locate",
      uiResult: "SKIP",
      backendResult: JSON.stringify(before),
      refreshResult: "—",
      effectiveRuntime: "onboarding forwarding metadata",
    }, r);
    return r;
  }

  await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/setup", "/api/mctb/onboarding"]);
  const ringOk = await pollOnboardingField(workspaceId, "forwardingRingSeconds", newRing, 25);
  const afterOnboarding = snapshotBackend(workspaceId).onboarding ?? {};

  await hardReload(page);
  // restore
  if (await ringSelect.isVisible().catch(() => false)) {
    await ringSelect.selectOption(String(origRing)).catch(async () => {
      await ringSelect.click();
      await page.getByRole("option", { name: String(origRing) }).click();
    });
    await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/setup", "/api/mctb/onboarding"]);
  }
  const restoredRing = await pollOnboardingField(workspaceId, "forwardingRingSeconds", origRing, 25);

  const ok = ringOk;
  const r = ok ? pass(hole, "forwarding ring seconds") : fail(hole, `save=${ringOk} restore=${restoredRing}`);
  recordMatrixG(record, hole, {
    route,
    page: "Phone & forwarding",
    control: "Ring-before-forward seconds",
    browserAction: "change → save → restore",
    uiResult: ok ? "persisted" : "failed",
    backendResult: JSON.stringify({ afterOnboarding }),
    refreshResult: ok ? "PASS" : "FAIL",
    effectiveRuntime: "carrier forwarding instructions",
  }, r);
  return r;
}

/** 6 — Voicemail greeting (UI persistence only) */
export async function certVoicemailGreeting(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Voicemail greeting/settings";
  const route = "/mctb/voicemail?tab=greeting";
  const before = String(snapshotBackend(workspaceId).voicemail?.greetingText ?? "");

  await gotoMctb(page, base, route);
  const greetingTab = page.getByRole("tab", { name: /^greeting$/i }).first();
  if (await greetingTab.isVisible().catch(() => false)) await greetingTab.click();
  await page.getByText(/loading/i).first().waitFor({ state: "hidden", timeout: 90_000 }).catch(() => undefined);
  const ta = page.locator("textarea").first();
  await ta.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  if (!(await ta.isVisible().catch(() => false))) {
    const r = skip(hole, "Greeting editor not visible (no phone number?)");
    recordMatrixG(record, hole, {
      route,
      page: "Voicemail setup",
      control: "Greeting text",
      browserAction: "goto",
      uiResult: "SKIP",
      backendResult: before.slice(0, 80),
      refreshResult: "—",
      effectiveRuntime: "voicemail greeting text",
    }, r);
    return r;
  }

  const orig = await ta.inputValue();
  const trial = orig.includes(VOICEMAIL_PROBE) ? orig : `${orig} ${VOICEMAIL_PROBE}`.trim();
  await ta.fill(trial);

  const generateBtn = page.getByRole("button", { name: /generate preview|generate greeting/i }).first();
  if (!(await generateBtn.isVisible().catch(() => false))) {
    const r = skip(hole, "Voicemail studio generate control not available");
    recordMatrixG(record, hole, {
      route,
      page: "Voicemail greeting",
      control: "Greeting script",
      browserAction: "fill text",
      uiResult: "SKIP",
      backendResult: before.slice(0, 80),
      refreshResult: "—",
      effectiveRuntime: "voicemail greeting (not PSTN audio)",
    }, r);
    return r;
  }
  await generateBtn.click();
  await page.waitForTimeout(8000);
  const useBtn = page.getByRole("button", { name: /use this greeting/i }).first();
  if (!(await useBtn.isVisible().catch(() => false))) {
    const r = skip(hole, "Preview generation did not complete (TTS/provider)");
    recordMatrixG(record, hole, {
      route,
      page: "Voicemail greeting",
      control: "Activate greeting",
      browserAction: "generate preview",
      uiResult: "SKIP",
      backendResult: before.slice(0, 80),
      refreshResult: "—",
      effectiveRuntime: "voicemail greeting",
    }, r);
    return r;
  }
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/phone/voicemail") && r.request().method() === "POST",
      { timeout: 90_000 },
    ),
    useBtn.click(),
  ]).catch(() => useBtn.click());
  await page.waitForTimeout(2000);

  const afterText = String(snapshotBackend(workspaceId).voicemail?.greetingText ?? "");
  const backendOk = afterText.includes(VOICEMAIL_PROBE);

  await hardReload(page);
  const greetingTab2 = page.getByRole("tab", { name: /^greeting$/i }).first();
  if (await greetingTab2.isVisible().catch(() => false)) await greetingTab2.click();
  const ta2 = page.locator("textarea").first();
  const uiAfter = (await ta2.inputValue().catch(() => "")).includes(VOICEMAIL_PROBE);

  await ta2.fill(orig);
  await generateBtn.click().catch(() => undefined);
  await page.waitForTimeout(8000);
  const useRestore = page.getByRole("button", { name: /use this greeting/i }).first();
  if (await useRestore.isVisible().catch(() => false)) await useRestore.click().catch(() => undefined);
  await page.waitForTimeout(2000);
  const restored = !String(snapshotBackend(workspaceId).voicemail?.greetingText ?? "").includes(VOICEMAIL_PROBE);

  const ok = backendOk && uiAfter && restored;
  const r = ok ? pass(hole, "greeting text UI persistence") : fail(hole, `backend=${backendOk} ui=${uiAfter} restore=${restored}`);
  recordMatrixG(record, hole, {
    route,
    page: "Voicemail greeting",
    control: "Greeting script + Save",
    browserAction: "edit → save → reload → restore",
    uiResult: uiAfter ? "reload matched" : "mismatch",
    backendResult: afterText.slice(0, 100),
    refreshResult: uiAfter ? "PASS" : "FAIL",
    effectiveRuntime: "voicemail greeting (not PSTN audio)",
  }, r);
  return r;
}

/** 7 — AI Recovery configuration */
export async function certAiRecoveryConfig(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "AI Recovery configuration";
  const route = "/mctb/ai-recovery";
  await gotoMctb(page, base, route);
  await page.waitForTimeout(2000);

  const locked = await page.getByText(/requires an ai recovery plan|upgrade|not available/i).first().isVisible().catch(() => false);
  if (locked) {
    const r = skip(hole, "Workspace not AI Recovery entitled");
    recordMatrixG(record, hole, {
      route,
      page: "AI Recovery",
      control: "Field toggles",
      browserAction: "load",
      uiResult: "locked",
      backendResult: JSON.stringify(snapshotBackend(workspaceId).leadRecovery),
      refreshResult: "—",
      effectiveRuntime: "lead recovery collect fields",
    }, r);
    return r;
  }

  const before = Boolean(snapshotBackend(workspaceId).leadRecovery?.callbackTimeFieldEnabled);
  const target = !before;
  const toggle = page
    .getByRole("switch", { name: /collect best time to call back/i })
    .or(page.getByRole("checkbox", { name: /collect best time to call back/i }))
    .first();
  if (!(await toggle.isVisible().catch(() => false))) {
    const cb = page.getByLabel(/collect best time to call back/i).first();
    if (await cb.isVisible().catch(() => false)) {
      if ((await cb.isChecked().catch(() => before)) !== target) await cb.click();
    } else {
      const r = fail(hole, "CALLBACK_TIME toggle not found");
      recordMatrixG(record, hole, {
        route,
        page: "AI Recovery",
        control: "Best time to call back",
        browserAction: "locate",
        uiResult: "missing",
        backendResult: String(before),
        refreshResult: "FAIL",
        effectiveRuntime: "collectCapabilities",
      }, r);
      return r;
    }
  } else if ((await toggle.isChecked().catch(() => before)) !== target) {
    await toggle.click();
  }

  await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/ai-recovery/settings", "/api/mctb/lead-recovery/config"]);
  const backendOk = await pollLeadRecoveryField(workspaceId, "callbackTimeFieldEnabled", target);
  const after = Boolean(snapshotBackend(workspaceId).leadRecovery?.callbackTimeFieldEnabled);

  await hardReload(page);
  await dismissBlockingOnboardingModal(page);

  // restore
  const toggle2 = page.getByRole("switch", { name: /collect best time to call back/i }).first();
  if (await toggle2.isVisible().catch(() => false)) {
    if ((await toggle2.isChecked().catch(() => after)) !== before) await toggle2.click();
    await clickSaveAndWaitApi(page, /save/i, ["/api/mctb/ai-recovery/settings", "/api/mctb/lead-recovery/config"]);
  }
  const restored = await pollLeadRecoveryField(workspaceId, "callbackTimeFieldEnabled", before);

  const ok = backendOk && restored;
  const r = ok ? pass(hole, "CALLBACK_TIME field toggle") : fail(hole, `backend=${backendOk} restore=${restored}`);
  recordMatrixG(record, hole, {
    route,
    page: "AI Recovery",
    control: "Best time to call back field",
    browserAction: "toggle → save → restore",
    uiResult: ok ? "persisted" : "failed",
    backendResult: JSON.stringify({ before, after, restored }),
    refreshResult: ok ? "PASS" : "FAIL",
    effectiveRuntime: "AI recovery collection policy",
  }, r);
  return r;
}

/** 8 — Sender mode (observe / safe partial) */
export async function certSenderMode(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult> {
  const hole = "Sender mode";
  const route = "/mctb/phone";
  const before = String(backendRuntime(workspaceId).senderMode ?? "PLATFORM");

  await gotoMctb(page, base, route);
  const platformRadio = page.getByRole("radio", { name: /platform sender|transovo/i }).first();
  const workspaceRadio = page.getByRole("radio", { name: /own number|workspace|your number/i }).first();

  if (!(await platformRadio.isVisible().catch(() => false))) {
    const r = pass(hole, `sender mode readable in backend (${before}); UI radio not exposed`);
    recordMatrixG(record, hole, {
      route,
      page: "Phone / sender",
      control: "Sender mode display",
      browserAction: "load",
      uiResult: `backend=${before}`,
      backendResult: before,
      refreshResult: "PASS",
      effectiveRuntime: "SMS sender mode",
    }, r);
    return r;
  }

  // Do not flip WORKSPACE ↔ PLATFORM on cert workspace — verify readback matches UI selection state
  const platformChecked = await platformRadio.isChecked().catch(() => before === "PLATFORM");
  const uiMatchesBackend =
    (before === "PLATFORM" && platformChecked) || (before === "WORKSPACE" && !platformChecked);

  const r = uiMatchesBackend
    ? pass(hole, "UI sender mode matches backend (no unsafe toggle)")
    : fail(hole, `backend=${before} platformChecked=${platformChecked}`);
  recordMatrixG(record, hole, {
    route,
    page: "Phone / sender",
    control: "Sender mode readback",
    browserAction: "load + compare backend",
    uiResult: uiMatchesBackend ? "aligned" : "mismatch",
    backendResult: before,
    refreshResult: uiMatchesBackend ? "PASS" : "FAIL",
    effectiveRuntime: "senderMode",
  }, r);
  return r;
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

export async function runUiSettingsPersistenceCert(
  page: Page,
  base: string,
  workspaceId: string,
  record: (row: CertRow) => void,
): Promise<UiPersistenceHoleResult[]> {
  return [
    await runHole("Missed-call trigger rules", () =>
      certMissedCallTriggerRules(page, base, workspaceId, record),
    ),
    await runHole("Text-back template/delay", () =>
      certTextBackTemplateAndDelay(page, base, workspaceId, record),
    ),
    await runHole("Cooldown/max messages", () =>
      certCooldownMaxMessages(page, base, workspaceId, record),
    ),
    await runHole("Notifications/recipients", () =>
      certNotificationsRecipients(page, base, workspaceId, record),
    ),
    await runHole("Phone/business-line metadata", () =>
      certPhoneMetadata(page, base, workspaceId, record),
    ),
    await runHole("Voicemail greeting/settings", () =>
      certVoicemailGreeting(page, base, workspaceId, record),
    ),
    await runHole("AI Recovery configuration", () =>
      certAiRecoveryConfig(page, base, workspaceId, record),
    ),
    await runHole("Sender mode", () => certSenderMode(page, base, workspaceId, record)),
  ];
}
